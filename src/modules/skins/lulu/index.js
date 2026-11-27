import { defineSkin } from "../../sdk.js";

// A reward of story mode: a copy of the texture in src/story/assets/skins; the pickers show it once the
// "home" ending has been reached.
export default defineSkin({
  translations: {
    en: {
      name: "Lulu",
    },
  },
  id: "lulu",
  name: "露露",
  order: 91,
  model: "default",
  reward: "home",
  texture: new URL("./skin.png", import.meta.url).href,
});
