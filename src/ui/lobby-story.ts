import { language, t } from "../i18n";
import { STORY_ART } from "../story/assets";
import { ACTS, actDone, actUnlocked, nextAct, type Act } from "../story/chapters";
import { loadStory, MAIN_STORY, resetStory, type StorySave } from "../story/save";
import { query } from "./dom";
import { icon } from "./icons";
import { rise } from "./lobby-motion";

/** Title of the story, shown as the tab's heading. */
export const STORY_TITLE = "升维";

/** One line per act for the card. Spoiler-free: it shows as soon as the act unlocks. */
const ACT_NOTES: Record<string, string> = {
  act1: "紧闭的窗帘，三桶泡面，以及一台被封印在床底的魔导器。",
  act2: "桌面上唯一的图标。咏唱需要十一秒，引信只有三秒。",
  act3: "一个没有「上」的世界，和一位嘴硬的引导精灵。",
  act4: "世界多出了一条轴。这才是吾真正的姿态。呕。",
  act5: "天上传来母亲大人的声音。四天王一共三个，这是传统。",
};
/**
 * Comic panel behind the menu, per act. An act without one yet borrows the nearest earlier
 * panel, so adding art for an act is one entry here.
 */
const ACT_COVERS: Partial<Record<string, string>> = {
  act1: STORY_ART.comic1,
};
const coverOf = (act: Act) => {
  for (let index = ACTS.indexOf(act); index >= 0; index--) {
    const cover = ACT_COVERS[ACTS[index].id];
    if (cover) return cover;
  }
  return STORY_ART.comic1;
};
const EMPTY_NOTE = "世界平静得令人作呕。至少有一个人是这么认为的。";

const number = (index: number) => String(index + 1).padStart(2, "0");
/** Act titles hold the ordinal and the name, separated by an ideographic space (U+3000). */
const ordinal = (act: Act) => t(act.title.split("\u3000")[0]);
const name = (act: Act) => t(act.title.split("\u3000").at(-1)!);
const fullName = (act: Act) => `${ordinal(act)} · ${name(act)}`;

type ActState = "done" | "current" | "locked";

/** The story tab's two panels, for the lobby's panel stack. */
export const storyPanels = () => `
            <nav class="menu-panel" data-panel="story" aria-label="故事模式" hidden>
              <button type="button" class="story-play" data-story="continue">${icon("play")}<span class="play-text"><span class="play-label">继续</span><small class="play-note"></small></span><kbd>ENTER</kbd></button>
              <button type="button" class="menu-row" data-story="new"><span class="row-label">新游戏</span><span class="row-value" data-value="new"></span><i class="row-arrow"></i></button>
              <button type="button" class="menu-row" data-open="chapters"><span class="row-label">章节选择</span><span class="row-value" data-value="chapters"></span><i class="row-arrow"></i></button>
            </nav>
            <nav class="menu-panel" data-panel="chapters" aria-label="章节选择" hidden>
              ${ACTS.map((chapter, index) => `<button type="button" class="menu-row chapter-row" data-chapter="${chapter.id}"><span class="row-index">${number(index)}</span><span class="row-label"></span><span class="row-value"></span>${icon("lock")}<i class="row-arrow"></i></button>`).join("")}
            </nav>`;

/** Everything of the story tab outside the list: backdrop, save card and the overwrite dialog. */
export const storyChrome = () => `
        <div class="story-backdrop" aria-hidden="true"><i class="story-art"></i><i class="story-art"></i><i class="story-tone"></i><i class="story-lines"></i></div>
        <aside class="story-save">
          <header class="save-head"><small class="detail-kicker"></small><span class="save-act"></span></header>
          <h2 class="detail-title"></h2>
          <p class="detail-text"></p>
          <ol class="save-track" aria-hidden="true">${ACTS.map((_, index) => `<li><i></i><span>${number(index)}</span></li>`).join("")}</ol>
          <dl class="detail-stats"></dl>
        </aside>
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
  private readonly card: HTMLElement;
  private readonly dialog: HTMLElement;
  /** What the card last showed, so it only animates when its subject changes. */
  private cardKey = "";
  /** Image the backdrop shows now; its two layers take turns so a change crossfades. */
  private cover = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly start: (act: string) => void,
  ) {
    this.card = query(root, ".story-save");
    this.dialog = query(root, ".story-confirm");
  }

  /** Re-reads the save. Call after the story has run. */
  refresh() {
    this.save = loadStory();
  }

  /** Handles a click in the tab. Returns false when the button is not one of its own. */
  click(button: HTMLButtonElement): boolean {
    const { story, chapter } = button.dataset;
    if (chapter) this.start(chapter);
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

  /** Writes every label of the tab. `hovered` is the act row under the pointer, if any. */
  render(hovered: string | undefined) {
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
    query(this.root, '[data-value="chapters"]').textContent = t(
      "已解锁 {0} / {1}",
      ACTS.filter((act) => actUnlocked(act, this.save)).length,
      ACTS.length,
    );

    for (const act of ACTS) {
      const row = query<HTMLButtonElement>(this.root, `[data-chapter="${act.id}"]`);
      const state = this.state(act);
      row.disabled = state === "locked" || !act.scene;
      row.dataset.state = state;
      query(row, ".row-label").textContent = state === "locked" ? "？？？" : name(act);
      query(row, ".row-value").textContent = t(
        state === "locked" ? "未解锁" : !act.scene ? "制作中" : state === "done" ? "已完成" : "进行中",
      );
    }
    this.renderCard(hovered);
    // The backdrop follows the story: the furthest act reached, or the one being looked at.
    this.showCover(coverOf(ACTS.find((act) => act.id === hovered) ?? next ?? ACTS.at(-1)!));
  }

  private showCover(cover: string) {
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

  /** The card shows the hovered act, or else the save itself. */
  private renderCard(hovered: string | undefined) {
    const next = nextAct(this.save);
    const picked = ACTS.find((act) => act.id === hovered);
    const act = picked ?? next ?? ACTS.at(-1)!;
    const index = ACTS.indexOf(act);
    const empty = !picked && !this.started;

    query(this.card, ".detail-kicker").textContent = t(picked ? "章节" : "存档");
    query(this.card, ".save-act").textContent = `ACT ${number(index)}`;
    query(this.card, ".detail-title").textContent = empty
      ? t("尚无存档")
      : !picked && !next
        ? t("已通关")
        : name(act);
    query(this.card, ".detail-text").textContent = t(empty ? EMPTY_NOTE : (ACT_NOTES[act.id] ?? ""));
    this.card.querySelectorAll<HTMLElement>(".save-track li").forEach((step, i) => {
      step.dataset.state = this.started ? this.state(ACTS[i]) : "locked";
      step.classList.toggle("shown", i === index && !empty);
    });

    const stats: [string, string][] = [
      [t("当前章节"), !this.started ? "—" : next ? fullName(next) : t("已通关")],
      [t("上次游玩"), this.lastPlayed()],
      [t("完成度"), `${this.completion()}%`],
    ];
    query(this.card, ".detail-stats").replaceChildren(
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

    const key = empty ? "empty" : `${act.id}:${!!picked}`;
    if (key !== this.cardKey && this.cardKey)
      rise([query(this.card, ".detail-title"), query(this.card, ".detail-text")], 0, 8);
    this.cardKey = key;
  }
}
