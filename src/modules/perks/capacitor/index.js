import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  aiPriority: () => 8,
  modifiers: { cooldown: (value, p, stacks) => value * config.stats.factor ** stacks },
});
