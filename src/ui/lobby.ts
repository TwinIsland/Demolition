import { version } from "../../package.json";
import { MAPS, ROOM_MAPS, generateMap, seededRandom } from "../core/maps";
import { DEFAULT_MODE, MATCH_MODES, type MatchMode } from "../core/match-modes";
import {
  BOMB_STYLES,
  DEFAULT_FINISH,
  DEFAULT_KNIFE_STYLE,
  DEFAULT_SKIN,
  SKINS,
  type Appearance,
} from "../core/room";
import { KNIFE_STYLES } from "../core/knife-styles";
import { field, t } from "../i18n";
import type { SkinModel } from "../render/minecraft-skins";
import type { UIActions } from "./actions";
import { creditsLabel } from "./credits";
import { query } from "./dom";
import { icon } from "./icons";
import { rise, rowsIn, rowsOut, settle, slideIn, wipe } from "./lobby-motion";
import { StoryMenu, storyChrome, storyPanels } from "./lobby-story";

/**
 * The menu shows one panel at a time. Each top-level tab has a root panel (`home` for versus,
 * `story` for the story) and the other panels are sub-menus of one of the two.
 */
type View = "home" | "mode" | "map" | "outfit" | "story";
type SubView = Exclude<View, "home" | "story">;
type Tab = "versus" | "story";

const TABS: Record<Tab, { label: string; root: View }> = {
  versus: { label: "对战", root: "home" },
  story: { label: "故事模式", root: "story" },
};
const tabOf = (view: View): Tab => (view === "story" ? "story" : "versus");
const isRoot = (view: View) => TABS[tabOf(view)].root === view;

const MODE_IDS = Object.keys(MATCH_MODES) as MatchMode[];
const VIEW_TITLES: Record<SubView, string> = {
  mode: "对局模式",
  map: "作战区域",
  outfit: "干员外观",
};
const MODE_NOTES: Record<MatchMode, string> = {
  freeForAll: "标准规则。第一人称放置炸药，最后存活的干员获胜。",
  classic: "标准数值，全程俯视视角进行整场对局。",
  practice: "没有时间压力，可以不带 AI 对手单独进场，熟悉地图与技能。",
  carnival: "全员强化开局：生命、攻击与爆炸范围大幅提高，强化来得更快，脱战自动回血。",
};
const ARM_MODELS: readonly [SkinModel, string][] = [
  ["auto", "自动识别"],
  ["default", "标准 · Steve"],
  ["slim", "纤细 · Alex"],
];
/** Tile colours of the map thumbnails, indexed by tile kind. */
const MINIATURE_COLORS = ["#303a33", "#b2baa6", "#737e64"];
/** Fixed seed so a map's thumbnail looks the same on every visit. */
const MINIATURE_SEED = 74691;

const openRow = (view: SubView) =>
  `<button type="button" class="menu-row" data-open="${view}"><span class="row-label">${VIEW_TITLES[view]}</span><span class="row-value" data-value="${view}"></span><i class="row-arrow"></i></button>`;

const modeRow = (id: MatchMode) => {
  const { available } = MATCH_MODES[id];
  return `<button type="button" class="menu-row menu-choice" data-mode="${id}" aria-pressed="false" ${available ? "" : 'disabled title="尚未开放"'}>${available ? "" : icon("lock")}<span class="row-label"></span><i class="row-check"></i></button>`;
};

const tile = (attribute: string, id: string) =>
  `<button type="button" class="menu-row menu-tile menu-choice" data-${attribute}="${id}" aria-pressed="false"><span class="row-label"></span></button>`;

const lobbyMarkup = () => `
        <div class="lobby-scrim"></div>${storyChrome()}
        <div class="menu-wipe" aria-hidden="true"></div>
        <nav class="menu-tabs" aria-label="主菜单">${(Object.keys(TABS) as Tab[])
          .map(
            (tab) =>
              `<button type="button" class="menu-tab" data-tab="${tab}" aria-pressed="false">${TABS[tab].label}</button>`,
          )
          .join("")}</nav>
        <section class="menu-nav">
          <header class="menu-head">
            <div class="menu-crumb"><button type="button" class="menu-back" data-back hidden><i class="row-arrow"></i><span>返回</span><kbd>ESC</kbd></button><small class="menu-kicker"></small></div>
            <h1 class="menu-title"></h1>
          </header>
          <div class="menu-panels">
            <nav class="menu-panel" data-panel="home" aria-label="主菜单">
              ${openRow("mode")}${openRow("map")}${openRow("outfit")}
              <button class="start-btn menu-play" id="start">${icon("play")}<span>开始对局</span><kbd>ENTER</kbd></button>
            </nav>
            <nav class="menu-panel" data-panel="mode" aria-label="对局模式" hidden>
              ${MODE_IDS.map(modeRow).join("")}
            </nav>
            <nav class="menu-panel" data-panel="map" aria-label="作战区域" hidden>
              ${ROOM_MAPS.map((map) => `<button type="button" class="menu-row menu-choice" data-map="${map.id}" aria-pressed="false"><span class="row-label"></span><span class="row-value">${map.size} × ${map.size}</span><i class="row-check"></i></button>`).join("")}
            </nav>
            <nav class="menu-panel" data-panel="outfit" aria-label="干员外观" hidden>
              <div class="menu-caption">角色皮肤</div>
              <div class="menu-grid">${Object.keys(SKINS)
                .map((id) => tile("skin", id))
                .join("")}${tile("skin", "custom")}</div>
              <button type="button" class="menu-row menu-tile" id="skin-import"><span class="row-label">导入 PNG</span><i class="row-arrow"></i></button><input id="skin-file" type="file" accept="image/png" hidden/>
              <div class="arm-setting" hidden><div class="menu-caption">自定义手臂</div><div class="menu-grid three">${ARM_MODELS.map(([id]) => tile("arm", id)).join("")}</div></div>
              <small id="skin-status" role="status"></small>
              <div class="menu-caption">炸药涂装</div>
              <div class="menu-grid three">${Object.keys(BOMB_STYLES)
                .map((id) => tile("finish", id))
                .join("")}</div>
              <div class="menu-caption">小刀皮肤</div>
              <div class="menu-grid three">${Object.values(KNIFE_STYLES)
                .map(
                  (knife) =>
                    `<button type="button" class="menu-row menu-tile menu-choice knife-tile" data-knife="${knife.id}" aria-pressed="false"><span class="row-label"></span></button>`,
                )
                .join("")}</div>
            </nav>${storyPanels()}
          </div>
        </section>
        <div id="lobby-avatar" tabindex="0" role="group" aria-label="角色预览，可拖动或按方向键旋转"></div>
        <aside class="menu-detail">
          <button type="button" class="detail-art" data-open="map" aria-label="作战区域">${ROOM_MAPS.map(
            (map) =>
              `${map.artwork ? `<img data-art="${map.id}" src="${map.artwork}" alt="">` : ""}<canvas class="detail-miniature" data-miniature="${map.id}" width="${map.size}" height="${map.size}" aria-hidden="true"></canvas>`,
          ).join("")}</button>
          <div class="detail-body">
            <small class="detail-kicker"></small>
            <h2 class="detail-title"></h2>
            <p class="detail-text"></p>
            <dl class="detail-stats"></dl>
          </div>
          <button type="button" id="terrain-preview" aria-pressed="false">战场预览</button>
        </aside>
        <footer class="menu-footer">
          <div class="menu-hints"><span><kbd>ENTER</kbd><span class="hint-versus">开始对局</span><span class="hint-story">进入故事</span></span><span class="hint-back"><kbd>ESC</kbd><span>返回</span></span></div>
          <div class="design-credit"><span class="credit-line" lang="en">Game Design by <a href="https://tianyihuang.com" target="_blank" rel="noopener noreferrer">TwinIsland</a></span><button type="button" id="credits" class="credit-open">${creditsLabel()}</button><span>v${version}</span></div>
        </footer>
      `;

/**
 * Main menu: a list on the left that swaps between the home panel and its sub-menus (mode, map,
 * operator), the avatar preview in the middle and a detail card on the right. Sizes come from the
 * `--u` design unit (see styles/lobby.css), so the layout scales as one piece with the window.
 */
export class LobbyView {
  private view: View = "home";
  private mode: MatchMode = DEFAULT_MODE;
  private mapId = MAPS[0].id;
  private look: Appearance = {
    skin: DEFAULT_SKIN.id,
    bombStyle: DEFAULT_FINISH.id,
    knifeStyle: DEFAULT_KNIFE_STYLE,
  };
  private armModel: SkinModel = "auto";
  /** Row under the pointer or focus in a sub-menu; the detail card shows it before it is chosen. */
  private hovered?: string;
  /** What the detail card last showed, so it only animates when its subject changes. */
  private detailKey = "";

  private readonly title: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly backButton: HTMLButtonElement;
  private readonly detail: HTMLElement;
  private readonly skinFile: HTMLInputElement;
  private readonly skinStatus: HTMLElement;
  private readonly armSetting: HTMLElement;
  private readonly terrainButton: HTMLButtonElement;
  private readonly story: StoryMenu;
  private readonly listeners = new AbortController();

  constructor(
    readonly root: HTMLElement,
    private readonly actions: Pick<UIActions, "changeOutfit" | "importSkin" | "openStory">,
  ) {
    root.innerHTML = lobbyMarkup();
    root.dataset.view = this.view;
    root.dataset.tab = tabOf(this.view);
    this.story = new StoryMenu(root, (chapter, titled) => actions.openStory(chapter, titled));
    this.title = query(root, ".menu-title");
    this.kicker = query(root, ".menu-kicker");
    this.backButton = query<HTMLButtonElement>(root, ".menu-back");
    this.detail = query(root, ".menu-detail");
    this.skinFile = query<HTMLInputElement>(root, "#skin-file");
    this.skinStatus = query(root, "#skin-status");
    this.armSetting = query(root, ".arm-setting");
    this.terrainButton = query<HTMLButtonElement>(root, "#terrain-preview");
    this.drawMiniatures();
    this.render();

    const { signal } = this.listeners;
    root.addEventListener("click", (event) => this.onClick(event.target as HTMLElement), { signal });
    root.addEventListener("change", (event) => void this.onChange(event.target), { signal });
    root.addEventListener("pointerover", (event) => this.onHover(event.target as HTMLElement), { signal });
    root.addEventListener("focusin", (event) => this.onHover(event.target as HTMLElement), { signal });
    root.addEventListener("keydown", (event) => this.onKeyDown(event), { signal });
    for (const panel of root.querySelectorAll<HTMLElement>(".menu-panel"))
      panel.addEventListener("pointerleave", () => this.setHovered(undefined), { signal });
  }

  /** `customSkin` reports whether a PNG has been imported and with which arm model. */
  setAppearance(value: Appearance, customSkin: { imported: boolean; model?: SkinModel }) {
    this.look = { ...value };
    if (customSkin.model) this.armModel = customSkin.model;
    if (value.skin === "custom" || customSkin.imported)
      query<HTMLButtonElement>(this.root, '[data-skin="custom"]').disabled = false;
    this.render();
  }

  setMatchMode(mode: MatchMode) {
    this.mode = mode;
    this.render();
  }

  setTerrainPreview(active: boolean) {
    this.terrainButton.setAttribute("aria-pressed", String(active));
    this.terrainButton.textContent = active ? t("返回部署界面") : t("战场预览");
  }

  setMap(id: string) {
    if (id !== this.mapId) wipe(query(this.root, ".menu-wipe"));
    this.mapId = id;
    this.render();
  }

  openSkinPicker() {
    this.skinFile.click();
  }

  /** Steps out of a dialog or sub-menu. Returns false on a tab's root panel, where there is nothing to leave. */
  back(): boolean {
    if (this.story.back()) return true;
    if (isRoot(this.view)) return false;
    this.show(TABS[tabOf(this.view)].root);
    return true;
  }

  /** Enter on a tab with its own primary action. Returns false on the versus tab, which opens the room. */
  confirm(): boolean {
    if (tabOf(this.view) !== "story") return false;
    this.story.primary();
    return true;
  }

  /** Picks the save up again after the story has written to it. */
  refreshStory() {
    this.story.refresh();
    this.render();
  }

  /** Returns to the open tab's root panel without animating, for when the lobby is not on screen. */
  reset() {
    const root = TABS[tabOf(this.view)].root;
    this.story.back();
    for (const panel of this.root.querySelectorAll<HTMLElement>(".menu-panel")) {
      panel.hidden = panel.dataset.panel !== root;
      settle(this.rows(panel));
    }
    this.view = this.root.dataset.view = root;
    this.hovered = undefined;
    this.render();
  }

  /** Plays the arrival of the whole menu: list from the left, card from the right. */
  enter() {
    this.reset();
    rise([query(this.root, ".menu-tabs"), query(this.root, ".menu-crumb"), this.title]);
    rowsIn(this.rows(this.panel(this.view)), -1, 0.08);
    slideIn(this.card(), 0.12);
    rise([query(this.root, ".menu-footer")], 0.3, 10);
  }

  /** Re-renders pack-provided names, which the static shell copy table does not cover. */
  refreshLanguage() {
    query(this.root, "#credits").textContent = creditsLabel();
    this.setTerrainPreview(this.terrainButton.getAttribute("aria-pressed") === "true");
    this.render();
  }

  dispose() {
    this.listeners.abort();
  }

  // --- Navigation ---

  private panel(view: View) {
    return query(this.root, `[data-panel="${view}"]`);
  }

  private rows(panel: HTMLElement) {
    return [...panel.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && !child.hidden && child.tagName !== "INPUT",
    );
  }

  /** The block that accompanies the list of the open tab: the detail card, or the chapter strip. */
  private card() {
    return tabOf(this.view) === "story" ? query(this.root, ".story-chapters") : this.detail;
  }

  private show(view: View) {
    if (view === this.view) return;
    const leaving = this.panel(this.view);
    const arriving = this.panel(view);
    const switchesTab = tabOf(view) !== tabOf(this.view);
    // Going deeper moves the list leftwards; coming back reverses it. Tabs move in their own order.
    const direction = switchesTab ? (tabOf(view) === "story" ? 1 : -1) : isRoot(view) ? -1 : 1;
    this.view = this.root.dataset.view = view;
    this.root.dataset.tab = tabOf(view);
    this.hovered = undefined;
    if (switchesTab) {
      this.story.refresh();
      wipe(query(this.root, ".menu-wipe"));
      rise([query(this.root, ".menu-crumb")], 0, 10);
      slideIn(this.card(), 0.1);
    }
    this.render();
    rise([this.title], 0.06, 10);
    void rowsOut(this.rows(leaving), direction).then(() => {
      // A quick second click may already have brought the leaving panel back.
      if (this.panel(this.view) !== leaving) leaving.hidden = true;
      if (this.panel(this.view) !== arriving) return;
      arriving.hidden = false;
      rowsIn(this.rows(arriving), direction);
      const focus =
        arriving.querySelector<HTMLElement>('[aria-pressed="true"]:not(:disabled)') ??
        arriving.querySelector<HTMLElement>("#start, .story-play:not(:disabled)") ??
        arriving.querySelector<HTMLElement>("button:not(:disabled)");
      focus?.focus({ preventScroll: true });
    });
  }

  private onClick(target: HTMLElement) {
    const button = target.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    const { open, tab, skin, finish, knife, arm, mode, map } = button.dataset;
    if (tab) this.show(TABS[tab as Tab].root);
    else if (open) this.show(open as View);
    else if (this.story.click(button)) return;
    else if ("back" in button.dataset) this.back();
    // GameUI routes the choice itself; picking one closes the sub-menu.
    else if (mode || map) this.show("home");
    else if (skin) {
      this.look.skin = skin;
      this.skinStatus.textContent = "";
      this.actions.changeOutfit({ skin });
      this.render();
    } else if (finish) {
      this.look.bombStyle = finish;
      this.actions.changeOutfit({ bombStyle: finish });
      this.render();
    } else if (knife) {
      this.look.knifeStyle = knife;
      this.actions.changeOutfit({ knifeStyle: knife });
      this.render();
    } else if (arm) {
      this.armModel = arm as SkinModel;
      this.render();
      // Changing the arm model re-imports the stored PNG, so no file is passed.
      void this.importSkin(undefined);
    }
  }

  private onHover(target: HTMLElement) {
    const row = target.closest<HTMLElement>("[data-mode], [data-map]");
    if (row && !row.matches(":disabled")) this.setHovered(row.dataset.mode ?? row.dataset.map);
  }

  private setHovered(id: string | undefined) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.renderDetail();
  }

  /** Up and Down walk the buttons of the open panel, like a console menu. */
  private onKeyDown(event: KeyboardEvent) {
    if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return;
    const buttons = [...this.panel(this.view).querySelectorAll<HTMLElement>("button:not(:disabled)")].filter(
      (button) => button.offsetParent,
    );
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    const step = event.code === "ArrowDown" ? 1 : -1;
    buttons[index < 0 ? 0 : (index + step + buttons.length) % buttons.length].focus();
  }

  // --- Rendering ---

  private skinName(id: string) {
    return SKINS[id] ? field(SKINS[id], "name") : t("自定义 PNG");
  }

  /** Writes every label that depends on the selection or the language. */
  private render() {
    const tab = tabOf(this.view);
    const map = MAPS.find((entry) => entry.id === this.mapId) ?? MAPS[0];
    this.backButton.hidden = isRoot(this.view);
    this.kicker.textContent = t(this.view === "home" ? "当前模式" : tab === "story" ? "单人剧情" : "主菜单");
    this.title.textContent = t(
      this.view === "home"
        ? MATCH_MODES[this.mode].name
        : this.view === "story"
          ? "故事模式"
          : VIEW_TITLES[this.view],
    );
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-tab]"))
      button.setAttribute("aria-pressed", String(button.dataset.tab === tab));
    this.story.render();
    query(this.root, '[data-value="mode"]').textContent = t(MATCH_MODES[this.mode].name);
    query(this.root, '[data-value="map"]').textContent = field(map, "name");
    query(this.root, '[data-value="outfit"]').textContent = this.skinName(this.look.skin);

    const label = (row: HTMLElement, text: string, pressed: boolean) => {
      query(row, ".row-label").textContent = text;
      row.setAttribute("aria-pressed", String(pressed));
    };
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-mode]"))
      label(row, t(MATCH_MODES[row.dataset.mode as MatchMode].name), row.dataset.mode === this.mode);
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-map]"))
      label(
        row,
        field(
          MAPS.find((m) => m.id === row.dataset.map)!,
          "name",
        ),
        row.dataset.map === this.mapId,
      );
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-skin]"))
      label(row, this.skinName(row.dataset.skin!), row.dataset.skin === this.look.skin);
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-finish]"))
      label(row, field(BOMB_STYLES[row.dataset.finish!], "name"), row.dataset.finish === this.look.bombStyle);
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-knife]")) {
      const knife = KNIFE_STYLES[row.dataset.knife!];
      label(row, field(knife, "name"), knife.id === this.look.knifeStyle);
    }
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-arm]"))
      label(row, t(ARM_MODELS.find(([id]) => id === row.dataset.arm)![1]), row.dataset.arm === this.armModel);
    this.armSetting.hidden = this.look.skin !== "custom";
    this.renderDetail();
  }

  /** The card describes the hovered row of a sub-menu, or else the current selection. */
  private renderDetail() {
    const showsMode = this.view === "mode";
    const modeId = showsMode && this.hovered ? (this.hovered as MatchMode) : this.mode;
    const mapId = this.view === "map" && this.hovered ? this.hovered : this.mapId;
    const map = MAPS.find((entry) => entry.id === mapId) ?? MAPS[0];
    for (const layer of this.detail.querySelectorAll<HTMLElement>("[data-art], [data-miniature]"))
      layer.classList.toggle("current", (layer.dataset.art ?? layer.dataset.miniature) === map.id);

    const rules = MATCH_MODES[modeId].rules;
    const stats: [string, string | number][] = showsMode
      ? [
          [t("生命"), rules.health],
          [t("攻击力"), rules.attack],
          [t("爆炸范围"), rules.range],
          [t("炸药容量"), rules.capacity],
          [t("初始金币"), rules.credits],
          [t("视角"), t(rules.overhead ? "俯视" : "第一人称")],
        ]
      : [
          [t("对局模式"), t(MATCH_MODES[this.mode].name)],
          [t("角色皮肤"), this.skinName(this.look.skin)],
        ];
    query(this.detail, ".detail-kicker").textContent = t(showsMode ? "对局模式" : "作战区域");
    query(this.detail, ".detail-title").textContent = showsMode
      ? t(MATCH_MODES[modeId].name)
      : field(map, "name");
    query(this.detail, ".detail-text").textContent = showsMode
      ? t(MODE_NOTES[modeId])
      : field(map, "subtitle");
    query(this.detail, ".detail-stats").replaceChildren(
      ...stats.map(([name, value]) => {
        const item = document.createElement("div");
        const term = document.createElement("dt");
        const data = document.createElement("dd");
        term.textContent = name;
        data.textContent = String(value);
        item.append(term, data);
        return item;
      }),
    );
    this.detail.dataset.kind = showsMode ? "mode" : "map";

    const key = showsMode ? `mode:${modeId}` : `map:${map.id}`;
    if (key !== this.detailKey && this.detailKey) rise([query(this.detail, ".detail-body")], 0, 8);
    this.detailKey = key;
  }

  private drawMiniatures() {
    for (const canvas of this.root.querySelectorAll<HTMLCanvasElement>("[data-miniature]")) {
      const map = MAPS.find((m) => m.id === canvas.dataset.miniature)!;
      const context = canvas.getContext("2d")!;
      generateMap(map, seededRandom(MINIATURE_SEED)).forEach((row, z) =>
        row.forEach((cell, x) => {
          context.fillStyle = MINIATURE_COLORS[cell];
          context.fillRect(x, z, 1, 1);
        }),
      );
    }
  }

  // --- Skin import ---

  private async onChange(target: EventTarget | null) {
    if (target !== this.skinFile) return;
    await this.importSkin(this.skinFile.files?.[0]);
    this.skinFile.value = "";
  }

  private async importSkin(file: File | undefined) {
    this.skinStatus.textContent = t("加载中");
    try {
      await this.actions.importSkin(file, this.armModel);
      this.skinStatus.textContent = file ? file.name : t("模型已更新");
    } catch (error) {
      this.skinStatus.textContent = error instanceof Error ? error.message : t("皮肤加载失败");
    }
  }
}
