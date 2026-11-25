import { defineSkill } from "../../sdk.js";
import config from "./config.js";

const LEFT = "medic:left",
  HEALTH = "medic:health",
  UNTIL = "medic:until";

export default defineSkill(config, {
  aiCastPriority: (p) => (p.hp <= p.maxHp - 30 ? 3 : 0),
  canActivate: (player) => player.hp < player.maxHp,
  activeUntil: (p) => p.moduleData[UNTIL] ?? 0,
  activate(player, state, duration) {
    player.moduleData[LEFT] = config.stats.heal;
    player.moduleData[HEALTH] = player.hp;
    player.moduleData[UNTIL] = state.time + duration;
  },
  // Heals in whole points so health stays an integer. Any loss of health ends the treatment.
  onTick(player, state, dt) {
    const data = player.moduleData,
      left = data[LEFT] ?? 0;
    if (left <= 0) return;
    if (player.hp < data[HEALTH] || player.hp >= player.maxHp) {
      data[LEFT] = 0;
      data[UNTIL] = state.time;
      return;
    }
    const rate = config.stats.heal / config.duration;
    const spent = Math.min(left, rate * dt),
      before = Math.floor(config.stats.heal - left),
      after = Math.floor(config.stats.heal - (left - spent) + 1e-9);
    data[LEFT] = left - spent;
    player.hp = Math.min(player.maxHp, player.hp + (after - before));
    data[HEALTH] = player.hp;
  },
});
