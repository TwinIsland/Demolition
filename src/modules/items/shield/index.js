import { defineItem } from "../../sdk.js";
import config from "./config.js";

export default defineItem(config, {
  dropWeight: (p, base) =>
    (base * (1 + 1.8 * (1 - p.hp / p.maxHp))) / (1 + Number(p.shield > 0) + (p.inventory[config.id] ?? 0)),
  aiPickupValue: (p) => (p.shield ? 14 : 25),
  onUse(p, ctx) {
    if (p.shield > 0) return false;
    p.shield = ctx?.stat("duration:shield", config.stats.duration) ?? config.stats.duration;
    return true;
  },
});
