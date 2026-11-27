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
  glow: { color: "#8fd4ff", intensity: 0.55 },
  explosion: new URL("./explosion.webp", import.meta.url).href,
});
