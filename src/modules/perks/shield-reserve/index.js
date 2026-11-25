import { definePerk } from "../../sdk.js";
import config from "./config.js";

export default definePerk(config,{
  eligible:p => p.perks.filter(id => id === config.id).length < config.stats.maxStacks,
  onAcquire(p) { if (p.shield > 0) p.shield += config.stats.seconds; },
  modifiers:{"duration:shield":(value,p,stacks) => value+stacks*config.stats.seconds},
});
