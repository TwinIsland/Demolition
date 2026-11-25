/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: { en: {
    name: "Blast Surge",
    description: "Charges placed over the next 7 seconds gain two tiles of blast range.",
  } },
  id: "surge",
  name: "范围爆发",
  description: "7 秒内放置的炸药范围 +2 格",
  icon: "surge",
  key: "E",
  price: 30,
  cooldown: 16,
  duration: 7,
  order: 2,
  code: "KeyE",
  stats: { rangeBonus: 2 },
};

export default config;
