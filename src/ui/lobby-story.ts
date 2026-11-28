import { ASCENSION_ART } from "../story/ascend/assets";
import { SHUTDOWN_ART } from "../story/shutdown/art";
import { language, t } from "../i18n";
import { STORY_ART } from "../story/assets";
import { CheatCode, toggleStoryCheat } from "../story/cheat";
import { ACTS, actDone, actUnlocked, nextAct, type Act } from "../story/chapters";
import { loadStory, MAIN_STORY, resetStory, type StorySave } from "../story/save";
import { query } from "./dom";
import { icon } from "./icons";
import { unlockedIllustrations } from "../story/gallery";
import { rise } from "./lobby-motion";

/**
 * Comic panel behind the menu, per act. An act without one yet borrows the nearest earlier
 * panel, so adding art for an act is one entry here.
 */
const ACT_COVERS: Partial<Record<string, string>> = {
  act1: STORY_ART.comic1,
  act2: STORY_ART.comic2,
  act3: STORY_ART.comic3,
  act4: ASCENSION_ART.panel,
  act5: SHUTDOWN_ART.wall,
};
const coverOf = (act: Act) => {
  for (let index = ACTS.indexOf(act); index >= 0; index--) {
    const cover = ACT_COVERS[ACTS[index].id];
    if (cover) return cover;
  }
  return STORY_ART.comic1;
};

const number = (index: number) => String(index + 1).padStart(2, "0");
/** Act titles hold the ordinal and the name, separated by an ideographic space (U+3000). */
const ordinal = (act: Act) => t(act.title.split("\u3000")[0]);
const name = (act: Act) => t(act.title.split("\u3000").at(-1)!);
const fullName = (act: Act) => `${ordinal(act)} · ${name(act)}`;

type ActState = "done" | "current" | "locked";

/** The story tab's panel, for the lobby's panel stack. */
export const storyPanels = () => `
            <nav class="menu-panel" data-panel="story" aria-label="故事模式" hidden>
              <dl class="story-status"></dl>
              <div class="story-primary-actions">
                <button type="button" class="story-play" data-story="continue">${icon("play")}<span class="play-text"><span class="play-label">继续</span><small class="play-note"></small></span><kbd>ENTER</kbd></button>
                <button type="button" class="story-square" id="story-music-box" title="音乐盒">${icon("music")}<span>音乐盒</span></button>
                <button type="button" class="story-square" id="story-gallery" title="收藏">${icon("gallery")}<span>收藏</span></button>
              </div>
              <button type="button" class="menu-row" data-story="new"><span class="row-label">新游戏</span><span class="row-value" data-value="new"></span><i class="row-arrow"></i></button>
            </nav>`;

const chapterPanel = (act: Act, index: number) =>
  `<button type="button" class="chapter-panel" data-chapter="${act.id}"><i class="chapter-art"></i><span class="chapter-body"><span class="chapter-number">${number(index)}</span><span class="chapter-state"></span><span class="chapter-enter">${icon("play")}<span>再点一次进入</span></span><strong class="chapter-name"></strong></span>${icon("lock")}</button>`;

/**
 * Everything of the story tab outside the list: the backdrop, the strip of chapter panels along
 * the bottom (a page of manga, one panel per act) and the overwrite dialog.
 */
export const storyChrome = () => `
        <div class="story-backdrop" aria-hidden="true"><i class="story-art"></i><i class="story-art"></i><i class="story-tone"></i><i class="story-lines"></i></div>
        <section class="story-chapters" aria-label="章节选择">
          <header class="menu-caption"><span>章节选择</span><span class="chapters-count"></span></header>
          <div class="chapter-strip">${ACTS.map(chapterPanel).join("")}</div>
        </section>
        <div class="story-cheat" role="status" aria-live="polite" hidden><small></small><strong></strong><span></span></div>
        <div class="story-confirm" role="alertdialog" aria-modal="true" aria-labelledby="story-confirm-title" hidden>
          <div class="confirm-box">
            <small class="detail-kicker">新游戏</small>
            <h2 id="story-confirm-title">覆盖现有存档？</h2>
            <p class="confirm-text"></p>
            <div class="confirm-actions">
              <button type="button" class="menu-row" data-story="cancel"><span class="row-label">取消</span><kbd>ESC</kbd></button>
              <button type="button" class="menu-row confirm-danger" data-story="overwrite"><span class="row-label">覆盖并开始</span></button>
            </div>
          </div>
        </div>`;

/**
 * The story tab of the main menu: continue, new game, chapter select and the save card. The lobby
 * owns navigation between panels; this class fills them from the save and starts acts.
 */
export class StoryMenu {
  private save: StorySave = loadStory();
  private readonly strip: HTMLElement;
  private readonly dialog: HTMLElement;
  /** Chapter panel under the pointer or focus; the backdrop previews its art. */
  private hovered?: string;
  /** Chapter picked with a first click; a second click on it starts the act. */
  private selected?: string;
  /** Image the backdrop shows now; its two layers take turns so a change crossfades. */
  private cover = "";
  private readonly cheat = new CheatCode();
  private readonly toast: HTMLElement;
  private toastTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    /** `titled` opens the act on its title card: it was picked from the list, not played into. */
    private readonly start: (act: string, titled?: boolean) => void,
    /** The cheat code went through: `unlocked` tells whether it opened everything or wiped it. */
    private readonly cheated: (unlocked: boolean) => void,
  ) {
    this.toast = query(root, ".story-cheat");
    // On the window, in the capture phase: the code has to be heard whatever holds the focus.
    window.addEventListener("keydown", (event) => this.onCheatKey(event), true);
    // Preserve illustrations earned by saves made before the gallery existed.
    unlockedIllustrations();
    this.strip = query(root, ".chapter-strip");
    this.dialog = query(root, ".story-confirm");
    const hover = (id: string | undefined) => {
      if (id === this.hovered) return;
      this.hovered = id;
      this.renderCover();
    };
    const over = (event: Event) => {
      const panel = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-chapter]");
      if (panel && !panel.disabled) hover(panel.dataset.chapter);
    };
    this.strip.addEventListener("pointerover", over);
    this.strip.addEventListener("focusin", over);
    this.strip.addEventListener("pointerleave", () => hover(undefined));
    this.strip.addEventListener("focusout", () => hover(undefined));
    this.strip.addEventListener("keydown", (event) => this.onKeyDown(event));
  }

  /** Feeds the cheat code while the story tab is what the player is looking at. */
  private onCheatKey(event: KeyboardEvent) {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="story"]');
    const listening = !!panel && !panel.hidden && this.dialog.hidden && this.root.getClientRects().length > 0;
    if (!listening || event.ctrlKey || event.metaKey || event.altKey) return this.cheat.reset();
    if (event.repeat || !this.cheat.press(event.code)) return;
    const unlocked = toggleStoryCheat();
    this.cheated(unlocked);
    this.announce(unlocked);
  }

  private announce(unlocked: boolean) {
    const [kicker, title, text] = [...this.toast.children];
    kicker.textContent = t("秘籍生效");
    title.textContent = t(unlocked ? "全部故事已解锁" : "故事进度已清空");
    text.textContent = t(
      unlocked
        ? "所有章节、结局奖励与收藏均已开放。再输入一次可清空。"
        : "存档与全部解锁内容已清除。再输入一次可重新解锁。",
    );
    this.toast.dataset.kind = unlocked ? "unlock" : "wipe";
    this.toast.hidden = false;
    rise([this.toast], 0, 18);
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), 4200);
  }

  /** Left and Right walk the chapter panels. */
  private onKeyDown(event: KeyboardEvent) {
    if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return;
    const panels = [...this.strip.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const index = panels.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.code === "ArrowRight" ? 1 : -1;
    panels[(index + step + panels.length) % panels.length].focus();
  }

  /** Re-reads the save. Call after the story has run. */
  refresh() {
    this.save = loadStory();
    this.select(undefined);
  }

  private select(chapter: string | undefined) {
    this.selected = chapter;
    for (const panel of this.strip.querySelectorAll<HTMLElement>("[data-chapter]"))
      panel.setAttribute("aria-pressed", String(panel.dataset.chapter === chapter));
    this.renderCover();
  }

  /** Handles a click in the tab. Returns false when the button is not one of its own. */
  click(button: HTMLButtonElement): boolean {
    const { story, chapter } = button.dataset;
    // The first click picks a chapter and shows its panel; the second one enters it.
    if (chapter && chapter !== this.selected) this.select(chapter);
    else if (chapter) this.start(chapter, true);
    else if (story === "continue") this.resume();
    else if (story === "new") this.newGame();
    else if (story === "cancel") this.closeDialog();
    else if (story === "overwrite") {
      this.closeDialog();
      this.restart();
    } else return false;
    return true;
  }

  /** Enter: resume when there is something to resume, otherwise begin. */
  primary() {
    if (!this.dialog.hidden) return;
    if (this.resumable()) this.resume();
    else if (!this.started) this.restart();
  }

  /** Escape: closes the overwrite dialog. Returns false when it was not open. */
  back(): boolean {
    if (this.dialog.hidden) return false;
    this.closeDialog();
    return true;
  }

  /** Writes every label of the tab. */
  render() {
    const next = nextAct(this.save);
    const play = query<HTMLButtonElement>(this.root, '[data-story="continue"]');
    play.disabled = !this.resumable();
    query(play, ".play-note").textContent = !this.started
      ? t("尚无存档")
      : !next
        ? t("已通关")
        : next.scene
          ? fullName(next)
          : t("{0}制作中，敬请期待", ordinal(next));
    query(this.root, '[data-value="new"]').textContent = t(this.started ? "覆盖现有存档" : "从第一幕开始");
    query(this.root, ".chapters-count").textContent = t(
      "已解锁 {0} / {1}",
      ACTS.filter((act) => actUnlocked(act, this.save)).length,
      ACTS.length,
    );

    const stats: [string, string][] = [
      [t("当前章节"), !this.started ? t("尚无存档") : next ? fullName(next) : t("已通关")],
      [t("上次游玩"), this.lastPlayed()],
      [t("完成度"), `${this.completion()}%`],
    ];
    query(this.root, ".story-status").replaceChildren(
      ...stats.map(([label, value]) => {
        const item = document.createElement("div");
        const term = document.createElement("dt");
        const data = document.createElement("dd");
        term.textContent = label;
        data.textContent = value;
        item.append(term, data);
        return item;
      }),
    );

    for (const act of ACTS) {
      const panel = query<HTMLButtonElement>(this.strip, `[data-chapter="${act.id}"]`);
      const state = this.state(act);
      const locked = state === "locked";
      panel.disabled = locked || !act.scene;
      panel.dataset.state = state;
      panel.classList.toggle("next", act === next && this.started);
      const art = locked ? undefined : ACT_COVERS[act.id];
      query<HTMLElement>(panel, ".chapter-art").style.backgroundImage = art ? `url("${art}")` : "";
      query(panel, ".chapter-name").textContent = locked ? "？？？" : name(act);
      query(panel, ".chapter-state").textContent = t(
        locked
          ? "未解锁"
          : !act.scene
            ? "制作中"
            : state === "done"
              ? "已完成"
              : this.started
                ? "进行中"
                : "未开始",
      );
    }
    this.renderCover();
  }

  /** The backdrop follows the story: the furthest act reached, or the one being looked at. */
  private renderCover() {
    const shown = this.hovered ?? this.selected;
    const act = ACTS.find((entry) => entry.id === shown) ?? nextAct(this.save) ?? ACTS.at(-1)!;
    const cover = coverOf(act);
    if (cover === this.cover) return;
    this.cover = cover;
    const layers = [...this.root.querySelectorAll<HTMLElement>(".story-art")];
    const arriving = layers.find((layer) => !layer.classList.contains("current")) ?? layers[0];
    arriving.style.backgroundImage = `url("${cover}")`;
    for (const layer of layers) layer.classList.toggle("current", layer === arriving);
  }

  private get started() {
    return !!this.save.stories[MAIN_STORY]?.checkpoints.length;
  }

  private state(act: Act): ActState {
    return actDone(act, this.save) ? "done" : actUnlocked(act, this.save) ? "current" : "locked";
  }

  /** Share of the acts finished, as a whole percentage. */
  private completion() {
    return Math.round((ACTS.filter((act) => actDone(act, this.save)).length / ACTS.length) * 100);
  }

  private resumable() {
    return this.started && !!nextAct(this.save)?.scene;
  }

  private resume() {
    const next = nextAct(this.save);
    if (this.resumable() && next) this.start(next.id);
  }

  private newGame() {
    if (!this.started) return this.restart();
    const next = nextAct(this.save);
    query(this.dialog, ".confirm-text").textContent = t(
      "当前进度（{0}，{1}）将被清除，无法恢复。",
      next ? fullName(next) : t("已通关"),
      t("完成度 {0}%", this.completion()),
    );
    this.dialog.hidden = false;
    rise([query(this.dialog, ".confirm-box")], 0, 18);
    query<HTMLElement>(this.dialog, '[data-story="cancel"]').focus({ preventScroll: true });
  }

  private closeDialog() {
    if (this.dialog.hidden) return;
    this.dialog.hidden = true;
    query<HTMLElement>(this.root, '[data-story="new"]').focus({ preventScroll: true });
  }

  private restart() {
    resetStory();
    this.refresh();
    this.start(ACTS[0].id);
  }

  private lastPlayed() {
    const { playedAt } = this.save;
    if (!playedAt) return "—";
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(playedAt);
  }
}
