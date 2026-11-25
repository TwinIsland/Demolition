import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: (p) => !p.perks.includes(config.id),
  canUse: (p, s) => !s.arenaView && (p.forcedViewUntil ?? 0) <= s.time,
  use: (_p, ctx) => ctx.forceArenaView?.(config.stats.duration, config.stats.warningSeconds) ?? false,
  aiPriority: () => 8,
  aiShouldUse: (p, s) =>
    !s.arenaView &&
    (p.forcedViewUntil ?? 0) <= s.time &&
    s.players.some(
      (other) => other.alive && other.id !== p.id && Math.hypot(other.x - p.x, other.z - p.z) < 6,
    ),
});
