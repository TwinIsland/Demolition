/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Shaped Charge",
      description:
        "Increase attack power by 15 per stack, up to 3 stacks. Your charge bundle and blast warning change with power.",
      tag: "Damage",
    },
  },
  id: "shaped-charge",
  name: "强化装药",
  description: "每层攻击力 +15，最多 3 层。炸药束与地面预警纹理随威力升级。",
  icon: "target",
  color: "#f6a36b",
  tag: "伤害强化",
  tier: "gold",
  order: 1,
  weight: 1,
  stats: { amount: 15, maxStacks: 3 },
};

export default config;
