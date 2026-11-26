import { definePerk } from "../../sdk.js";
import config from "./config.js";

const { delay, radius, power } = config.stats;
/** Tiles a bot keeps between itself and its own impact. */
const SAFE = radius + 1.5;

export default definePerk(config, {
  eligible: (p) => !p.perks.includes(config.id),
  aiPriority: () => 8,
  use: (_p, ctx) => (ctx.target ? (ctx.callStrike?.(ctx.target, { delay, radius, power }) ?? false) : false),
  // Aim at the sighted opponent with the most company, as long as the bot itself stands clear.
  aiTarget(p, s, contacts) {
    let best,
      bestScore = 0;
    for (const c of contacts) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < SAFE) continue;
      const score = contacts.filter((o) => Math.hypot(o.x - c.x, o.z - c.z) <= radius).length;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (!best) return undefined;
    const x = Math.max(1, Math.min(s.size - 2, Math.round(best.x))),
      z = Math.max(1, Math.min(s.size - 2, Math.round(best.z)));
    return { x, z };
  },
});
