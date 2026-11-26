import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  // Break contact when hurt, or slip in close for an ambush.
  aiCastPriority(p, time, contacts) {
    if (!contacts.length) return 0;
    if (p.hp < p.maxHp * 0.6) return 3;
    return contacts.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 5) ? 1.5 : 0;
  },
  activeUntil: (p) => p.cloakUntil ?? 0,
  activate(player, state, duration) {
    player.cloakUntil = state.time + duration;
  },
});
