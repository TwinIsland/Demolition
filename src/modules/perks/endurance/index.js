import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: (p) => p.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  modifiers: { staminaRegen: (base, p, stacks) => base * (1 + config.stats.regenBonus * stacks) },
  onAcquire(p) {
    p.maxStamina += config.stats.amount;
    p.stamina = Math.min(p.maxStamina, p.stamina + config.stats.amount);
  },
});
