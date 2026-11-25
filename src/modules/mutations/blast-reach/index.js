import { defineMutation } from "../../sdk.js";
import config from "./config.js";

export default defineMutation(config, {
  eligible: (p) => p.range < config.stats.cap,
  apply(p) {
    p.range = Math.min(config.stats.cap, p.range + config.stats.range);
  },
});
