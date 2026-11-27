import { defineMap } from "../../sdk.js";
import { SIZE, featureAt, groundAt, obstacleAt, tileAt } from "./layout.js";

// The village the story plays on: Flatland at 15 × 15, a fixed layout. The full 21 × 21 village
// (`../flatland`) is the one matches are fought on. See `layout.js` for the plan and for the
// cells the story script refers to by name.
export default defineMap(
  {
    translations: {
      en: {
        name: "Flatland",
        subtitle: "15 × 15 · Starter village",
      },
    },
    id: "flatland-story",
    name: "平面国",
    subtitle: "15 × 15 · 新手村",
    order: 10,
    // Only the story stages a match here.
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
