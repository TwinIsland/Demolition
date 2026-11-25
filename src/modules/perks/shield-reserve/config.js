/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Shield Reserve",
    description: "Extend tactical shields by 1 second per stack. Up to 3 stacks.",
    tag: "Survival",
  } },
  id:"shield-reserve", name:"护盾续航", description:"护盾持续时间延长 1 秒，最多 3 层。",
  icon:"shield", color:"#80cce4", tag:"生存强化", tier:"gold", weight:1, order:17,
  stats:{seconds:1,maxStacks:3},
};

export default config;
