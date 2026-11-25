import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: (p) => (p.hp < p.maxHp * 0.6 ? 12 : 3),
  eligible: (p) => p.hp < p.maxHp || p.shield < config.stats.duration,
  onAcquire(p, ctx) {
    p.hp = Math.min(p.maxHp, p.hp + config.stats.heal);
    p.shield = Math.max(
      p.shield,
      ctx?.stat("duration:shield", config.stats.duration) ?? config.stats.duration,
    );
  },
});
