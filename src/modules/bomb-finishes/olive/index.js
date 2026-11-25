import { defineFinish } from "../../sdk.js";

export default defineFinish({
  translations: { en: {
    name: "Field Olive",
  } },
  id: "olive", name: "野战橄榄", order: 3,
  colors: ["#687049", "#83934b", "#405438"],
  texture: new URL("./wrap.webp", import.meta.url).href,
  roughnessMap: new URL("./roughness.webp", import.meta.url).href,
  roughness: 0.96, metalness: 0.03, capColor: "#676a55",
});
