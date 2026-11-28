/** @satisfies {import("../../../core/module-api").BaseConfig} */
export default {
  id: "blast-reach",
  name: "辐射扩增",
  icon: "flask",
  art: new URL("./icon.webp", import.meta.url).href,
  description: "炸药爆炸范围 +1 格。",
  translations: { en: { name: "Blast Expansion", description: "+1 tile of charge blast range." } },
  stats: { range: 1, cap: 5 },
};
