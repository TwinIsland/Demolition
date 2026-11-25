import type { Bomb, GameSnapshot, Vec2 } from "./types";
import { DIRECTIONS } from "./maps";
export const TILE_SIZE = 2.4;
export const SLIDE_STEP = .12;

/** A slide reserves the next cell while the visible charge is still leaving the previous one. */
export function blastContact(bomb:Bomb, time:number, contains:(x:number,z:number)=>boolean): Vec2 | undefined {
  const slide = bomb.slide;
  if (slide && slide.arrivedAt-time > SLIDE_STEP/2) {
    const x=bomb.x-slide.x, z=bomb.z-slide.z;
    if (contains(x,z)) return {x,z};
  }
  if (contains(bomb.x,bomb.z)) return bomb;
}

export function slideBlocked(state:Pick<GameSnapshot,"tiles"|"bombs"|"players">, x:number, z:number, kickerId?:string) {
  return state.tiles[z]?.[x] !== 0 || state.bombs.some(b => b.x === x && b.z === z)
    || state.players.some(p => p.alive && p.id !== kickerId && Math.abs(p.x-x) < .74 && Math.abs(p.z-z) < .74);
}
/** Crates absorb a blast; stone stops it. Shared by simulation and AI prediction. */
export function blastCells(
  state: Pick<GameSnapshot, "tiles" | "size">,
  bomb: Pick<Bomb, "x" | "z" | "range">,
): Vec2[] {
  const cells: Vec2[] = [{ x: bomb.x, z: bomb.z }];
  for (const d of DIRECTIONS)
    for (let i = 1; i <= bomb.range; i++) {
      const x = bomb.x + d.x * i,
        z = bomb.z + d.z * i;
      const tile = state.tiles[z]?.[x];
      if (tile === undefined || tile === 1) break;
      cells.push({ x, z });
      if (tile === 2) break;
    }
  return cells;
}
export function walkable(
  state: Readonly<GameSnapshot>,
  x: number,
  z: number,
  playerId = "",
): boolean {
  return (
    state.tiles[z]?.[x] === 0 &&
    !state.bombs.some(
      (b) => b.x === x && b.z === z && !b.passThrough.includes(playerId),
    )
  );
}

/** Shortest four-way distance to any origin. -1 means unreachable. */
export function laneDistances(state: Readonly<GameSnapshot>, origins: readonly Vec2[]) {
  const size = state.size, count = size * size;
  const distances = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count);
  const bombs = new Set(state.bombs.map(b => b.z * size + b.x));
  let tail = 0;
  for (const origin of origins) {
    const x = Math.round(origin.x), z = Math.round(origin.z), key = z * size + x;
    if (state.tiles[z]?.[x] !== 0 || distances[key] !== -1) continue;
    distances[key] = 0;
    queue[tail++] = key;
  }
  for (let head = 0; head < tail; head++) {
    const cell = queue[head];
    for (const dir of DIRECTIONS) {
      const x = cell % size + dir.x, z = Math.floor(cell / size) + dir.z, key = z * size + x;
      if (state.tiles[z]?.[x] !== 0 || bombs.has(key) || distances[key] !== -1) continue;
      distances[key] = distances[cell] + 1;
      queue[tail++] = key;
    }
  }
  return distances;
}

/** Traverse grid boundaries from the actual positions, including solid corners. */
export function firstBlocker(state: Readonly<GameSnapshot>, from: Vec2, to: Vec2) {
  let x = Math.round(from.x), z = Math.round(from.z);
  const endX = Math.round(to.x), endZ = Math.round(to.z);
  const dx = to.x - from.x, dz = to.z - from.z, sx = Math.sign(dx), sz = Math.sign(dz);
  const stepX = dx ? 1 / Math.abs(dx) : Infinity, stepZ = dz ? 1 / Math.abs(dz) : Infinity;
  let crossX = dx ? (x + sx * .5 - from.x) / dx : Infinity;
  let crossZ = dz ? (z + sz * .5 - from.z) / dz : Infinity;
  while (x !== endX || z !== endZ) {
    // An endpoint exactly on an edge may already be inside its final column or row.
    const tx = x === endX ? Infinity : crossX, tz = z === endZ ? Infinity : crossZ;
    if (tx === tz) {
      if (state.tiles[z]?.[x+sx] !== 0) return {x:x+sx,z,fraction:tx};
      if (state.tiles[z+sz]?.[x] !== 0) return {x,z:z+sz,fraction:tz};
    }
    if (tx <= tz) { x += sx; crossX += stepX; }
    if (tz <= tx) { z += sz; crossZ += stepZ; }
    if (state.tiles[z]?.[x] !== 0) return {x,z,fraction:Math.min(tx,tz)};
  }
}
export function clearSight(state: Readonly<GameSnapshot>, from: Vec2, to: Vec2) {
  return firstBlocker(state,from,to) === undefined;
}
