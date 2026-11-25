import { defineMap } from "../../sdk.js";

export default defineMap({
  translations: { en: {
    name: "Warehouse",
    subtitle: "17 × 17 · Close quarters",
  } },
  id: "night-lab", name: "仓储区", subtitle: "17 × 17 · 近距离交战", order: 2,
  size: 17, density: 0.72, wallDensity: 0.27, theme: "midnight",
  bgm: new URL("./bgm.mp3", import.meta.url).href,
  artwork: new URL("./briefing.webp", import.meta.url).href,
  backdrop: new URL("./backdrop.webp", import.meta.url).href,
  covers: [
    {kind:"crate",weight:26},{kind:"drum",weight:13},{kind:"bags",weight:5},{kind:"press",weight:13},
    {kind:"hopper",weight:9},{kind:"valve",weight:13},{kind:"robot-arm",weight:9},{kind:"barricade",weight:12},
  ],
}, {
  randomizeTerrain(random, size) {
    const horizontal = random() < .5;
    const aisleA = 3 + Math.floor(random()*3);
    const aisleB = size - 4 - Math.floor(random()*3);
    return {
      tileAt(x,z) {
        const lane = horizontal ? z : x;
        if (lane === aisleA || lane === aisleB) return 0;
      },
    };
  },
  tileAt(x, z, size) {
    if (z === 5 || z === size - 6) return 0;
  },
});
