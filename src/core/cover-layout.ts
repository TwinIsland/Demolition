import { seededRandom } from "./maps";
import { resolveObstacles, type MapObstacle, type Obstacle } from "./obstacles";
import type { MapDefinition } from "./pack-api";

/** The obstacle pool of a map, with deprecated `covers` entries translated. */
export function mapObstacles(map: MapDefinition): Obstacle[] {
  const entries: readonly MapObstacle[] | undefined =
    map.obstacles ??
    map.covers?.map((cover) =>
      "kind" in cover
        ? { use: cover.kind, weight: cover.weight }
        : {
            model: cover.model,
            height: cover.height,
            surface: cover.surface,
            weight: cover.weight,
          },
    );
  return resolveObstacles(entries, map.id);
}

export const coverSurface = (cover: Obstacle) => cover.surface;

/** Keep each tile's appearance stable across previews and matches. */
export function coverLayout(map: MapDefinition, seed: number) {
  const pool = mapObstacles(map);
  const total = pool.reduce((sum, obstacle) => sum + obstacle.weight, 0);
  return (x: number, z: number) => {
    const fixed = map.obstacleAt?.(x, z, map.size),
      chosen = fixed && pool.find((obstacle) => obstacle.id === fixed.use);
    if (chosen) return { cover: chosen, rotation: ((fixed.turn ?? 0) * Math.PI) / 2 };
    const random = seededRandom(seed ^ Math.imul(x + z * map.size, 0x9e3779b1));
    let roll = random() * total;
    const cover = pool.find((obstacle) => (roll -= obstacle.weight) < 0) ?? pool[0];
    return { cover, rotation: (Math.floor(random() * 4) * Math.PI) / 2 };
  };
}
