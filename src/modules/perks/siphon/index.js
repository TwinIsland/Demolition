import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: () => 9,
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  onDamageDealt(p, damage, stacks) {
    p.hp = Math.min(p.maxHp, p.hp + Math.round(damage * config.stats.fraction * stacks));
  },
});
