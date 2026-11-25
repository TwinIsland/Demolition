import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  aiCastPriority: (p, time, contacts) => contacts.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 5) ? 1 : 0,
  activate(player, state, duration) {
    const until = state.time + duration;
    for (const enemy of state.players) {
      if (enemy.alive && enemy.id !== player.id)
        enemy.jammedUntil = Math.max(enemy.jammedUntil, until);
    }
  },
});
