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
  glow: { color: "#9dff45", intensity: 1 },
});
