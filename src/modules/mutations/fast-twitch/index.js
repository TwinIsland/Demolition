import { defineMutation } from "../../sdk.js";
import config from "./config.js";

export default defineMutation(config,{
  apply(p) {
    p.speed += config.stats.step;
  },
});
