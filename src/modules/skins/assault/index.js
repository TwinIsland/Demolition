import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: {
    en: {
      name: "Assault",
    },
  },
  id: "assault",
  name: "突击手",
  order: 2,
  model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
  emblem: new URL("./emblem.svg", import.meta.url).href,
});
