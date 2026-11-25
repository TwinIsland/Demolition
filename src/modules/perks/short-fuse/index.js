import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: () => 5,
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  modifiers: {
    bombFuse: (base, player, stacks) =>
      base * (1 - config.stats.rate * Math.min(stacks, config.stats.maxStacks)),
  },
});
