import { clearSight, laneDistances, SLIDE_STEP } from "./geometry";
import { ZOMBIE_STATS } from "./loot";
import { DIRECTIONS } from "./maps";
import { ZOMBIE_RATES, type ZombieRate } from "./room";
import { isBystander, isCloaked } from "./types";
import type { Bomb, GameSnapshot, Player, Vec2, Zombie } from "./types";
import { zoneBurning } from "./zone";

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
const prey = (s: GameSnapshot, p: Player) => p.alive && !isBystander(p) && (!s.storyTutorial || !p.bot);
const blocked = (s: GameSnapshot, p: Vec2) => s.tiles[p.z]?.[p.x] !== 0 || s.bombs.some((b) => same(b, p));

export const SUMMON_TIME = 1.15;
export function slidingZombieContact(zombies: readonly Zombie[], bomb: Bomb, time: number) {
  if (!bomb.slide) return;
  const left = Math.min(1, Math.max(0, (bomb.slide.arrivedAt - time) / SLIDE_STEP));
  const x = bomb.x - bomb.slide.x * left,
    z = bomb.z - bomb.slide.z * left;
  const enemy = zombies.find(
    (e) =>
      (e.spawnAt === undefined || time >= e.spawnAt + SUMMON_TIME) && Math.hypot(e.x - x, e.z - z) <= 0.54,
  );
  if (enemy) return atCell(enemy);
}
export const ZOMBIE_STRIKE = { reach: 0.55, windup: 0.18, recovery: 0.34, interval: 1.3 } as const;
/** A struck zombie slides `distance` cells over `slide` seconds and cannot act for `stagger` seconds. */
export const ZOMBIE_KNOCKBACK = { distance: 0.8, slide: 0.18, stagger: 0.4 } as const;
export class ZombieDirector {
  private nextSpawn: number;
  private nextScan = 0;
  private tracking = new Map<number, Tracking>();
  private routes = new Map<number, Int32Array>();
  /** Damages a zombie. A survivor is knocked away from the attacker and staggers, like in Minecraft. */
  strike(s: GameSnapshot, zombie: Zombie, damage: number, from?: Vec2) {
    zombie.hurtAt = s.time;
    zombie.hp = Math.max(0, (zombie.hp ?? 48) - damage);
    if (zombie.hp) {
      const dx = zombie.x - (from?.x ?? zombie.x),
        dz = zombie.z - (from?.z ?? zombie.z);
      // Along the lane the hit came down, so the zombie stays on the grid.
      zombie.knockback =
        !from || (!dx && !dz)
          ? undefined
          : Math.abs(dx) >= Math.abs(dz)
            ? { x: Math.sign(dx), z: 0 }
            : { x: 0, z: Math.sign(dz) };
      zombie.staggerUntil = s.time + ZOMBIE_KNOCKBACK.stagger;
      delete zombie.attack;
      return false;
    }
    s.zombies = s.zombies.filter((z) => z.id !== zombie.id);
    this.tracking.delete(zombie.id);
    return true;
  }
  constructor(private rate: ZombieRate = "normal") {
    this.nextSpawn = ZOMBIE_RATES[rate].first;
  }
  terrainChanged(time: number) {
    this.nextScan = time;
  }
  /**
   * Carries zombies inward with the closing boundary instead of removing them. `inset` is the
   * wall's inner face; `ring` is the ring being closed, which no zombie may keep heading into.
   */
  carry(s: GameSnapshot, ring: number, inset: number) {
    const body = (v: number) => Math.max(inset + 0.3, Math.min(s.size - 1 - inset - 0.3, v)),
      cell = (v: number) => Math.max(ring + 1, Math.min(s.size - 2 - ring, v));
    for (const enemy of s.zombies) {
      enemy.x = body(enemy.x);
      enemy.z = body(enemy.z);
      enemy.destination = { x: cell(enemy.destination.x), z: cell(enemy.destination.z) };
      const brain = this.tracking.get(enemy.id);
      if (brain) brain.previous = { x: cell(brain.previous.x), z: cell(brain.previous.z) };
    }
  }

  private spawn(s: GameSnapshot, random: () => number, nextId: () => number) {
    const cadence = ZOMBIE_RATES[this.rate];
    // Pacing in the manner of an AI director: ease off while players are under pressure,
    // and bring the next wave sooner when the arena has gone quiet.
    const alive = s.players.filter((p) => prey(s, p)),
      chasing = [...this.tracking.values()].filter((brain) => brain.visible).length,
      health = alive.reduce((sum, p) => sum + p.hp / p.maxHp, 0) / Math.max(1, alive.length);
    const pacing = chasing >= 2 || health < 0.45 ? 1.7 : chasing === 0 ? 0.75 : 1;
    this.nextSpawn = s.time + (cadence.min + random() * (cadence.max - cadence.min)) * pacing;
    if (s.zombies.length >= 6) return;
    const distances = laneDistances(s, alive);
    const occupied = new Set(
      [...s.zombies, ...s.blasts, ...s.fires, ...s.items].map(
        (p) => Math.round(p.z) * s.size + Math.round(p.x),
      ),
    );
    const candidates: number[] = [];
    const burning = (i: number) =>
      !!s.zone && zoneBurning(s.size, { x: i % s.size, z: Math.floor(i / s.size) }, s.zone);
    for (let i = 0; i < distances.length; i++)
      if (distances[i] >= 3 && !occupied.has(i) && !burning(i)) candidates.push(i);
    if (!candidates.length) return;
    const k = candidates[Math.floor(random() * candidates.length)],
      x = k % s.size,
      z = Math.floor(k / s.size);
    const roll = random(),
      level = roll < 0.12 ? 3 : roll < 0.42 ? 2 : 1;
    s.zombies.push({ level, id: nextId(), x, z, spawnAt: s.time, yaw: 0, destination: { x, z } });
  }

  private observe(s: GameSnapshot, enemy: Zombie, brain: Tracking) {
    let nearest: Player | undefined;
    let distance: number = ZOMBIE_STATS[enemy.level].sight;
    for (const p of s.players) {
      const d = Math.hypot(p.x - enemy.x, p.z - enemy.z);
      if (prey(s, p) && !isCloaked(p, s.time) && d <= distance && clearSight(s, enemy, p)) {
        nearest = p;
        distance = d;
      }
    }
    brain.visible = Boolean(nearest);
    if (nearest) {
      brain.lastSeen = { x: nearest.x, z: nearest.z };
      brain.targetId = nearest.id;
      brain.forgetAt = s.time + 1.4;
    } else if (s.time >= brain.forgetAt || !s.players.some((p) => prey(s, p) && p.id === brain.targetId)) {
      brain.lastSeen = undefined;
      brain.targetId = undefined;
    }
  }

  private waypoint(s: GameSnapshot, enemy: Zombie, brain: Tracking, random: () => number): Vec2 {
    const here = atCell(enemy),
      target = brain.lastSeen;
    if (target && same(here, atCell(target))) return target;
    if (!same(here, enemy)) return here;
    const open = DIRECTIONS.map((d) => ({ x: here.x + d.x, z: here.z + d.z })).filter((c) => !blocked(s, c));
    if (target) {
      const goal = atCell(target),
        key = goal.z * s.size + goal.x;
      let field = this.routes.get(key);
      if (!field) {
        field = laneDistances(s, [goal]);
        this.routes.set(key, field);
      }
      let best = Infinity,
        next: Vec2 | undefined;
      for (const cell of open) {
        const cost = field[cell.z * s.size + cell.x];
        if (cost >= 0 && cost < best) {
          best = cost;
          next = cell;
        }
      }
      if (next) {
        brain.previous = here;
        return next;
      }
    }
    const forward = open.filter((c) => !same(c, brain.previous));
    const choices = forward.length ? forward : open;
    brain.previous = here;
    return choices.length ? choices[Math.floor(random() * choices.length)] : here;
  }

  step(
    s: GameSnapshot,
    dt: number,
    random: () => number,
    nextId: () => number,
    onKill: (z: Zombie, owner: string) => void,
    onContact: (p: Player, damage: number) => void,
  ) {
    if (s.time >= this.nextSpawn) this.spawn(s, random, nextId);
    const scan = s.time >= this.nextScan;
    if (scan) {
      this.nextScan = s.time + 0.22;
      this.routes.clear();
    }
    s.zombies = s.zombies.filter((enemy) => {
      if (enemy.spawnAt !== undefined && s.time < enemy.spawnAt + SUMMON_TIME) return true;
      const scorched = (b: Vec2) => Math.abs(b.x - enemy.x) < 0.58 && Math.abs(b.z - enemy.z) < 0.58;
      const hit = s.blasts.find(scorched) ?? s.fires.find(scorched);
      if (hit) {
        this.tracking.delete(enemy.id);
        onKill(enemy, hit.ownerId);
        return false;
      }
      let brain = this.tracking.get(enemy.id);
      if (!brain) {
        brain = { visible: false, forgetAt: 0, pace: 1, previous: atCell(enemy) };
        this.tracking.set(enemy.id, brain);
      }
      if (enemy.staggerUntil !== undefined) {
        if (s.time < enemy.staggerUntil) {
          const push = enemy.knockback,
            sliding = s.time < enemy.staggerUntil - ZOMBIE_KNOCKBACK.stagger + ZOMBIE_KNOCKBACK.slide;
          if (push && sliding) {
            const stride = (ZOMBIE_KNOCKBACK.distance / ZOMBIE_KNOCKBACK.slide) * dt;
            const x = enemy.x + push.x * stride,
              z = enemy.z + push.z * stride;
            // Stop short of walls, cover and bombs: the leading edge must stay in an open cell.
            if (blocked(s, atCell({ x: x + push.x * 0.3, z: z + push.z * 0.3 }))) delete enemy.knockback;
            else {
              enemy.x = x;
              enemy.z = z;
            }
          }
          return true;
        }
        delete enemy.staggerUntil;
        delete enemy.knockback;
        // Resume from the nearest cell centre.
        enemy.destination = atCell(enemy);
        brain.previous = enemy.destination;
      }
      const attack = enemy.attack;
      if (attack && s.time < attack.at + ZOMBIE_STRIKE.windup + ZOMBIE_STRIKE.recovery) {
        const impact = attack.at + ZOMBIE_STRIKE.windup;
        if (s.time >= impact && s.time - dt < impact) {
          const target = s.players.find((p) => p.id === attack.targetId);
          if (
            target &&
            prey(s, target) &&
            Math.hypot(target.x - enemy.x, target.z - enemy.z) < ZOMBIE_STRIKE.reach &&
            clearSight(s, enemy, target)
          )
            onContact(target, ZOMBIE_STATS[enemy.level].damage);
        }
        return true;
      }
      if (scan) this.observe(s, enemy, brain);
      if (same(enemy, enemy.destination)) enemy.destination = this.waypoint(s, enemy, brain, random);
      if (blocked(s, atCell(enemy.destination))) enemy.destination = brain.previous;
      const dx = enemy.destination.x - enemy.x,
        dz = enemy.destination.z - enemy.z;
      const distance = Math.hypot(dx, dz);
      const stats = ZOMBIE_STATS[enemy.level];
      const pace = brain.visible ? stats.chaseMultiplier : 1;
      brain.pace += Math.max(-dt * 2, Math.min(dt * 2, pace - brain.pace));
      const stride = dt * stats.speed * brain.pace;
      if (distance && !blocked(s, atCell(enemy.destination))) {
        enemy.yaw = Math.atan2(-dx, -dz);
        if (distance <= stride) Object.assign(enemy, enemy.destination);
        else {
          enemy.x += (dx / distance) * stride;
          enemy.z += (dz / distance) * stride;
        }
      }
      if (!attack || s.time >= attack.at + ZOMBIE_STRIKE.interval) {
        const target = s.players.find(
          (p) =>
            prey(s, p) &&
            !isCloaked(p, s.time) &&
            Math.hypot(p.x - enemy.x, p.z - enemy.z) < ZOMBIE_STRIKE.reach &&
            clearSight(s, enemy, p),
        );
        if (target) {
          const dx = target.x - enemy.x,
            dz = target.z - enemy.z;
          if (Math.hypot(dx, dz) > 0.001) enemy.yaw = Math.atan2(-dx, -dz);
          enemy.attack = { at: s.time, targetId: target.id, yaw: enemy.yaw };
        }
      }
      return true;
    });
  }
}
