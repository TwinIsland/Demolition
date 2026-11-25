import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: p => !p.perks.includes(config.id),
  canUse: (_p,s) => !s.terrainReset,
  aiPriority: p => p.hp < p.maxHp * .6 ? 9 : 5,
  use: (_p, ctx) => ctx.requestTerrainReset?.(config.stats.delay) ?? false,
  aiShouldUse: (p, s) => !s.terrainReset && (p.hp < p.maxHp * .45 ||
    s.bombs.some(b => b.ownerId !== p.id && Math.hypot(p.x-b.x,p.z-b.z) < 2.5)),
});
