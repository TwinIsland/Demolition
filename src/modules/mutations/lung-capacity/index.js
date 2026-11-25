import { defineMutation } from "../../sdk.js";
import config from "./config.js";

export default defineMutation(config, {
  apply(p) {
    p.maxStamina += config.stats.stamina;
    p.stamina = Math.min(p.maxStamina, p.stamina + config.stats.stamina);
  },
});
