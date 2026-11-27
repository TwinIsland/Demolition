import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Frost Crystal",
    },
  },
  id: "frost",
  name: "寒冰结晶",
  order: 3,
  colors: ["#bfe6ff", "#8fcfff", "#5aa9ee"],
  capColor: "#9fdcff",
  model: new URL("./model.glb", import.meta.url).href,
  aura: {
    color: "#9fdcff",
    glow: 0.55,
    count: 12,
    size: 0.62,
    radius: 0.55,
    rise: -0.05,
    spread: 0.75,
    swirl: 0.35,
    speed: 0.32,
    opacity: 0.34,
  },
});
