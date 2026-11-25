import type { Tile } from "./types";

interface Pack {
  translations?: import("../i18n").Translations;
  id: string;
  name: string;
  order?: number;
}
export interface SkinPack extends Pack {
  texture: string;
  model: "auto" | "default" | "slim";
}
export interface BombFinish extends Pack {
  colors: readonly [string, string, string];
  texture?: string;
  roughnessMap?: string;
  roughness?: number;
  metalness?: number;
  capColor?: string;
}
export type CoverKind = "crate" | "drum" | "bags" | "low-bags" | "pallet" | "oak" | "pine" | "logs" | "press" | "hopper" | "valve" | "robot-arm" | "barricade";
export type CoverSurface = "wood" | "metal" | "soft";
export type MapCover = {
  surface?: CoverSurface;
  weight: number;
  /** @deprecated Cover always blocks the whole tile, including during a jump. */
  vaultHeight?: number;
} & ({kind: CoverKind} | {model: string; height?: number});
export interface MapDefinition extends Pack {
  subtitle: string;
  size: number;
  density: number;
  /** Fraction of eligible interior cells used for irregular permanent cover. */
  wallDensity?: number;
  covers?: readonly MapCover[];
  bgm?: string;
  artwork?: string;
  backdrop?: string;
  theme: "garden" | "midnight";
  /** Return a tile to override the default interior layout. Borders and spawns stay protected. */
  tileAt?(x: number, z: number, size: number, random: () => number): Tile | undefined;
  /** Supply layout preferences for moving surviving cover. Borders, walls and occupied cells stay protected. */
  randomizeTerrain?(random: () => number, size: number): Partial<Pick<MapDefinition,"density"|"wallDensity"|"tileAt">>;
}

export const defineSkin = (config: SkinPack) => config;
export const defineFinish = (config: BombFinish) => config;
export const defineMap = (config: MapDefinition, layout: Pick<MapDefinition, "tileAt"|"randomizeTerrain"> = {}) =>
  ({ ...config, ...layout });

export function indexPacks<T extends Pack>(packs: T[], category: string) {
  if (!packs.length) throw new Error(`Empty pack category: ${category}`);
  const result: Record<string,T> = Object.create(null);
  for (const pack of [...packs].sort((a,b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id,"en"))) {
    if (!/^[a-z][a-z0-9-]*$/.test(pack.id) || pack.id === "custom" || result[pack.id])
      throw new Error(`Invalid or duplicate ${category} ID: ${pack.id}`);
    result[pack.id] = pack;
  }
  return Object.freeze(result);
}
