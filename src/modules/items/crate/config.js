/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Field Crate",
      description: "Right-click to build a wooden crate ahead instantly for 25 coins.",
    },
  },
  id: "crate",
  name: "木箱",
  description: "右键花 25 金币在面前瞬间搭建木箱。",
  icon: "crate",
  color: "#c9a26b",
  model: new URL("./model.glb", import.meta.url).href,
  // Construction reference only: never carried, dropped or sold as equipment.
  weight: 0,
  order: 9,
  pool: "supply",
};

export default config;
