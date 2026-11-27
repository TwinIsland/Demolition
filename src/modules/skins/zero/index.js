import { defineSkin } from "../../sdk.js";

// A reward of story mode: a copy of the texture in src/story/assets/skins; the pickers show it once the
// "stay" ending has been reached.
export default defineSkin({
  translations: {
    en: {
      name: "Zero",
    },
  },
  id: "zero",
  name: "零",
  order: 90,
  model: "default",
  reward: "stay",
  texture: new URL("./skin.png", import.meta.url).href,
});
