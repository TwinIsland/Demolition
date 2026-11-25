import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: {
    en: {
      name: "Engineer",
    },
  },
  id: "engineer",
  name: "工兵",
  order: 5,
  model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
  emblem: new URL("./emblem.svg", import.meta.url).href,
});
