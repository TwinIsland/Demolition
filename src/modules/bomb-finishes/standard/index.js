import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Classic Copper",
    },
  },
  id: "standard",
  name: "经典赤铜",
  order: 1,
  colors: ["#963b2c", "#8c5723", "#49354d"],
  texture: new URL("./wrap.webp", import.meta.url).href,
  roughnessMap: new URL("./roughness.webp", import.meta.url).href,
  roughness: 0.66,
  metalness: 0.28,
  capColor: "#826856",
});
