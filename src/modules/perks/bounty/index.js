import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config, {
  modifiers: { crateScore: (value, p, stacks) => value + config.stats.points * stacks },
});
