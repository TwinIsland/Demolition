import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: {
    en: {
      name: "Scout",
    },
  },
  id: "scout",
  name: "侦察兵",
  order: 3,
  model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
  emblem: new URL("./emblem.svg", import.meta.url).href,
});
