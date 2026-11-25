import { defineSkill, inTacticalView } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  isActive: inTacticalView,
  canActivate: (player,time) => (player.forcedViewUntil ?? 0) <= time,
  activate(player, state) { player.tacticalView = !inTacticalView(player,state.time); },
});
