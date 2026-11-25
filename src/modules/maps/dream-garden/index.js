import { defineMap } from "../../sdk.js";

export default defineMap({
  translations: { en: {
    name: "Outpost",
    subtitle: "19 × 19 · Standard arena",
  } },
  id: "dream-garden", name: "前哨基地", subtitle: "19 × 19 · 标准区域", order: 1,
  size: 19, density: 0.68, wallDensity: 0.24, theme: "garden",
  bgm: new URL("./bgm.mp3", import.meta.url).href,
  artwork: new URL("./briefing.webp", import.meta.url).href,
  backdrop: new URL("./backdrop.webp", import.meta.url).href,
  covers: [
    {kind:"crate",weight:19},{kind:"bags",weight:17},{kind:"drum",weight:10},
    {kind:"oak",weight:15},{kind:"pine",weight:13},{kind:"logs",weight:16},{kind:"barricade",weight:10},
  ],
}, {
  randomizeTerrain(random, size) {
    const middle = (size - 1) / 2;
    const clearingX = middle + Math.floor(random()*5) - 2;
    const clearingZ = middle + Math.floor(random()*5) - 2;
    return {
      tileAt(x,z) {
        if (x === clearingX || z === clearingZ || Math.hypot(x-clearingX,z-clearingZ) <= 2) return 0;
      },
    };
  },
  tileAt(x, z, size) {
    if (x === (size - 1) / 2 || z === (size - 1) / 2) return 0;
  },
});
