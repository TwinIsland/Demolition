import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: p => p.attack < 125 ? 8 : 4,
  eligible: p => p.attack < config.stats.cap,
  onAcquire(p) { p.attack = Math.max(p.attack, Math.min(config.stats.cap, p.attack * config.stats.factor)); },
});
