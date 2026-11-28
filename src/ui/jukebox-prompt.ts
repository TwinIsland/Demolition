import { t } from "../i18n";
import { keyHint } from "./control-settings";
import { query, setText } from "./dom";
import type { HudFrame, HudView } from "./view";

/** Under the crosshair by the jukebox: the key that changes the track, and what is playing. */
export class JukeboxPromptView implements HudView {
  private readonly action: HTMLElement;
  private readonly label: HTMLElement;
  private readonly track: HTMLElement;

  constructor(readonly root: HTMLElement) {
    root.innerHTML = `<span class="jukebox-action">${keyHint("use")}<span></span></span><b class="jukebox-track"></b>`;
    this.action = query(root, ".jukebox-action");
    this.label = query(this.action, "span");
    this.track = query(root, ".jukebox-track");
    root.hidden = true;
  }

  update({ jukebox }: HudFrame) {
    this.root.hidden = !jukebox;
    if (!jukebox) return;
    this.action.hidden = !jukebox.reachable;
    setText(this.label, jukebox.title ? t("切换歌曲") : t("播放音乐盒"));
    setText(this.track, jukebox.title ? `♪ ${jukebox.title} · ${jukebox.artist}` : "");
    this.track.hidden = !jukebox.title;
  }

  dispose() {}
}
