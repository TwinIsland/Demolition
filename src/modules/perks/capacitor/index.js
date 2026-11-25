import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: () => 8,
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  modifiers: { cooldown: (value, p, stacks) => value * config.stats.factor ** stacks },
});
