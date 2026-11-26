/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Field Crate",
      description:
        "Right-click to build a wooden crate on the aimed tile instantly for 20 coins. Reaches as far as a planted charge.",
    },
  },
  id: "crate",
  name: "木箱",
  description: "右键花 20 金币在瞄准的格子瞬间搭建木箱，范围和放炸药一样。",
  icon: "crate",
  color: "#c9a26b",
  model: new URL("./model.glb", import.meta.url).href,
  // Construction reference only: never carried, dropped or sold as equipment.
  weight: 0,
  order: 9,
  pool: "supply",
};

export default config;
