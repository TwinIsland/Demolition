import { defineMap } from "../../sdk.js";

// The pools and the columns are fixed, so every match has the same landmarks; the walls and the
// things left standing on the deck between them are generated from the match seed.
/** Columns stand on every fourth cell and carry the ceiling. */
const COLUMN_PITCH = 4;
/** Half-width of the centre pool: 2 makes it 5 x 5, with a column at each corner. */
const CENTRE_POOL = 2;
/** Distance of the four small pools from the middle, and their half-width. */
const SIDE_POOL = 4,
  SIDE_POOL_REACH = 1;

/** @type {(x: number, z: number, size: number) => boolean} */
function inWater(x, z, size) {
  if (x < 1 || z < 1 || x > size - 2 || z > size - 2) return false;
  const middle = (size - 1) / 2,
    dx = Math.abs(x - middle),
    dz = Math.abs(z - middle);
  // The centre pool, the two channels that cross in it, and a small pool in each quarter.
  return (
    Math.max(dx, dz) <= CENTRE_POOL ||
    dx === 0 ||
    dz === 0 ||
    (Math.abs(dx - SIDE_POOL) <= SIDE_POOL_REACH && Math.abs(dz - SIDE_POOL) <= SIDE_POOL_REACH)
  );
}

/** @type {(x: number, z: number, size: number) => 0 | 1 | undefined} */
function tileAt(x, z, size) {
  if (x % COLUMN_PITCH === 0 && z % COLUMN_PITCH === 0) return 1;
  // Water stays open: it is where the long sight lines are.
  if (inWater(x, z, size)) return 0;
}

export default defineMap(
  {
    translations: {
      en: {
        name: "Poolrooms",
        subtitle: "21 × 21 · Flooded tile halls",
      },
    },
    id: "poolrooms",
    name: "池核泳池",
    subtitle: "21 × 21 · 浅水瓷砖大厅",
    order: 3,
    size: 21,
    density: 0.72,
    wallDensity: 0.14,
    theme: "poolrooms",
    weather: "indoor",
    bgm: new URL("./bgm.mp3", import.meta.url).href,
    artwork: new URL("./briefing.webp", import.meta.url).href,
    backdrop: new URL("./backdrop.webp", import.meta.url).href,
    obstacles: [{ use: "set:poolrooms", weight: 1 }],
  },
  {
    tileAt,
    groundAt(x, z, size) {
      return inWater(x, z, size) ? "water" : "slab";
    },
    randomizeTerrain() {
      return { tileAt };
    },
  },
);
