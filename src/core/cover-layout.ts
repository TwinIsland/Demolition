import { seededRandom } from "./maps";
import type { CoverSurface, MapCover, MapDefinition } from "./pack-api";

export function coverSurface(cover:MapCover):CoverSurface {
  if (cover.surface) return cover.surface;
  if (!("kind" in cover)) return "metal";
  switch (cover.kind) {
    case "bags": case "low-bags": return "soft";
    case "crate": case "logs": case "pallet": case "oak": case "pine": return "wood";
    default: return "metal";
  }
}

/** Keep each tile's appearance stable across previews and matches. */
export function coverLayout(map: MapDefinition, seed: number) {
  const pool = map.covers?.filter(c => Number.isFinite(c.weight) && c.weight > 0) ?? [];
  if (!pool.length) pool.push({kind:"crate",weight:3},{kind:"drum",weight:1},{kind:"bags",weight:1});
  const total = pool.reduce((sum, c) => sum + c.weight, 0);
  return (x: number, z: number) => {
    const random = seededRandom(seed ^ Math.imul(x + z * map.size, 0x9e3779b1));
    let roll = random() * total;
    const cover = pool.find(c => (roll -= c.weight) < 0) ?? pool[0];
    return { cover, rotation: Math.floor(random() * 4) * Math.PI / 2 };
  };
}
