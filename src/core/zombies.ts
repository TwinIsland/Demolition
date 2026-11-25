import { obscured } from "./equipment";
import { clearSight, laneDistances, SLIDE_STEP } from "./geometry";
import { ZOMBIE_STATS } from "./loot";
import { DIRECTIONS } from "./maps";
import { ZOMBIE_RATES, type ZombieRate } from "./room";
import type { Bomb, GameSnapshot, Player, Vec2, Zombie } from "./types";

interface Tracking {
  lastSeen?: Vec2;
  targetId?: string;
  visible: boolean;
  forgetAt: number;
  pace: number;
  previous: Vec2;
}

const atCell = (p: Vec2) => ({ x: Math.round(p.x), z: Math.round(p.z) });
const same = (a: Vec2, b: Vec2) => a.x === b.x && a.z === b.z;
const blocked = (s: GameSnapshot, p: Vec2) => s.tiles[p.z]?.[p.x] !== 0 ||
  s.bombs.some(b => same(b,p));

export const SUMMON_TIME = 1.15;
export function slidingZombieContact(zombies:readonly Zombie[], bomb:Bomb, time:number) {
  if (!bomb.slide) return;
  const left = Math.min(1,Math.max(0,(bomb.slide.arrivedAt-time)/SLIDE_STEP));
  const x = bomb.x - bomb.slide.x*left, z = bomb.z - bomb.slide.z*left;
  const enemy = zombies.find(e => (e.spawnAt === undefined || time >= e.spawnAt+SUMMON_TIME) &&
    Math.hypot(e.x-x,e.z-z) <= .54);
  if (enemy) return atCell(enemy);
}
export const ZOMBIE_STRIKE = { reach:.55, windup:.18, recovery:.34, interval:1.3 } as const;
export class ZombieDirector {
  private nextSpawn: number;
  private nextScan = 0;
  private tracking = new Map<number, Tracking>();
  private routes = new Map<number, Int32Array>();
  strike(s: GameSnapshot, zombie: Zombie, damage: number) {
    zombie.hurtAt = s.time;
    zombie.hp = Math.max(0,(zombie.hp ?? 48)-damage);
    if (zombie.hp) return false;
    s.zombies = s.zombies.filter(z => z.id !== zombie.id);
    this.tracking.delete(zombie.id);
    return true;
  }
  constructor(private rate: ZombieRate = "normal") {
    this.nextSpawn = ZOMBIE_RATES[rate].first;
  }
  terrainChanged(time:number) {
    this.nextScan = time;
  }

  private spawn(s: GameSnapshot, random: () => number, nextId: () => number) {
    const cadence = ZOMBIE_RATES[this.rate];
    this.nextSpawn = s.time + cadence.min + random() * (cadence.max - cadence.min);
    if (s.zombies.length >= 6) return;
    const distances = laneDistances(s,s.players.filter(p => p.alive));
    const occupied = new Set([...s.zombies,...s.blasts,...s.items].map(p => Math.round(p.z)*s.size + Math.round(p.x)));
    const candidates: number[] = [];
    for (let i=0; i<distances.length; i++) if (distances[i]>=3 && !occupied.has(i)) candidates.push(i);
    if (!candidates.length) return;
    const k = candidates[Math.floor(random()*candidates.length)], x = k%s.size, z = Math.floor(k/s.size);
    const roll = random(), level = roll < .12 ? 3 : roll < .42 ? 2 : 1;
    s.zombies.push({ level, id:nextId(), x,z, spawnAt:s.time, yaw:0, destination:{x,z} });
  }

  private observe(s: GameSnapshot, enemy: Zombie, brain: Tracking) {
    let nearest: Player | undefined;
    let distance: number = ZOMBIE_STATS[enemy.level].sight;
    for (const p of s.players) {
      const d = Math.hypot(p.x-enemy.x,p.z-enemy.z);
      if (p.alive && d <= distance && !obscured(s,enemy,p) && clearSight(s,enemy,p)) {
        nearest = p;
        distance = d;
      }
    }
    brain.visible = Boolean(nearest);
    if (nearest) {
      brain.lastSeen = { x:nearest.x, z:nearest.z };
      brain.targetId = nearest.id;
      brain.forgetAt = s.time + 1.4;
    } else if (s.time >= brain.forgetAt || !s.players.some(p => p.alive && p.id === brain.targetId)) {
      brain.lastSeen = undefined;
      brain.targetId = undefined;
    }
  }

  private waypoint(s: GameSnapshot, enemy: Zombie, brain: Tracking, random: () => number): Vec2 {
    const here = atCell(enemy), target = brain.lastSeen;
    if (target && same(here,atCell(target))) return target;
    if (!same(here,enemy)) return here;
    const open = DIRECTIONS.map(d => ({x:here.x+d.x,z:here.z+d.z})).filter(c => !blocked(s,c));
    if (target) {
      const goal = atCell(target), key = goal.z*s.size + goal.x;
      let field = this.routes.get(key);
      if (!field) {
        field = laneDistances(s,[goal]);
        this.routes.set(key,field);
      }
      let best = Infinity, next: Vec2 | undefined;
      for (const cell of open) {
        const cost = field[cell.z*s.size+cell.x];
        if (cost >= 0 && cost < best) { best = cost; next = cell; }
      }
      if (next) { brain.previous = here; return next; }
    }
    const forward = open.filter(c => !same(c,brain.previous));
    const choices = forward.length ? forward : open;
    brain.previous = here;
    return choices.length ? choices[Math.floor(random()*choices.length)] : here;
  }

  step(s: GameSnapshot, dt: number, random: () => number, nextId: () => number,
       onKill: (z: Zombie, owner: string) => void, onContact: (p: Player, damage: number) => void) {
    if (s.time >= this.nextSpawn) this.spawn(s,random,nextId);
    const scan = s.time >= this.nextScan;
    if (scan) { this.nextScan = s.time + .22; this.routes.clear(); }
    s.zombies = s.zombies.filter(enemy => {
      if (enemy.spawnAt !== undefined && s.time < enemy.spawnAt + SUMMON_TIME) return true;
      const hit = s.blasts.find(b => Math.abs(b.x-enemy.x)<.58 && Math.abs(b.z-enemy.z)<.58);
      if (hit) { this.tracking.delete(enemy.id); onKill(enemy,hit.ownerId); return false; }
      let brain = this.tracking.get(enemy.id);
      if (!brain) {
        brain = { visible:false,forgetAt:0,pace:1,previous:atCell(enemy) };
        this.tracking.set(enemy.id,brain);
      }
      const attack = enemy.attack;
      if (attack && s.time < attack.at + ZOMBIE_STRIKE.windup + ZOMBIE_STRIKE.recovery) {
        const impact = attack.at + ZOMBIE_STRIKE.windup;
        if (s.time >= impact && s.time - dt < impact) {
          const target = s.players.find(p => p.id === attack.targetId);
          if (target?.alive && Math.hypot(target.x-enemy.x,target.z-enemy.z) < ZOMBIE_STRIKE.reach &&
              clearSight(s,enemy,target)) onContact(target,ZOMBIE_STATS[enemy.level].damage);
        }
        return true;
      }
      if (scan) this.observe(s,enemy,brain);
      if (same(enemy,enemy.destination)) enemy.destination = this.waypoint(s,enemy,brain,random);
      if (blocked(s,atCell(enemy.destination))) enemy.destination = brain.previous;
      const dx = enemy.destination.x-enemy.x, dz = enemy.destination.z-enemy.z;
      const distance = Math.hypot(dx,dz);
      const stats = ZOMBIE_STATS[enemy.level];
      const pace = brain.visible ? stats.chaseMultiplier : 1;
      brain.pace += Math.max(-dt*2, Math.min(dt*2, pace-brain.pace));
      const stride = dt * stats.speed * brain.pace;
      if (distance && !blocked(s,atCell(enemy.destination))) {
        enemy.yaw = Math.atan2(-dx,-dz);
        if (distance <= stride) Object.assign(enemy,enemy.destination);
        else { enemy.x += dx/distance*stride; enemy.z += dz/distance*stride; }
      }
      if (!attack || s.time >= attack.at + ZOMBIE_STRIKE.interval) {
        const target = s.players.find(p => p.alive && Math.hypot(p.x-enemy.x,p.z-enemy.z) < ZOMBIE_STRIKE.reach &&
          clearSight(s,enemy,p));
        if (target) {
          const dx = target.x-enemy.x, dz = target.z-enemy.z;
          if (Math.hypot(dx,dz) > .001) enemy.yaw = Math.atan2(-dx,-dz);
          enemy.attack = {at:s.time,targetId:target.id,yaw:enemy.yaw};
        }
      }
      return true;
    });
  }
}
