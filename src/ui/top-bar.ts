import { t } from "../i18n";
import { bindings } from "../input/bindings";
import { query } from "./dom";
import { icon } from "./icons";

/** Always-visible controls in the top-right corner: settings, fullscreen, sound, help and pause. */
export class TopBar {
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private fullscreenPending = false;
  private readonly listeners = new AbortController();

  constructor(readonly root: HTMLElement) {
    root.innerHTML = `
          <button class="icon-btn graphics-btn" id="graphics" title="设置">${icon("graphics")}<span>设置</span></button>
          <a class="icon-btn graphics-btn wiki-btn" id="wiki" target="_blank" rel="noopener" title="百科">${icon("book")}<span>百科</span></a>
          <button class="icon-btn" id="fullscreen" type="button"></button>
          <button class="icon-btn" id="sound" aria-label="开启声音" title="开启声音">${icon("muted")}</button>
          <button class="icon-btn" id="help" aria-label="玩法说明" title="玩法说明">${icon("help")}</button>
          <button class="icon-btn game-only" id="pause" aria-label="暂停游戏" title="暂停 · Esc">${icon("pause")}</button>
        `;
    // The wiki is built next to the game, so resolve it against the deployed base path.
    query<HTMLAnchorElement>(root, "#wiki").href = new URL("wiki/", document.baseURI).href;
    this.fullscreenButton = query<HTMLButtonElement>(root, "#fullscreen");
    this.soundButton = query<HTMLButtonElement>(root, "#sound");
    this.pauseButton = query<HTMLButtonElement>(root, "#pause");
    document.addEventListener("fullscreenchange", () => this.syncFullscreen(), {
      signal: this.listeners.signal,
    });
  }

  /** Refreshes the tooltips that name a key binding. */
  syncKeyHints() {
    this.syncFullscreen();
    this.pauseButton.setAttribute("title", t("暂停 · {0}", bindings.label("pause")));
  }

  setSound(on: boolean) {
    const button = this.soundButton;
    button.innerHTML = icon(on ? "volume" : "muted");
    button.title = button.ariaLabel = on ? t("关闭声音") : t("开启声音");
  }

  async toggleFullscreen() {
    if (this.fullscreenPending || this.fullscreenButton.disabled) return;
    this.fullscreenPending = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.fullscreenButton.title = t("无法切换全屏");
    } finally {
      this.fullscreenPending = false;
    }
  }

  private syncFullscreen() {
    const button = this.fullscreenButton;
    const active = Boolean(document.fullscreenElement);
    button.disabled = !active && !document.fullscreenEnabled;
    button.innerHTML = icon(active ? "exitFullscreen" : "fullscreen");
    button.setAttribute("aria-pressed", String(active));
    button.ariaLabel = t("切换全屏");
    const label = active ? t("退出全屏") : t("进入全屏");
    const shortcut = bindings.label("fullscreen");
    button.title = button.disabled
      ? t("当前环境不支持全屏")
      : shortcut === "—"
        ? label
        : `${label} · ${shortcut}`;
  }

  dispose() {
    this.listeners.abort();
  }
}
