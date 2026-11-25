/** @satisfies {import("../../../core/module-api").SkillConfig} */
const config = {
  translations: { en: {
    name: "Slide Kick",
    description: "Move against a nearby charge or step off one to kick it down an open lane. Its fuse pauses until it hits cover, another charge, an operator, a zombie, or a blast.",
  } },
  id: "kick",
  name: "滑踢",
  description: "贴近炸药或站在炸药上时，朝畅通的方向移动即可踢出。滑行期间暂停引信，撞到障碍、其他炸药、选手、僵尸或爆炸时立即引爆。",
  icon: "speed",
  key: "被动",
  price: 35,
  cooldown: 0,
  duration: 0,
  order: 5,
  passive: true,
};

export default config;
