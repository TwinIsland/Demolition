import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  onAcquire(p) { p.cooldowns.surge = 0; },
  modifiers: {
    bombRange(value, p, stacks, time) {
      return p.surgeUntil > time ? value + stacks * config.stats.bonus : value;
    },
  },
});
