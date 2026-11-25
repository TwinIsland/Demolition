import { version } from "../../package.json";
import { MAPS, generateMap, seededRandom } from "../core/maps";
import { DEFAULT_MODE, MATCH_MODES, type MatchMode } from "../core/match-modes";
import { BOMB_STYLES, SKINS, type Appearance } from "../core/room";
import { field, t } from "../i18n";
import type { SkinModel } from "../render/minecraft-skins";
import type { UIActions } from "./actions";
import { query } from "./dom";
import { icon } from "./icons";

const MODE_IDS = Object.keys(MATCH_MODES) as MatchMode[];
/** Tile colours of the map thumbnails, indexed by tile kind. */
const MINIATURE_COLORS = ["#303a33", "#b2baa6", "#737e64"];
/** Fixed seed so a map's thumbnail looks the same on every visit. */
const MINIATURE_SEED = 74691;

const options = (packs: Record<string, { name: string }>) =>
  Object.entries(packs)
    .map(([id, pack]) => `<option value="${id}">${pack.name}</option>`)
    .join("");

const modeButton = (id: MatchMode) => {
  const { available, name } = MATCH_MODES[id];
  return `<button type="button" data-mode="${id}" aria-pressed="${id === DEFAULT_MODE}" ${available ? "" : 'disabled title="尚未开放"'}>${available ? "" : icon("lock")}${name}</button>`;
};

const lobbyMarkup = () => `
        <div class="lobby-scrim"></div>
        <div class="deployment-layout">
        <section class="hero">
          <div class="mode-picker">
            <div class="mode-list" role="group" aria-label="对局模式" style="--mode-count:${MODE_IDS.length}">
              ${MODE_IDS.map(modeButton).join("")}
            </div>
            <h1 aria-label="${MATCH_MODES[DEFAULT_MODE].name}">${MODE_IDS.map((id) => `<span data-mode-title="${id}" aria-hidden="true" class="${id === DEFAULT_MODE ? "current" : ""}">${MATCH_MODES[id].name}</span>`).join("")}</h1>
          </div>
          <div class="skin-controls outfit-controls">
            <label for="avatar-preset">角色皮肤</label><select id="avatar-preset">${options(SKINS)}<option value="custom" disabled>自定义 PNG</option></select>
            <button id="skin-import">导入 PNG</button><input id="skin-file" type="file" accept="image/png" hidden/>
            <div class="arm-setting" hidden><label for="skin-model">自定义手臂</label><select id="skin-model"><option value="auto">自动识别</option><option value="default">标准 · Steve</option><option value="slim">纤细 · Alex</option></select></div>
            <label for="bomb-style">炸药涂装</label><select id="bomb-style">${options(BOMB_STYLES)}</select>
            <small id="skin-status" role="status"></small>
          </div>
          <button class="start-btn" id="start">${icon("play")} 开始对局 <kbd>ENTER</kbd></button>
        </section>
        <div id="lobby-avatar" tabindex="0" role="group" aria-label="角色预览，可拖动或按方向键旋转"></div>
        <section class="map-selection" aria-label="作战区域"><div class="section-caption"><span>作战区域</span><button id="terrain-preview" aria-pressed="false">战场预览</button></div><div class="map-options">${MAPS.map((map, i) => `<button class="map-option ${i === 0 ? "selected" : ""}" data-map="${map.id}" aria-pressed="${i === 0}"><canvas class="map-miniature" width="${map.size}" height="${map.size}" aria-hidden="true"></canvas><span><b>${map.name}</b><small>${map.size} × ${map.size}</small></span><i class="selection-dot"></i></button>`).join("")}</div></section>
        </div>
        <footer class="design-credit"><span class="credit-line" lang="en">Game Design by <a href="https://tianyihuang.com" target="_blank" rel="noopener noreferrer">TwinIsland</a></span><span>v${version}</span></footer>
      `;

/** Deployment screen: mode, outfit and map selection around the avatar preview. */
export class LobbyView {
  private readonly skinPreset: HTMLSelectElement;
  private readonly customSkinOption: HTMLOptionElement;
  private readonly skinFile: HTMLInputElement;
  private readonly skinModel: HTMLSelectElement;
  private readonly armSetting: HTMLElement;
  private readonly skinStatus: HTMLElement;
  private readonly bombStyle: HTMLSelectElement;
  private readonly terrainButton: HTMLButtonElement;
  private readonly listeners = new AbortController();

  constructor(
    readonly root: HTMLElement,
    private readonly actions: Pick<UIActions, "changeOutfit" | "importSkin">,
  ) {
    root.innerHTML = lobbyMarkup();
    this.skinPreset = query<HTMLSelectElement>(root, "#avatar-preset");
    this.customSkinOption = query<HTMLOptionElement>(this.skinPreset, '[value="custom"]');
    this.skinFile = query<HTMLInputElement>(root, "#skin-file");
    this.skinModel = query<HTMLSelectElement>(root, "#skin-model");
    this.armSetting = query(root, ".arm-setting");
    this.skinStatus = query(root, "#skin-status");
    this.bombStyle = query<HTMLSelectElement>(root, "#bomb-style");
    this.terrainButton = query<HTMLButtonElement>(root, "#terrain-preview");
    this.drawMiniatures();
    root.addEventListener("change", (event) => void this.onChange(event.target), {
      signal: this.listeners.signal,
    });
  }

  /** `customSkin` reports whether a PNG has been imported and with which arm model. */
  setAppearance(value: Appearance, customSkin: { imported: boolean; model?: SkinModel }) {
    if (value.skin === "custom" || customSkin.imported) this.customSkinOption.disabled = false;
    if (customSkin.model) this.skinModel.value = customSkin.model;
    this.skinPreset.value = value.skin;
    this.armSetting.hidden = value.skin !== "custom";
    this.bombStyle.value = value.bombStyle;
  }

  setMatchMode(mode: MatchMode) {
    query(this.root, ".mode-list").style.setProperty("--selected", String(MODE_IDS.indexOf(mode)));
    query(this.root, ".mode-picker h1").setAttribute("aria-label", t(MATCH_MODES[mode].name));
    for (const title of this.root.querySelectorAll<HTMLElement>("[data-mode-title]"))
      title.classList.toggle("current", title.dataset.modeTitle === mode);
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-mode]"))
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  }

  setTerrainPreview(active: boolean) {
    this.terrainButton.setAttribute("aria-pressed", String(active));
    this.terrainButton.textContent = active ? t("返回部署界面") : t("战场预览");
  }

  setMap(id: string) {
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-map]")) {
      button.classList.toggle("selected", button.dataset.map === id);
      button.setAttribute("aria-pressed", String(button.dataset.map === id));
    }
  }

  openSkinPicker() {
    this.skinFile.click();
  }

  /** Re-renders pack-provided names, which the static shell copy table does not cover. */
  refreshLanguage() {
    for (const option of this.skinPreset.options)
      if (SKINS[option.value]) option.textContent = field(SKINS[option.value], "name");
    for (const option of this.bombStyle.options)
      option.textContent = field(BOMB_STYLES[option.value], "name");
    for (const map of MAPS) query(this.root, `[data-map="${map.id}"] b`).textContent = field(map, "name");
  }

  dispose() {
    this.listeners.abort();
  }

  private drawMiniatures() {
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-map]")) {
      const map = MAPS.find((m) => m.id === button.dataset.map)!;
      if (map.artwork) {
        const art = document.createElement("img");
        art.className = "map-art";
        art.alt = "";
        art.src = map.artwork;
        button.prepend(art);
      }
      const context = query<HTMLCanvasElement>(button, "canvas").getContext("2d")!;
      generateMap(map, seededRandom(MINIATURE_SEED)).forEach((row, z) =>
        row.forEach((cell, x) => {
          context.fillStyle = MINIATURE_COLORS[cell];
          context.fillRect(x, z, 1, 1);
        }),
      );
    }
  }

  private async onChange(target: EventTarget | null) {
    if (target === this.skinPreset) {
      this.actions.changeOutfit({ skin: this.skinPreset.value });
      this.armSetting.hidden = this.skinPreset.value !== "custom";
      this.skinStatus.textContent = "";
    } else if (target === this.bombStyle) {
      this.actions.changeOutfit({ bombStyle: this.bombStyle.value });
    } else if (target === this.skinFile || target === this.skinModel) {
      // Changing the arm model re-imports the stored PNG, so no file is passed.
      const file = target === this.skinFile ? this.skinFile.files?.[0] : undefined;
      this.skinStatus.textContent = t("加载中");
      try {
        await this.actions.importSkin(file, this.skinModel.value as SkinModel);
        this.skinStatus.textContent = file ? file.name : t("模型已更新");
      } catch (error) {
        this.skinStatus.textContent = error instanceof Error ? error.message : t("皮肤加载失败");
      }
      if (target === this.skinFile) this.skinFile.value = "";
    }
  }
}
