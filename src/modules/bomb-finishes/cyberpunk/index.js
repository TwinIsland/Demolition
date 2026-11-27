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
  glow: { color: "#ffffff", intensity: 1 },
  explosion: new URL("./explosion.webp", import.meta.url).href,
});
