import { defineMap } from "../../sdk.js";

export default defineMap(
  {
    translations: {
      en: {
        name: "Warehouse",
        subtitle: "17 × 17 · Close quarters",
      },
    },
    id: "night-lab",
    name: "仓储区",
    subtitle: "17 × 17 · 近距离交战",
    order: 2,
    size: 17,
    density: 0.72,
    wallShuffle: 0.5,
    wallDensity: 0.27,
    theme: "midnight",
    bgm: new URL("./bgm.mp3", import.meta.url).href,
    artwork: new URL("./briefing.webp", import.meta.url).href,
    backdrop: new URL("./backdrop.webp", import.meta.url).href,
    obstacles: [
      { use: "crate", weight: 22 },
      { use: "pallet", weight: 12 },
      { use: "drum", weight: 13 },
      { use: "barricade", weight: 10 },
      { use: "set:industrial", weight: 43 },
    ],
  },
  {
    randomizeTerrain(random, size) {
      const horizontal = random() < 0.5;
      const aisleA = 3 + Math.floor(random() * 3);
      const aisleB = size - 4 - Math.floor(random() * 3);
      return {
        tileAt(x, z) {
          const lane = horizontal ? z : x;
          if (lane === aisleA || lane === aisleB) return 0;
        },
      };
    },
    tileAt(x, z, size) {
      if (z === 5 || z === size - 6) return 0;
    },
  },
);
