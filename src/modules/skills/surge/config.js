/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Blast Surge",
      description: "Charges placed over the next 5 seconds gain two tiles of blast range.",
    },
  },
  id: "surge",
  name: "范围爆发",
  description: "5 秒内放置的炸药范围 +2 格",
  icon: "surge",
  key: "Q",
  price: 30,
  cooldown: 18,
  duration: 5,
  order: 2,
  code: "KeyQ",
  stats: { rangeBonus: 2 },
};

export default config;
