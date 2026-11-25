import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Assault",
  } },
  id: "hacksore", name: "突击手", order: 1, model: "auto",
  texture: new URL("./skin.png", import.meta.url).href,
});
