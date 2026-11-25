import { defineMutation } from "../../sdk.js";
import config from "./config.js";

export default defineMutation(config,{
  apply(p) {
    p.attack += config.stats.power;
  },
});
