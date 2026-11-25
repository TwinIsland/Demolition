/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Slide Kick",
      description: "Push against a charge to kick it. Its fuse pauses while sliding; impact detonates it.",
    },
  },
  id: "kick",
  name: "滑踢",
  description: "顶住炸药即可踢出，滑行时暂停引信，碰撞即爆",
  icon: "speed",
  key: "被动",
  price: 35,
  cooldown: 0,
  duration: 0,
  order: 5,
  passive: true,
};

export default config;
