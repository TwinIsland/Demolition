import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Cyberpunk",
    },
  },
  id: "cyberpunk",
  name: "赛博朋克",
  order: 7,
  colors: ["#ff4fd8", "#b65cff", "#35e8ff"],
  capColor: "#35e8ff",
  model: new URL("./model.glb", import.meta.url).href,
  aura: {
    color: "#ff3fd0",
    color2: "#35e8ff",
    glow: 0.9,
    count: 14,
    size: 0.2,
    radius: 0.6,
    rise: 0.7,
    spread: 0.2,
    swirl: 1.1,
    speed: 0.7,
    opacity: 0.85,
    twinkle: 0.8,
  },
});
