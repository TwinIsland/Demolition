import { defineMap } from "../../sdk.js";
import { SIZE, featureAt, groundAt, obstacleAt, tileAt } from "./layout.js";

// The starter village of the story: a fixed layout, the same in every match. See `layout.js` for
// the plan, and for the cells the story script refers to by name.
export default defineMap(
  {
    translations: {
      en: {
        name: "Flatland",
        subtitle: "21 × 21 · Starter village",
      },
    },
    id: "flatland",
    name: "平面国",
    subtitle: "21 × 21 · 新手村",
    order: 9,
    // Reached from the story; it has no cover art for the room's map list yet.
    hidden: true,
    size: SIZE,
    // Every cell comes from the plan: nothing is scattered.
    density: 0,
    wallDensity: 0,
    theme: "village",
    weather: "spring",
    obstacles: [
      { use: "set:village", weight: 70 },
      { use: "crate", weight: 18 },
      { use: "logs", weight: 12 },
      // Only where the plan asks for a fence.
      { use: "wood-fence", weight: 0.001 },
    ],
  },
  {
    tileAt,
    groundAt,
    featureAt,
    obstacleAt,
    randomizeTerrain() {
      return { tileAt };
    },
  },
);
