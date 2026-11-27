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
  glow: { color: "#ffcf5a", intensity: 0.12 },
});
