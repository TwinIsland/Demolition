import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Goku",
  } },
  id: "goku", name: "孙悟空", order: 7, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
