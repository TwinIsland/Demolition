import { defineMap } from "../../sdk.js";

// The partitions are fixed, so every match has the same rooms and doorways; the stray walls and
// the furniture left in the rooms are generated from the match seed.
//
// One quarter of the floor, seen from the middle cell: columns are 1 to 9 cells east of it, rows
// 0 to 9 cells south. The other three quarters are this one turned by 90, 180 and 270 degrees, so
// all four corners start with the same route to the middle.
//   # partition   _ kept clear (the middle room and the doorways)   . left to the match seed
const QUARTER = [
  "_.#..#...",
  "_._..#.#.",
  "..#..._#.",
  "###..#...",
  ".....#.##",
  ".._##....",
  "##.#..#_#",
  "....._#..",
  ".##_##...",
  ".........",
];

/** @type {(x: number, z: number, size: number) => 0 | 1 | undefined} */
function tileAt(x, z, size) {
  const middle = (size - 1) / 2;
  let dx = x - middle,
    dz = z - middle;
  if (!dx && !dz) return 0;
  // Turn the cell into the quarter the plan describes.
  while (dx < 1 || dz < 0) [dx, dz] = [dz, -dx];
  const mark = QUARTER[dz]?.[dx - 1];
  return mark === "#" ? 1 : mark === "_" ? 0 : undefined;
}

export default defineMap(
  {
    translations: {
      en: {
        name: "Backrooms",
        subtitle: "21 × 21 · Yellow rooms without end",
      },
    },
    id: "backrooms",
    name: "后室",
    subtitle: "21 × 21 · 没有尽头的黄色房间",
    order: 4,
    size: 21,
    density: 0.62,
    wallDensity: 0.09,
    // Every stray wall moves when the rooms shift; the partitions and doorways never do.
    wallShuffle: 1,
    // No warning: the rooms are simply somewhere else.
    terrainShift: { every: 32, warning: 0 },
    theme: "backrooms",
    weather: "office",
    bgm: new URL("./bgm.mp3", import.meta.url).href,
    artwork: new URL("./briefing.webp", import.meta.url).href,
    backdrop: new URL("./backdrop.webp", import.meta.url).href,
    obstacles: [{ use: "set:backrooms", weight: 1 }],
  },
  {
    tileAt,
    groundAt() {
      return "carpet";
    },
    randomizeTerrain() {
      return { tileAt };
    },
  },
);
