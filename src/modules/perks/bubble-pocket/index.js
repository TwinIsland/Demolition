import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: (p) => (p.capacity < 3 ? 7 : 2),
  eligible: (p) => p.capacity < config.stats.cap,
  onAcquire(p) {
    p.capacity = Math.min(config.stats.cap, p.capacity + config.stats.amount);
  },
});
