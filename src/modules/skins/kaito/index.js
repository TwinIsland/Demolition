import { defineSkin } from "../../sdk.js";

export default defineSkin({
  id: "kaito", name: "KAITO", order: 4, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
