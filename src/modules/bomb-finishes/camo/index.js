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
  // The C4 panel was modelled on the back.
  spin: Math.PI,
  explosion: new URL("./explosion.webp", import.meta.url).href,
});
