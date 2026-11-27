import { definePerk } from "../../sdk.js";
import config from "./config.js";

const { radius } = config.stats;
/**
 * Other operators' live charges within reach of `p`.
 * @param {Readonly<import("../../../core/types").Player>} p
 * @param {Readonly<import("../../../core/types").GameSnapshot>} s
 */
const inReach = (p, s) =>
  s.bombs.filter((b) => b.ownerId !== p.id && Math.hypot(b.x - p.x, b.z - p.z) <= radius);

export default definePerk(config, {
  eligible: (p) => !p.perks.includes(config.id),
  aiPriority: () => 7,
  // Nothing to take would waste the perk, so the button stays grey until a charge is in reach.
  canUse: (p, s) => inReach(p, s).length > 0,
  use: (_p, ctx) => (ctx.seizeBombs?.(radius) ?? 0) > 0,
  // Worth it for a cluster, or for a single charge that is about to go off beside a hurt bot.
  aiShouldUse(p, s) {
    const bombs = inReach(p, s);
    return (
      bombs.length >= 2 ||
      (p.hp < p.maxHp * 0.5 && bombs.some((b) => Math.hypot(b.x - p.x, b.z - p.z) <= b.range + 0.5))
    );
  },
});
