/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: { en: {
    name: "Radar Jam",
    description: "Jam every opponent’s radar for 6 seconds.",
  } },
  id: "jam",
  name: "雷达干扰",
  description: "干扰所有对手的雷达 6 秒",
  icon: "radar",
  key: "Q",
  price: 25,
  cooldown: 22,
  duration: 6,
  order: 1,
  code: "KeyQ",
};

export default config;
