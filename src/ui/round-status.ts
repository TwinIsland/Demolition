import { DEFAULT_MODE, MATCH_MODES, type MatchMode } from "../core/match-modes";
import { t } from "../i18n";
import { keyHint } from "./control-settings";
import { query, setText } from "./dom";
import type { HudFrame, HudView } from "./view";

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Top strip: match mode, zone clock, survivor count and the practice terrain-reset hint. */
export class RoundStatusView implements HudView {
  private readonly mode: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly alive: HTMLElement;
  private readonly resetHint: HTMLElement;

  constructor(readonly root: HTMLElement) {
    root.innerHTML = `<span id="round-mode">${MATCH_MODES[DEFAULT_MODE].name}</span><b id="timer">03:00</b><span id="alive">4 / 4 存活</span><span id="terrain-reset-hint" hidden>${keyHint("resetTerrain")} 重置地形</span>`;
    this.mode = query(root, "#round-mode");
    this.timer = query(root, "#timer");
    this.alive = query(root, "#alive");
    this.resetHint = query(root, "#terrain-reset-hint");
  }

  setMode(mode: MatchMode) {
    this.mode.textContent = t(MATCH_MODES[mode].name);
  }

  update({ snapshot }: HudFrame) {
    // Practice counts up. A match counts down to the zone reaching its minimum size; it does not
    // end at zero, the firestorm takes over until one player is left.
    const seconds =
      snapshot.mode === "practice"
        ? Math.floor(snapshot.time)
        : Math.max(0, Math.ceil(snapshot.duration - snapshot.time));
    this.resetHint.hidden = !snapshot.canResetTerrain || snapshot.phase !== "playing";
    this.timer.classList.toggle("final", snapshot.mode !== "practice" && seconds === 0);
    setText(this.timer, clock(seconds));
    setText(
      this.alive,
      t("{0} / {1} 存活", snapshot.players.filter((p) => p.alive).length, snapshot.players.length),
    );
  }

  dispose() {}
}
