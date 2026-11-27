/** @satisfies {import("../../../core/module-api").ItemConfig} */
const config = {
  translations: {
    en: {
      name: "Field Crate",
      description:
        "Right-click to build a wooden crate on the aimed tile instantly. Costs no coins: you carry a stock set by your level, refilled on every level-up, and destroying another operator's crate adds one to it. Reaches as far as a planted charge.",
    },
  },
  id: "crate",
  name: "木箱",
  description: "右键在瞄准的格子瞬间搭建木箱，不花金币：按等级携带固定数量，每次升级补满，摧毁别人的木箱还能给自己加一个。范围和放炸药一样。",
  icon: "crate",
  color: "#c9a26b",
  model: new URL("./model.glb", import.meta.url).href,
  // Construction reference only: never carried, dropped or sold as equipment.
  weight: 0,
  order: 9,
  pool: "supply",
};

export default config;
