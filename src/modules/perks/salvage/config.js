/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Salvage",
      description: "Recover 3 HP for each piece of cover you destroy. Stacks.",
      tag: "Recovery",
    },
  },
  id: "salvage",
  name: "战地回收",
  description: "每摧毁一处掩体恢复 3 点血量，可叠加。",
  icon: "flask",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#9edbb0",
  tag: "续航",
  tier: "silver",
  order: 10,
  weight: 1,
  stats: { heal: 3 },
};

export default config;
