import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Golden",
    },
  },
  id: "golden",
  name: "黄金",
  order: 5,
  colors: ["#ffe08a", "#f6c04d", "#d99a22"],
  capColor: "#ffd76a",
  model: new URL("./model.glb", import.meta.url).href,
  aura: {
    color: "#ffd76a",
    glow: 1,
    count: 14,
    size: 0.13,
    radius: 0.62,
    rise: 0.9,
    spread: 0.12,
    swirl: 1.5,
    speed: 0.5,
    opacity: 0.95,
    twinkle: 1,
  },
});
