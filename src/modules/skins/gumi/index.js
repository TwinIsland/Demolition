import { defineSkin } from "../../sdk.js";

export default defineSkin({
  id: "gumi", name: "GUMI", order: 5, model: "default",
  texture: new URL("./skin.png", import.meta.url).href,
});
