import { maps } from "#game-catalog";
import { DIRECTIONS } from "./directions";
import { indexPacks, type MapDefinition } from "./pack-api";
import type { Tile, Vec2 } from "./types";

export type { MapDefinition } from "./pack-api";
export const MAPS = Object.values(indexPacks(maps, "map"));
for (const map of MAPS) {
  if (
    !Number.isInteger(map.size) ||
    map.size < 7 ||
    map.size % 2 !== 1 ||
    !(map.density >= 0 && map.density <= 1)
  )
    throw new Error(`Invalid map dimensions or density: ${map.id}`);
}

/** The maps a room can be set up on. */
export const ROOM_MAPS = MAPS.filter((map) => !map.hidden);

export function seededRandom(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The four spawns sit on the diagonals, `spawnInset` cells in from the boundary wall. */
export function spawnPoints(map: Pick<MapDefinition, "size" | "spawnInset">): Vec2[] {
  const near = Math.max(1, Math.min((map.size - 1) / 2 - 2, Math.round(map.spawnInset ?? 1))),
    far = map.size - 1 - near;
  return [
    { x: near, z: near },
    { x: far, z: far },
    { x: far, z: near },
    { x: near, z: far },
  ];
}
export function generateMap(def: MapDefinition, random: () => number): Tile[][] {
  const spawns = spawnPoints(def);
  if (def.wallDensity !== undefined) {
    const size = def.size;
    const candidates: Vec2[] = [];
    const tiles = Array.from({ length: size }, (_, z) =>
      Array.from({ length: size }, (_, x): Tile => {
        if (!x || !z || x === size - 1 || z === size - 1) return 1;
        if (spawns.some((s) => Math.abs(s.x - x) + Math.abs(s.z - z) <= 2)) return 0;
        const fixed = def.tileAt?.(x, z, size, random);
        if (fixed !== undefined) return fixed;
        candidates.push({ x, z });
        return 0;
      }),
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    let remaining = Math.round(candidates.length * def.wallDensity);
    for (const { x, z } of candidates) {
      if (remaining <= 0) break;
      if (placeWall(tiles, x, z)) remaining--;
    }
    for (const { x, z } of candidates) if (tiles[z][x] === 0 && random() < def.density) tiles[z][x] = 2;
    return tiles;
  }
  return Array.from({ length: def.size }, (_, z) =>
    Array.from({ length: def.size }, (_, x): Tile => {
      if (!x || !z || x === def.size - 1 || z === def.size - 1) return 1;
      if (spawns.some((s) => Math.abs(s.x - x) + Math.abs(s.z - z) <= 2))
        return x % 2 === 0 && z % 2 === 0 ? 1 : 0;
      const tile = def.tileAt?.(x, z, def.size, random);
      if (tile !== undefined) return tile;
      if (x % 2 === 0 && z % 2 === 0) return 1;
      return random() < def.density ? 2 : 0;
    }),
  );
}
/**
 * Turn an open interior cell into a permanent wall, unless that would box in a neighbour or split
 * the walkable area. Returns whether the wall was placed.
 */
export function placeWall(tiles: Tile[][], x: number, z: number) {
  const exits = DIRECTIONS.filter((d) => tiles[z + d.z][x + d.x] !== 1);
  if (exits.length < 3) return false;
  const previous = tiles[z][x];
  tiles[z][x] = 1;
  if (
    exits.some((d) => DIRECTIONS.filter((n) => tiles[z + d.z + n.z][x + d.x + n.x] !== 1).length < 2) ||
    !connectedAround(tiles, x, z, exits)
  ) {
    tiles[z][x] = previous;
    return false;
  }
  return true;
}
/**
 * Permanent walls that can change during a match (terrain reset, closing zone): the irregular ones
 * scattered by `wallDensity`. Tracked whether or not the map sets `wallShuffle`.
 * Borders and walls a map fixes through `tileAt` never move. Keys are cells, values stable ids.
 */
export function movableWalls(def: MapDefinition, tiles: readonly (readonly Tile[])[]) {
  if (def.wallDensity === undefined) return undefined;
  const walls: Record<number, number> = {};
  for (let z = 1; z < def.size - 1; z++)
    for (let x = 1; x < def.size - 1; x++)
      if (tiles[z][x] === 1 && def.tileAt?.(x, z, def.size, () => 0) !== 1)
        walls[z * def.size + x] = z * def.size + x;
  return walls;
}
// A new wall can only disconnect cells that previously met at this tile.
function connectedAround(tiles: Tile[][], x: number, z: number, exits: Vec2[]) {
  const size = tiles.length;
  const first = (z + exits[0].z) * size + x + exits[0].x;
  const targets = new Set(exits.slice(1).map((d) => (z + d.z) * size + x + d.x));
  const visited = new Uint8Array(size * size);
  const queue = [first];
  visited[first] = 1;
  for (let i = 0; i < queue.length && targets.size; i++) {
    const cell = queue[i];
    for (const d of DIRECTIONS) {
      const next = cell + d.z * size + d.x;
      if (visited[next] || tiles[Math.floor(next / size)][next % size] === 1) continue;
      visited[next] = 1;
      targets.delete(next);
      queue.push(next);
    }
  }
  return !targets.size;
}
export const cellKey = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
export { DIRECTIONS };
