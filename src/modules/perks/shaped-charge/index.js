import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: (p) => (p.attack < 100 ? 8 : 5),
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  onAcquire(p) {
    p.attack += config.stats.amount;
  },
});
