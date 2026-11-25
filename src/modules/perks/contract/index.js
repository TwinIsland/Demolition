import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: () => 3,
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  modifiers: {
    coinGain: (value, player, stacks) =>
      value * (1 + config.stats.bonus * Math.min(stacks, config.stats.maxStacks)),
  },
});
