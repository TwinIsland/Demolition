import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Hatsune Miku",
  } },
  id: "hatsune-miku", name: "初音未来", order: 3, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
