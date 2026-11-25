import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  aiCastPriority: p => p.hp <= p.maxHp - 30 ? 3 : 0,
  canActivate: player => player.hp < player.maxHp,
  activate(player) { player.hp = Math.min(player.maxHp, player.hp + config.stats.heal); },
});
