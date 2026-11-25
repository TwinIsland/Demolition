import { defineMutation } from "../../sdk.js";
import config from "./config.js";

export default defineMutation(config,{
  apply(p) {
    p.maxHp += config.stats.health;
    p.hp = p.maxHp;
  },
});
