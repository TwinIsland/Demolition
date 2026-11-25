import { defineMutation } from "../../sdk.js";
import config from "./config.js";

export default defineMutation(config, {
  eligible: (p) => p.speed < config.stats.cap,
  apply(p) {
    p.speed = Math.min(config.stats.cap, p.speed + config.stats.step);
  },
});
