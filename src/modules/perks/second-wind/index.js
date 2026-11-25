import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: p => p.perks.filter(id => id === config.id).length < config.stats.maxStacks,
  modifiers: { staminaRegen: (base, p, stacks) => base * (1 + config.stats.bonus * stacks) },
});
