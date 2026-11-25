/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: { en: {
    name: "Second Wind",
    description: "Recover stamina 25% faster per stack. Up to 3 stacks.",
    tag: "Mobility",
  } },
  id: "second-wind", name: "快速回气", description: "每层使体力恢复速度提高 25%，最多三层。",
  icon: "recover", color: "#bdcad4", tag: "机动", tier: "silver",
  order: 15, weight: 1, stats: { bonus: .25, maxStacks: 3 },
};

export default config;
