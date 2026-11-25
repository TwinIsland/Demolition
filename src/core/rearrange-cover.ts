import { DIRECTIONS, spawnPoints } from "./maps";
import type { MapDefinition } from "./pack-api";
import type { GameSnapshot, Vec2 } from "./types";

function shuffle(list:number[], random:()=>number) {
  for (let i=list.length-1; i>0; i--) {
    const j=Math.floor(random()*(i+1));
    [list[i],list[j]]=[list[j],list[i]];
  }
  return list;
}

export function rearrangeCover(s:GameSnapshot, map:MapDefinition, random:()=>number) {
  if (!map.randomizeTerrain) return;
  const layout = map.randomizeTerrain(random,s.size);
  const occupied = new Set<number>();
  const reserve = (p:Vec2) => occupied.add(Math.round(p.z)*s.size+Math.round(p.x));
  for (const p of [...s.items,...s.bombs,...s.thrown,...s.blasts]) reserve(p);
  for (const b of s.bombs) if (b.slide) reserve({x:b.x-b.slide.x,z:b.z-b.slide.z});
  for (const z of s.zombies) reserve(z.destination);
  for (const p of [...s.players.filter(p=>p.alive),...s.zombies]) {
    const x=Math.round(p.x), z=Math.round(p.z);
    // Keep the actor's footprint and its currently open escape tiles clear.
    for (const dx of [-.3,.3]) for (const dz of [-.3,.3]) reserve({x:p.x+dx,z:p.z+dz});
    for (const d of DIRECTIONS) if (s.tiles[z+d.z]?.[x+d.x] === 0) reserve({x:x+d.x,z:z+d.z});
  }
  const spawns = spawnPoints(s.size);
  const origins:Record<number,number> = {};
  const moving:number[] = [], open:number[] = [], old:number[] = [], fallback:number[] = [];
  for (let z=1; z<s.size-1; z++) for (let x=1; x<s.size-1; x++) {
    const tile = s.tiles[z][x], cell = z*s.size+x;
    if (tile === 1) continue;
    const origin = s.coverOrigins?.[cell] ?? cell;
    if (occupied.has(cell) || spawns.some(p=>Math.abs(p.x-x)+Math.abs(p.z-z)<=2)) {
      if (tile === 2) origins[cell]=origin;
      continue;
    }
    const rule = (layout.tileAt ?? map.tileAt)?.(x,z,s.size,random);
    if (tile === 2) {
      moving.push(origin);
      (rule === 0 || rule === 1 ? fallback : old).push(cell);
      s.tiles[z][x]=0;
    } else if (rule !== 0 && rule !== 1) open.push(cell);
  }
  // Old slots provide capacity even when a crowded map cannot give every piece a new cell.
  const destinations = [...shuffle(open,random),...shuffle(old,random),...shuffle(fallback,random)];
  shuffle(moving,random).forEach((origin,i)=>{
    const cell=destinations[i];
    origins[cell]=origin;
    s.tiles[Math.floor(cell/s.size)][cell%s.size]=2;
  });
  s.coverOrigins=origins;
  s.coverRevision=(s.coverRevision ?? 0)+1;
}
