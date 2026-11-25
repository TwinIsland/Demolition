import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: p => p.hp < p.maxHp * .8 ? 8 : 4,
  onCoverDestroyed(p, stacks) { p.hp = Math.min(p.maxHp, p.hp + config.stats.heal * stacks); },
});
