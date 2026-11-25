import { defineSkill } from "../../sdk.js";
import config from "./config.js";

const LIVE = "detonator:live";

export default defineSkill(config, {
  // Thrown charges keep their own fuse; only planted ones answer the trigger.
  onTick(player, state) {
    player.moduleData[LIVE] = state.bombs.filter((b) => b.ownerId === player.id && !b.source).length;
  },
  canActivate: (player) => (player.moduleData[LIVE] ?? 0) > 0,
  aiCastPriority: () => 0,
  activate(player, state) {
    for (const bomb of state.bombs)
      if (bomb.ownerId === player.id && !bomb.source)
        bomb.detonateAt = Math.min(bomb.detonateAt, state.time + config.stats.delay);
  },
});
