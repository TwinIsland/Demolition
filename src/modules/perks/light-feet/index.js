import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: p => p.speed < 3 ? 8 : 3,
  eligible: p => p.speed < config.stats.cap,
  onAcquire(p) {
    if (p.speed < config.stats.cap) p.speed = Math.min(config.stats.cap, p.speed * config.stats.amount);
  },
});
