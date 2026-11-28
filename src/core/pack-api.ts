import type { Tile } from "./types";
import type { MapObstacle, ObstacleSurface } from "./obstacles";

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
  /**
   * A skin the story hands out: it stays out of the pickers until the ending named here ("home"
   * or "stay") has been reached. See story/shutdown/unlocks.ts.
   */
  reward?: string;
}
export interface BombFinish extends Pack {
  colors: readonly [string, string, string];
  texture?: string;
  roughnessMap?: string;
  roughness?: number;
  metalness?: number;
  capColor?: string;
  /**
   * GLB that replaces the standard charge: a bundle lying along X with its base at y = 0. Such a
   * finish shows no power tiers or owner collar; `colors` still tint the interface.
   */
  model?: string;
  /**
   * Makes the lit parts of a modelled finish shine: the colour texture doubles as the emissive
   * mask, tinted by `color`. `intensity` is around 0.3 (faint) to 1 (strong).
   */
  glow?: { color: string; intensity: number };
  /**
   * Flipbook shown in place of the standard detonation when a bomb with this finish goes off:
   * a square image with alpha holding 4 x 4 frames, read left to right and top to bottom.
   */
  explosion?: string;
}
/** @deprecated Use {@link ObstacleSurface}. */
export type CoverSurface = ObstacleSurface;
/** @deprecated Use `obstacles: [{ use, weight }]`. `kind` is read as a preset ID. */
type MapCover = { surface?: ObstacleSurface; weight: number } & (
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
  /**
   * The map rearranges itself without anyone asking: every `every` seconds it announces a terrain
   * reset and carries it out `warning` seconds later (default 4; 0 moves at once, unannounced). Needs `randomizeTerrain`; set
   * `wallShuffle` as well for walls to move.
   */
  terrainShift?: { every: number; warning?: number };
  /** Weighted pool of destructible obstacles. Defaults to the `storage` set. */
  obstacles?: readonly MapObstacle[];
  /** @deprecated Use `obstacles`. Read only when `obstacles` is absent. */
  covers?: readonly MapCover[];
  bgm?: string;
  /** Loudness of `bgm` against the other maps' tracks. Defaults to 1. */
  bgmGain?: number;
  artwork?: string;
  backdrop?: string;
  /**
   * Square top-down ground painting drawn under the radar's walls and contacts. Bundled maps need
   * no entry: a `minimap.webp` beside `index.js` is picked up. Defaults to a drawn surface.
   */
  minimap?: string;
  theme: "garden" | "midnight" | "rainforest" | "poolrooms" | "backrooms" | "village";
  /**
   * Left out of the room's map list: the map is only reached from somewhere else, such as a
   * chapter of the story.
   */
  hidden?: boolean;
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
  /**
   * Sky, fog and surface wetness, `indoor` for a lit hall with wet floors and no sky, or `office`
   * for a dim windowless floor with damp carpet, `spring` for a dry sunny morning with a low sun.
   * Presentation only; the simulation never reads it.
   * Defaults to clear.
   */
  weather?: "clear" | "rain" | "monsoon" | "indoor" | "office" | "spring";
  /**
   * Names the landmark standing on a permanent wall cell, boundary included, for themes that draw
   * more than one kind of wall. What the names mean is up to the theme. Presentation only.
   */
  featureAt?(x: number, z: number, size: number): string | undefined;
  /**
   * The obstacle a destructible cell always shows, as a preset ID from the map's own pool, turned
   * by `turn` quarter circles. Cells it leaves out draw from the weighted pool. Presentation and
   * strike sounds only.
   */
  obstacleAt?(x: number, z: number, size: number): { use: string; turn?: number } | undefined;
  /** Return a tile to override the default interior layout. Borders and spawns stay protected. */
  tileAt?(x: number, z: number, size: number, random: () => number): Tile | undefined;
  /** Supply layout preferences for moving surviving cover. Borders, walls and occupied cells stay protected. */
  randomizeTerrain?(
    random: () => number,
    size: number,
  ): Partial<Pick<MapDefinition, "density" | "wallDensity" | "tileAt">>;
}

export type GroundKind = "slab" | "grass" | "mud" | "stone" | "water" | "carpet";
/** The ground under a cell of a map, with the theme's default where the map does not say. */
export const groundAt = (map: MapDefinition, x: number, z: number): GroundKind =>
  map.groundAt?.(Math.round(x), Math.round(z), map.size) ??
  (map.theme === "rainforest" || map.theme === "village"
    ? "grass"
    : map.theme === "backrooms"
      ? "carpet"
      : "slab");

export const defineSkin = (config: SkinPack) => config;
export const defineFinish = (config: BombFinish) => config;
export const defineMap = (
  config: MapDefinition,
  layout: Pick<MapDefinition, "tileAt" | "randomizeTerrain" | "groundAt" | "featureAt" | "obstacleAt"> = {},
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
