/** @satisfies {import("../../../core/module-api").PerkConfig} */
const config = {
  translations: {
    en: {
      name: "Bounty Contract",
      description: "Earn 40% more coins per stack, up to 2 stacks.",
      tag: "Economy",
    },
  },
  id: "contract",
  name: "悬赏令",
  description: "每层获得的金币 +40%，最多 2 层。",
  icon: "crown",
  art: new URL("./icon.webp", import.meta.url).href,
  color: "#e9cf7a",
  tag: "经济",
  tier: "silver",
  order: 23,
  weight: 1,
  stats: { bonus: 0.4, maxStacks: 2 },
};

export default config;
