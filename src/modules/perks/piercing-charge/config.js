/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Piercing Charge",
      description:
        "Your blasts break through one destructible obstacle and keep going. Permanent walls still stop them. Does not stack.",
      tag: "Breach",
    },
  },
  id: "piercing-charge",
  name: "穿甲装药",
  description: "部署的炸药可炸穿一处可破坏掩体后继续延伸，不可摧毁的墙体仍会挡住爆炸。不可叠加。",
  icon: "target",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#9fc4f2",
  tag: "破障",
  tier: "diamond",
  order: 24,
  weight: 1,
  stats: { pierce: 1 },
};

export default config;
