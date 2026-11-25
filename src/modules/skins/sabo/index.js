import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Sabo",
  } },
  id: "sabo", name: "萨博", order: 9, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
