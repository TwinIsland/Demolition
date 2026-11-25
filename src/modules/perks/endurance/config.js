/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Endurance",
    description: "Gain 25 max stamina and immediately recover 25 stamina per stack. Up to 3 stacks.",
    tag: "Mobility",
  } },
  id: "endurance", name: "耐力储备", description: "每层增加 25 点体力上限，并立即补充 25 点体力，最多三层。",
  icon: "stamina", color: "#bdcad4", tag: "机动", tier: "silver",
  order: 16, weight: 1, stats: { amount: 25, maxStacks: 3 },
};

export default config;
