import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  eligible: (player) => player.perks.filter((id) => id === config.id).length < config.stats.maxStacks,
  modifiers: {
    blastDuration: (base, player, stacks) => base + stacks * config.stats.seconds,
  },
});
