import { defineSkill } from "../../sdk.js";
import config from "./config.js";

export default defineSkill(config, {
  onBombContact(kick) {
    kick();
  },
});
