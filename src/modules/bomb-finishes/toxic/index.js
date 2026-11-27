import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Toxic Biohazard",
    },
  },
  id: "toxic",
  name: "剧毒生化",
  order: 4,
  colors: ["#b6ff5a", "#8dea3c", "#5cc21e"],
  capColor: "#7dff5a",
  model: new URL("./model.glb", import.meta.url).href,
  aura: {
    color: "#86ff4d",
    glow: 0.35,
    count: 12,
    size: 0.5,
    radius: 0.4,
    rise: 1.15,
    spread: 0.3,
    swirl: 0.9,
    speed: 0.4,
    opacity: 0.36,
  },
});
