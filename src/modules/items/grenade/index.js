import { defineItem } from "../../sdk.js";
import config from "./config.js";

export default defineItem(config, {
  dropWeight: (p, base) => base / (1 + (p.inventory[config.id] ?? 0)),
  onLand({ explode }) {
    explode(config.throwable.blastRange, config.throwable);
  },
});
