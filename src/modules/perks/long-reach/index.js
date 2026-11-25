import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  aiPriority: (p) => (p.perks.includes(config.id) ? 4 : 9),
  modifiers: { placementRadius: (value, p, stacks) => value + config.stats.reach * stacks },
});
