import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  activeUntil: p => p.surgeUntil,
  activate(player, state, duration) {
    player.surgeUntil = state.time + duration;
  },
  modifiers: {
    bombRange(value, player, stacks, time) {
      return player.surgeUntil > time ? value + config.stats.rangeBonus : value;
    },
  },
});
