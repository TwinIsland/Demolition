import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: (p) => (p.hp < p.maxHp * 0.7 ? 10 : 5),
  onAcquire(p) {
    p.maxHp += config.stats.health;
    p.hp = Math.min(p.maxHp, p.hp + config.stats.health);
  },
});
