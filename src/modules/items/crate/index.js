import { defineItem } from "../../sdk.js";
import config from "./config.js";

export default defineItem(config, {
  // The unit is spent when the windup starts and handed back if the build is interrupted.
  onUse: (player, context) => context?.build?.() ?? false,
});
