import type { Tile } from "./types";
import type { MapObstacle, ObstacleSurface } from "./obstacles";

export type { MapObstacle, ObstacleDefinition, ObstacleSurface } from "./obstacles";
export { defineObstacle } from "./obstacles";

interface Pack {
  translations?: import("../i18n").Translations;
  id: string;
  name: string;
  order?: number;
}
export interface SkinPack extends Pack {
  texture: string;
  model: "auto" | "default" | "slim";
  /** Square image with a transparent background, stencilled on crates this character builds. */
  emblem?: string;
}
export interface BombFinish extends Pack {
  colors: readonly [string, string, string];
  texture?: string;
  roughnessMap?: string;
  roughness?: number;
  metalness?: number;
  capColor?: string;
}
/** @deprecated Use {@link ObstacleSurface}. */
export type CoverSurface = ObstacleSurface;
/** @deprecated Use `obstacles: [{ use, weight }]`. `kind` is read as a preset ID. */
export type MapCover = { surface?: ObstacleSurface; weight: number } & (
  { kind: string } | { model: string; height?: number }
);
export interface MapDefinition extends Pack {
  subtitle: string;
  size: number;
  density: number;
  /** Fraction of eligible interior cells used for irregular permanent cover. */
  wallDensity?: number;
  /**
   * Fraction (0..1) of the irregular permanent walls that a terrain reset moves to new cells.
   * Needs `wallDensity`; borders and `tileAt` walls never move. Defaults to 0 (walls stay put).
   */
  wallShuffle?: number;
  /** Weighted pool of destructible obstacles. Defaults to the `storage` set. */
  obstacles?: readonly MapObstacle[];
  /** @deprecated Use `obstacles`. Read only when `obstacles` is absent. */
  covers?: readonly MapCover[];
  bgm?: string;
  artwork?: string;
  backdrop?: string;
  theme: "garden" | "midnight" | "rainforest";
  /** Cells between the boundary wall and each corner spawn. Defaults to 1, the corner itself. */
  spawnInset?: number;
  /**
   * Multiplier on the match length chosen in the room, for maps with many more rings to close.
   * Defaults to 1.
   */
  zoneScale?: number;
  /**
   * What the ground is made of at a cell: selects footsteps and, on natural maps, the ground
   * texture. Presentation only. Defaults to the theme's own floor.
   */
  groundAt?(x: number, z: number, size: number): GroundKind | undefined;
  /** Sky, fog and surface wetness. Presentation only; the simulation never reads it. Defaults to clear. */
  weather?: "clear" | "rain" | "monsoon";
  /** Return a tile to override the default interior layout. Borders and spawns stay protected. */
  tileAt?(x: number, z: number, size: number, random: () => number): Tile | undefined;
  /** Supply layout preferences for moving surviving cover. Borders, walls and occupied cells stay protected. */
  randomizeTerrain?(
    random: () => number,
    size: number,
  ): Partial<Pick<MapDefinition, "density" | "wallDensity" | "tileAt">>;
}

export type GroundKind = "slab" | "grass" | "mud" | "stone";
/** The ground under a cell of a map, with the theme's default where the map does not say. */
export const groundAt = (map: MapDefinition, x: number, z: number): GroundKind =>
  map.groundAt?.(Math.round(x), Math.round(z), map.size) ?? (map.theme === "rainforest" ? "grass" : "slab");

export const defineSkin = (config: SkinPack) => config;
export const defineFinish = (config: BombFinish) => config;
export const defineMap = (
  config: MapDefinition,
  layout: Pick<MapDefinition, "tileAt" | "randomizeTerrain" | "groundAt"> = {},
) => ({ ...config, ...layout });

export function indexPacks<T extends Pack>(packs: T[], category: string) {
  if (!packs.length) throw new Error(`Empty pack category: ${category}`);
  const result: Record<string, T> = Object.create(null);
  for (const pack of [...packs].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id, "en"),
  )) {
    if (!/^[a-z][a-z0-9-]*$/.test(pack.id) || pack.id === "custom" || result[pack.id])
      throw new Error(`Invalid or duplicate ${category} ID: ${pack.id}`);
    result[pack.id] = pack;
  }
  return Object.freeze(result);
}
