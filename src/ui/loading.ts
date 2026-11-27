import { t, language } from "../i18n";
import type { GameSnapshot } from "../core/types";

const screen = document.querySelector<HTMLElement>("#loading-screen")!;
const app = document.querySelector<HTMLElement>("#app")!;
const title = screen.querySelector("h1")!;
const status = screen.querySelector<HTMLElement>(".loading-status span")!;
const output = screen.querySelector("output")!;
const meter = screen.querySelector("progress")!;
const item = screen.querySelector<HTMLElement>(".loading-item")!;
const itemNames: Record<string, string> = {
  Modules: "模组",
  Resources: "资源",
  Models: "模型",
  Map: "地图",
  Shaders: "着色器",
  Audio: "音频",
  Images: "图片",
  Fonts: "字体",
  "Interface assets": "界面素材",
  "Minimap artwork": "小地图素材",
};

function showItem(name: string) {
  const label = language === "zh" ? (itemNames[name] ?? name) : name;
  item.textContent = name ? `${language === "zh" ? "正在加载" : "Loading"} ${label}…` : "";
}
const chart = screen.querySelector("canvas")!;
const retry = screen.querySelector<HTMLButtonElement>("button")!;
retry.addEventListener("click", () => location.reload());

export function localizeDocument() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t("爆破前线");
  document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content =
    t("第一人称 3D 爆破竞技场，支持四人自由乱斗。");
  screen.ariaLabel = t("资源加载");
  meter.ariaLabel = t("资源加载进度");
  retry.textContent = t("重新加载");
  if (screen.dataset.stage === "startup") {
    title.textContent = t("爆破前线");
    status.textContent = t("正在载入");
  }
}
localizeDocument();
showItem("Modules");

export const loading = {
  show(mapName?: string) {
    screen.dataset.stage = mapName ? "deployment" : "startup";
    title.textContent = mapName ?? t("爆破前线");
    status.textContent = mapName ? t("部署中") : t("正在载入");
    chart.hidden = true;
    output.value = "";
    meter.removeAttribute("value");
    meter.hidden = false;
    retry.hidden = true;
    showItem(mapName ? "Map" : "Resources");
    app.inert = true;
    screen.hidden = false;
  },
  drawMap(state: Readonly<GameSnapshot>) {
    chart.width = chart.height = state.size;
    const ctx = chart.getContext("2d")!;
    state.tiles.forEach((row, z) =>
      row.forEach((tile, x) => {
        ctx.fillStyle = ["#28332c", "#889681", "#52664d"][tile];
        ctx.fillRect(x, z, 1, 1);
      }),
    );
    chart.hidden = false;
  },
  progress(done: number, total: number, name?: string) {
    if (name !== undefined) showItem(name);
    if (total <= 0) return;
    meter.max = total;
    meter.value = done;
    output.value = `${Math.floor((100 * done) / total)}%`;
  },
  hide() {
    app.inert = false;
    screen.hidden = true;
  },
  fail(error: unknown) {
    console.error("Game loading failed", error);
    app.inert = true;
    screen.hidden = false;
    status.textContent =
      error instanceof Error && /WebGL|mod|Mod/.test(error.message) ? error.message : t("载入失败");
    output.value = "";
    meter.hidden = true;
    showItem("");
    retry.hidden = false;
    retry.focus();
  },
};

// Give the loading screen a paint before building the next arena on the main thread.
export const afterPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
