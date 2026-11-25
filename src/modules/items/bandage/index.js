import { defineItem } from "../../sdk.js";
import config from "./config.js";

export default defineItem(config, {
  dropWeight: (p, base) => (base * (0.65 + 2.6 * (1 - p.hp / p.maxHp))) / (1 + (p.inventory.bandage ?? 0)),
  aiPickupValue: (p) => 16 + 22 * (1 - p.hp / p.maxHp),
  onUse(p) {
    if (p.hp >= p.maxHp) return false;
    p.hp = Math.min(p.maxHp, p.hp + config.stats.heal);
    return true;
  },
});
