import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: () => 7,
  eligible: (p) => !p.perks.includes(config.id),
  modifiers: {
    blastPierce: (value) => value + config.stats.pierce,
  },
});
