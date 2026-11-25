import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  onAcquire(p) { p.cooldowns.jam = 0; },
  modifiers: { "duration:jam": (value, p, stacks) => value + config.stats.seconds * stacks },
});
