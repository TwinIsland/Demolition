/** @satisfies {import("../../../core/module-api").BaseConfig} */
export default {
  id: "lung-capacity",
  name: "肺活量强化",
  icon: "stamina",
  art: new URL("./icon.webp", import.meta.url).href,
  description: "体力上限 +25，并补充 25 点体力。",
  translations: { en: { name: "Lung Capacity", description: "+25 maximum stamina and restore 25 stamina." } },
  stats: { stamina: 25 },
};
