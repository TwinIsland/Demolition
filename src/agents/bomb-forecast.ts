import { ITEMS } from "../core/content";
import { RULES } from "../core/content";
import { slidingZombieContact } from "../core/zombies";
import { blastCells, blastContact, slideBlocked, SLIDE_STEP } from "../core/geometry";
import type { Bomb, GameSnapshot, Vec2 } from "../core/types";

type Span = { from: number; to: number };
const key = (p: Vec2, size: number) => p.z * size + p.x;

/** Event-driven copy of just the grid and explosives. Times are relative to this decision. */
export class BombForecast {
  private fire = new Map<number, Span[]>();
  private solid = new Map<number, Span[]>();
  readonly footprints = new Map<number, Vec2[]>();
  horizon = 0;
  constructor(private state: Readonly<GameSnapshot>, extra?: Bomb, kick?: Bomb) {
    const tiles = state.tiles.map(row => row.slice());
    const bombs = [...state.bombs, ...(extra ? [extra] : [])].map(original => {
      const b = kick && original.id === kick.id ? kick : original;
      return { ...b, slide: b.slide && {...b.slide}, awaitingKick:b === kick, entered: 0 };
    });
    const spans = (map: Map<number,Span[]>, p: Vec2, from: number, to: number) => {
      const k = key(p,state.size), list = map.get(k) ?? [];
      list.push({from,to});
      map.set(k,list);
    };
    const landings = state.thrown.flatMap(t => {
      const range = ITEMS[t.kind]?.throwable?.blastRange;
      return range ? [{x:t.x,z:t.z,range,at:t.landsAt}] : [];
    }).sort((a,b)=>a.at-b.at);
    for (const b of state.blasts) {
      spans(this.fire,b,0,b.expiresAt-state.time);
      this.horizon = Math.max(this.horizon,b.expiresAt-state.time);
    }
    const map = {size:state.size,tiles};
    const collision = {tiles,bombs,players:state.players};
    const burn = (source:Vec2 & {range:number}, time:number, duration:number) => {
      const cells = blastCells(map,source);
      for (const c of cells) {
        spans(this.fire,c,time,time+duration);
        if (tiles[c.z][c.x]===2) tiles[c.z][c.x]=0;
      }
      this.horizon=Math.max(this.horizon,time+duration);
      return cells;
    };
    const resolveExplosions = (at:number) => {
      const time = at-state.time;
      const burning = (x:number,z:number) => this.burning(x,z,time,time);
      const contact = (b:typeof bombs[number]) => b.awaitingKick
        ? (burning(b.x,b.z) ? b : undefined) : blastContact(b,at,burning) ?? slidingZombieContact(state.zombies,b,at);
      let i: number;
      while ((i=bombs.findIndex(b => (!b.slide && b.detonateAt<=at) || contact(b))) >= 0) {
        const b = bombs.splice(i,1)[0];
        spans(this.solid,b,b.entered,time);
        this.footprints.set(b.id,burn({...b,...contact(b)},time,b.blastDuration ?? RULES.blastDuration));
      }
    };
    resolveExplosions(state.time);
    while (bombs.length || landings.length) {
      let next = landings[0]?.at ?? Infinity;
      for (const b of bombs) next = Math.min(next,b.slide?.arrivedAt ?? b.detonateAt);
      next = Math.max(next,state.time);
      const time = next-state.time;
      while (landings.length && landings[0].at <= next) {
        burn(landings.shift()!,time,RULES.blastDuration);
        resolveExplosions(next);
      }
      resolveExplosions(next);
      for (const b of [...bombs]) {
        const d = b.slide;
        if (!d || d.arrivedAt > next || !bombs.includes(b)) continue;
        const x = b.x+d.x, z = b.z+d.z;
        if (slideBlocked(collision,x,z)) {
          b.slide=undefined;
          if (!b.awaitingKick) b.detonateAt=next;
          b.awaitingKick=false;
          resolveExplosions(next);
        } else {
          b.awaitingKick=false;
          spans(this.solid,b,b.entered,time);
          b.x=x; b.z=z; b.entered=time; d.arrivedAt=next+SLIDE_STEP;
          if (this.burning(x,z,time,time)) resolveExplosions(next);
        }
      }
    }
  }
  burning(x:number,z:number,from:number,to:number) {
    return this.fire.get(z*this.state.size+x)?.some(s => s.from<=to && s.to>=from) ?? false;
  }
  occupied(x:number,z:number,from:number,to:number) {
    return this.solid.get(z*this.state.size+x)?.some(s => s.from<=to && s.to>=from) ?? false;
  }
}
