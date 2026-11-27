import { definePerk, linkedBombs } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: (p) => !p.perks.includes(config.id),
  aiPriority: () => 7,
  // Nothing linked would waste the perk, so the button stays grey until a path joins up.
  canUse: (p, s) => linkedBombs(s, p.id).length > 0,
  use: (_p, ctx) => (ctx.seizeLinkedBombs?.() ?? 0) > 0,
  // Worth it for a chain of two, or for any linked charge once the bot is hurt.
  aiShouldUse(p, s) {
    const linked = linkedBombs(s, p.id).length;
    return linked >= 2 || (linked >= 1 && p.hp < p.maxHp * 0.5);
  },
});
