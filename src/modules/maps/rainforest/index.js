import { defineMap } from "../../sdk.js";

// The layout below is fixed, so every match has the same landmarks; walls and cover between
// them are generated from the match seed.
const TEMPLE = 4;
/**
 * Row of the creek at column `x`: a meander that crosses the map from corner to corner.
 * @type {(x: number, middle: number) => number}
 */
const creekRow = (x, middle) => middle + 8 * Math.sin((x - middle) * 0.22) + (x - middle) * 0.3;
/** @type {(x: number, z: number, middle: number) => boolean} */
const onCreek = (x, z, middle) => Math.abs(z - creekRow(x, middle)) < 0.85;
/** @type {(x: number, z: number, middle: number) => boolean} */
const onTrail = (x, z, middle) => x === middle || z === middle;

/** @type {(x: number, z: number, size: number) => 0 | 1 | undefined} */
function tileAt(x, z, size) {
  const middle = (size - 1) / 2,
    dx = Math.abs(x - middle),
    dz = Math.abs(z - middle),
    ring = Math.max(dx, dz);
  // Temple ruins: a walled plaza with a three-cell gate on each side and four pillars inside.
  if (ring === TEMPLE) return dx >= 2 && dz >= 2 ? 1 : 0;
  if (ring < TEMPLE) return dx === 2 && dz === 2 ? 1 : 0;
  if (ring === TEMPLE + 1) return 0;
  if (onTrail(x, z, middle) || onCreek(x, z, middle)) return 0;
}

export default defineMap(
  {
    translations: {
      en: {
        name: "Rainforest",
        subtitle: "31 × 31 · Large jungle arena",
      },
    },
    id: "rainforest",
    name: "雨林",
    subtitle: "31 × 31 · 大型丛林战场",
    order: 1.5,
    size: 31,
    density: 0.6,
    wallDensity: 0.2,
    theme: "rainforest",
    weather: "monsoon",
    spawnInset: 7,
    zoneScale: 5 / 3,
    bgm: new URL("./bgm.mp3", import.meta.url).href,
    artwork: new URL("./briefing.webp", import.meta.url).href,
    backdrop: new URL("./backdrop.webp", import.meta.url).href,
    obstacles: [
      { use: "set:rainforest", weight: 80 },
      { use: "crate", weight: 12 },
      { use: "logs", weight: 8 },
    ],
  },
  {
    tileAt,
    groundAt(x, z, size) {
      const middle = (size - 1) / 2;
      if (Math.max(Math.abs(x - middle), Math.abs(z - middle)) <= TEMPLE) return "stone";
      if (x > 0 && z > 0 && x < size - 1 && z < size - 1 && (onTrail(x, z, middle) || onCreek(x, z, middle)))
        return "mud";
      return "grass";
    },
    randomizeTerrain() {
      return { tileAt };
    },
  },
);
