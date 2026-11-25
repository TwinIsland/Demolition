import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: {
    en: {
      name: "Arctic White",
    },
  },
  id: "arctic",
  name: "极地白",
  order: 2,
  colors: ["#d0dedf", "#98bfcc", "#52728b"],
  texture: new URL("./wrap.webp", import.meta.url).href,
  roughnessMap: new URL("./roughness.webp", import.meta.url).href,
  roughness: 0.77,
  metalness: 0.12,
  capColor: "#869398",
});
