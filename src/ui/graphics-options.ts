import { GRAPHICS_PRESETS, type GraphicsPreset, type GraphicsSettings } from "../render/graphics-settings";

import { keyHint } from "./control-settings";
import { language, t } from "../i18n";
export function languageSelect() {
  return `<label class="language-setting">${t("语言")}<select name="language" data-language aria-label="${t("语言")}">
    <option value="en" lang="en" ${language === "en" ? "selected" : ""}>English</option>
    <option value="zh" lang="zh-CN" ${language === "zh" ? "selected" : ""}>简体中文</option>
  </select></label>`;
}
export const graphicsForm = () => `<h2>${t("设置")}</h2><form id="graphics-form">
  ${languageSelect()}
  <label>${t("画质预设")}<select name="preset"><option value="performance">${t("性能")}</option><option value="balanced">${t("均衡")}</option><option value="high">${t("高画质")}</option><option value="custom" disabled>${t("自定义")}</option></select></label>
  <label>${t("渲染比例")}<select name="scale"><option value="0.7">70%</option><option value="0.85">85%</option><option value="1">100%</option></select></label>
  <label>${t("动态阴影")}<select name="shadows"><option value="off">${t("关闭")}</option><option value="medium">${t("中")}</option><option value="high">${t("高")}</option></select></label>
  <label>${t("环境光遮蔽")}<input type="checkbox" name="occlusion"></label>
  <label>${t("胶片颗粒")}<input type="checkbox" name="grain"></label>
  </form><div class="graphics-footer"><span>${keyHint("performance")} ${t("性能面板")}</span><button class="primary" id="graphics-done">${t("完成")}</button></div>`;

export function syncGraphics(form: HTMLFormElement, value: GraphicsSettings) {
  const preset = Object.entries(GRAPHICS_PRESETS).find(([,p]) => p.scale === value.scale && p.shadows === value.shadows && p.occlusion === value.occlusion && p.grain === value.grain);
  form.querySelector<HTMLSelectElement>('[name="preset"]')!.value = preset?.[0] ?? "custom";
  form.querySelector<HTMLSelectElement>('[name="scale"]')!.value = String(value.scale);
  form.querySelector<HTMLSelectElement>('[name="shadows"]')!.value = value.shadows;
  form.querySelector<HTMLInputElement>('[name="occlusion"]')!.checked = value.occlusion;
  form.querySelector<HTMLInputElement>('[name="grain"]')!.checked = value.grain;
}
export function graphicsChange(form: HTMLFormElement, name: string): GraphicsSettings {
  const data = new FormData(form);
  if (name === "preset") return {...GRAPHICS_PRESETS[data.get("preset") as GraphicsPreset]};
  return {scale:Number(data.get("scale")), shadows:data.get("shadows") as GraphicsSettings["shadows"],
    occlusion:data.has("occlusion"), grain:data.has("grain")};
}
