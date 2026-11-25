import { definePerk } from "../../sdk.js";
import config from "./config.js";

/** @param {{ hp: number, maxHp: number }} p */
const cornered = (p) => p.hp <= p.maxHp * config.stats.threshold;

export default definePerk(config, {
  aiPriority: (p) => (cornered(p) ? 9 : 4),
  eligible: (p) => !p.perks.includes(config.id),
  modifiers: {
    moveSpeed: (value, player) => (cornered(player) ? value * config.stats.speed : value),
    bombPower: (value, player) => (cornered(player) ? value * config.stats.power : value),
  },
});
