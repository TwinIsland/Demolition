/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: {
    en: {
      name: "Slide Kick",
      description:
        "Line up with a charge and keep pushing into it for a moment to kick it down an open lane. A charge you are still standing on is never kicked. Its fuse pauses until it hits cover, another charge, an operator, a zombie, or a blast.",
    },
  },
  id: "kick",
  name: "滑踢",
  description:
    "正对炸药并持续顶住片刻，即可沿畅通方向踢出；脚下刚放的炸药不会被踢走。滑行期间暂停引信，撞到障碍、其他炸药、选手、僵尸或爆炸时立即引爆。",
  icon: "speed",
  key: "被动",
  price: 35,
  cooldown: 0,
  duration: 0,
  order: 5,
  passive: true,
};

export default config;
