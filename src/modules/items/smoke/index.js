import { defineItem } from "../../sdk.js";
import config from "./config.js";

export default defineItem(config, {
  dropWeight: (p, base) => base * (1 + .8*(1-p.hp/p.maxHp)) / (1 + (p.inventory[config.id] ?? 0)),
  onLand({ smoke }) { smoke(config.stats.duration, config.stats.radius); },
});
