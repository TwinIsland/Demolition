import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  aiCastPriority: (p, time, contacts) => p.jammedUntil > time && !contacts.length ? 2 : 0,
  activeUntil: p => p.scanUntil,
  activate(player, state, duration) { player.scanUntil = state.time + duration; },
});
