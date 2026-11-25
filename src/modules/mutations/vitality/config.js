/** @satisfies {import("../../../core/module-api").BaseConfig} */
export default {
  id: "vitality",
  name: "生命突破",
  icon: "heart",
  description: "生命上限 +25，并恢复 40 点生命。",
  translations: { en: { name: "Vitality Breakthrough", description: "+25 maximum HP and recover 40 HP." } },
  stats: { health: 25, heal: 40 },
};
