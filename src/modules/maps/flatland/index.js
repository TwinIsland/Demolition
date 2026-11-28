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
    // Listed in the room's map list, where it stays locked until the story is finished
    // (story/unlocks.ts).
    size: SIZE,
    // Every cell comes from the plan: nothing is scattered.
    density: 0,
    wallDensity: 0,
    theme: "village",
    weather: "spring",
    artwork: new URL("./briefing.webp", import.meta.url).href,
    backdrop: new URL("./backdrop.webp", import.meta.url).href,
    // The last fight of the story; the jukebox on the plaza plays the rest of its soundtrack.
    bgm: "./assets/story/kenka-no-bannin.mp3",
    obstacles: [
      { use: "set:village", weight: 100 },
      // Only where the plan asks for a crate.
      { use: "village-crate", weight: 0.001 },
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
