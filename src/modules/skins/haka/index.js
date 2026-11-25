import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Scout",
  } },
  id: "haka", name: "侦察兵", order: 2, model: "auto",
  texture: new URL("./skin.png", import.meta.url).href,
});
