import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Military Camo",
    },
  },
  id: "camo",
  name: "军用迷彩",
  order: 6,
  colors: ["#8a8f63", "#73794f", "#5b603d"],
  capColor: "#8a8f63",
  model: new URL("./model.glb", import.meta.url).href,
  aura: {
    color: "#9a9a78",
    glow: 0,
    count: 10,
    size: 0.66,
    radius: 0.5,
    rise: 0.55,
    spread: 0.55,
    swirl: 0.25,
    speed: 0.22,
    opacity: 0.26,
  },
});
