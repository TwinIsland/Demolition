import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: (p) => (p.range < 4 ? 8 : 2),
  eligible: (p) => p.range < config.stats.cap,
  onAcquire(p) {
    if (p.range < config.stats.cap) p.range = Math.min(config.stats.cap, p.range + config.stats.amount);
  },
});
