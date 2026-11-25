import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: {
    en: {
      name: "Sapper",
    },
  },
  id: "sapper",
  name: "爆破手",
  order: 1,
  model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
  emblem: new URL("./emblem.svg", import.meta.url).href,
});
