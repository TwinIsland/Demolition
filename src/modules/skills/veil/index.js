import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  // Worth casting when someone is close enough to walk into a blast they cannot read.
  aiCastPriority: (p, time, contacts) => (contacts.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 6) ? 2 : 0),
  activeUntil: (p) => p.veilUntil ?? 0,
  activate(player, state, duration) {
    player.veilUntil = state.time + duration;
    // Charges already on the ground go dark as well.
    for (const bomb of state.bombs) if (bomb.ownerId === player.id) bomb.concealed = true;
  },
  modifiers: {
    bombConcealed: (value, player, stacks, time) => ((player.veilUntil ?? 0) > time ? 1 : value),
  },
});
