import { defineSkin } from "../../sdk.js";

export default defineSkin({
  translations: { en: {
    name: "Naruto Uzumaki",
  } },
  id: "naruto", name: "漩涡鸣人", order: 6, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
