import { DIRECTIONS, placeWall, spawnPoints } from "./maps";
import type { MapDefinition } from "./pack-api";
import type { GameSnapshot, Vec2 } from "./types";

function shuffle(list: number[], random: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export interface WallPlan {
  /** Cells where a wall is about to rise. */
  rising: number[];
  /** Cells whose wall is about to sink. */
  sinking: number[];
}

/**
 * Choose which movable permanent walls a terrain reset lifts and where they should come down.
 * Cover is ignored because the reset lifts it first. Every target is tried with the rule map
 * generation uses, so the walkable area stays in one piece and no cell is boxed in.
 * Published ahead of the swap so clients can warn about cells where a wall will rise.
 */
export function planWalls(s: GameSnapshot, map: MapDefinition, random: () => number): WallPlan {
  const walls = s.wallOrigins,
    size = s.size,
    ratio = map.wallShuffle;
  if (!walls || !(ratio! > 0)) return { rising: [], sinking: [] };
  const standing = Object.keys(walls)
    .map(Number)
    .sort((a, b) => a - b);
  const sinking = shuffle(standing, random).slice(0, Math.round(standing.length * Math.min(1, ratio!)));
  const tiles = s.tiles.map((row) => row.map((tile) => (tile === 2 ? 0 : tile)));
  for (const cell of sinking) tiles[Math.floor(cell / size)][cell % size] = 0;
  const spawns = spawnPoints(size),
    built = new Set((s.builtCrates ?? []).map((crate) => crate.z * size + crate.x)),
    fresh: number[] = [];
  for (let z = 1; z < size - 1; z++)
    for (let x = 1; x < size - 1; x++) {
      const cell = z * size + x;
      if (
        tiles[z][x] === 0 &&
        !sinking.includes(cell) &&
        !built.has(cell) &&
        !spawns.some((p) => Math.abs(p.x - x) + Math.abs(p.z - z) <= 2) &&
        map.tileAt?.(x, z, size, () => 0) === undefined
      )
        fresh.push(cell);
    }
  const rising: number[] = [];
  for (const cell of shuffle(fresh, random)) {
    if (rising.length >= sinking.length) break;
    if (placeWall(tiles, cell % size, Math.floor(cell / size))) rising.push(cell);
  }
  return { rising, sinking };
}

/**
 * Carry out a wall plan. A planned cell that has since been taken is skipped; a wall that finds no
 * new home goes back to a vacated cell. Returns the cells that walls left open.
 */
function rearrangeWalls(s: GameSnapshot, plan: WallPlan, blocked: (cell: number) => boolean) {
  const walls = s.wallOrigins,
    size = s.size;
  if (!walls) return [];
  const lifted = plan.sinking.filter((cell) => walls[cell] !== undefined);
  const ids = lifted.map((cell) => walls[cell]);
  for (const cell of lifted) {
    s.tiles[Math.floor(cell / size)][cell % size] = 0;
    delete walls[cell];
  }
  const targets = plan.rising.filter((cell) => !blocked(cell));
  // Vacated cells come last: a wall goes back only when its planned cell cannot take it.
  for (const cell of [...targets, ...lifted]) {
    if (!ids.length) break;
    const x = cell % size,
      z = Math.floor(cell / size);
    if (s.tiles[z][x] === 0 && placeWall(s.tiles, x, z)) walls[cell] = ids.pop()!;
  }
  return lifted.filter((cell) => s.tiles[Math.floor(cell / size)][cell % size] === 0);
}

export function rearrangeCover(
  s: GameSnapshot,
  map: MapDefinition,
  random: () => number,
  wallPlan: WallPlan = planWalls(s, map, random),
) {
  if (!map.randomizeTerrain) return;
  const layout = map.randomizeTerrain(random, s.size);
  const occupied = new Set<number>();
  const reserve = (p: Vec2) => occupied.add(Math.round(p.z) * s.size + Math.round(p.x));
  // Player-built crates stay where their owner put them.
  for (const p of [...s.items, ...s.bombs, ...s.thrown, ...s.blasts, ...(s.builtCrates ?? [])]) reserve(p);
  for (const b of s.bombs) if (b.slide) reserve({ x: b.x - b.slide.x, z: b.z - b.slide.z });
  for (const z of s.zombies) reserve(z.destination);
  for (const p of [...s.players.filter((p) => p.alive), ...s.zombies]) {
    const x = Math.round(p.x),
      z = Math.round(p.z);
    // Keep the player's footprint and its currently open escape tiles clear.
    for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) reserve({ x: p.x + dx, z: p.z + dz });
    for (const d of DIRECTIONS) if (s.tiles[z + d.z]?.[x + d.x] === 0) reserve({ x: x + d.x, z: z + d.z });
  }
  // Walls rise only well clear of anyone standing: never on or next to a player or zombie.
  const crowded = new Set<number>();
  for (const p of [...s.players.filter((p) => p.alive), ...s.zombies])
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) crowded.add((Math.round(p.z) + dz) * s.size + Math.round(p.x) + dx);
  const spawns = spawnPoints(s.size);
  const origins: Record<number, number> = {};
  const moving: number[] = [],
    open: number[] = [],
    old: number[] = [],
    fallback: number[] = [];
  for (let z = 1; z < s.size - 1; z++)
    for (let x = 1; x < s.size - 1; x++) {
      const tile = s.tiles[z][x],
        cell = z * s.size + x;
      if (tile === 1) continue;
      const origin = s.coverOrigins?.[cell] ?? cell;
      if (occupied.has(cell) || spawns.some((p) => Math.abs(p.x - x) + Math.abs(p.z - z) <= 2)) {
        if (tile === 2) origins[cell] = origin;
        continue;
      }
      const rule = (layout.tileAt ?? map.tileAt)?.(x, z, s.size, random);
      if (tile === 2) {
        moving.push(origin);
        (rule === 0 || rule === 1 ? fallback : old).push(cell);
        s.tiles[z][x] = 0;
      } else if (rule !== 0 && rule !== 1) open.push(cell);
    }
  const rule = (cell: number) =>
    (layout.tileAt ?? map.tileAt)?.(cell % s.size, Math.floor(cell / s.size), s.size, random);
  const freed = rearrangeWalls(s, wallPlan, (cell) => {
    const x = cell % s.size,
      z = Math.floor(cell / s.size);
    return (
      occupied.has(cell) ||
      crowded.has(cell) ||
      spawns.some((p) => Math.abs(p.x - x) + Math.abs(p.z - z) <= 2) ||
      rule(cell) !== undefined
    );
  });
  for (const cell of freed)
    (rule(cell) === 0 || rule(cell) === 1 || occupied.has(cell) ? fallback : open).push(cell);
  const free = (cell: number) => s.tiles[Math.floor(cell / s.size)][cell % s.size] === 0;
  // Old slots provide capacity even when a crowded map cannot give every piece a new cell.
  const destinations = [
    ...shuffle(open, random),
    ...shuffle(old, random),
    ...shuffle(fallback, random),
  ].filter(free);
  shuffle(moving, random).forEach((origin, i) => {
    const cell = destinations[i];
    if (cell === undefined) return;
    origins[cell] = origin;
    s.tiles[Math.floor(cell / s.size)][cell % s.size] = 2;
  });
  s.coverOrigins = origins;
  s.coverRevision = (s.coverRevision ?? 0) + 1;
}
