import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Vegeta",
  } },
  id: "vegeta", name: "贝吉塔", order: 8, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
