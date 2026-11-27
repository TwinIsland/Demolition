import "./killcam.css";
import { t } from "../i18n";
import { replayAnimation } from "./dom";

export interface KillcamCaption {
  /** The match-ending kill, as opposed to the viewer's own elimination. */
  final: boolean;
  victim: { name: string; color: string };
  /** Absent when no operator did it: a zombie, the zone, or the victim's own charge. */
  killer?: { name: string; color: string };
}

const MARKUP = `
  <div class="killcam-cut"></div>
  <div class="killcam-bar killcam-top">
    <span class="killcam-rec"></span><strong class="killcam-title"></strong><small>REPLAY</small>
  </div>
  <div class="killcam-bar killcam-bottom">
    <p class="killcam-names"><b class="killcam-killer"></b><i></i><b class="killcam-victim"></b></p>
    <button type="button" class="killcam-skip"><kbd>Space</kbd><span></span></button>
    <div class="killcam-progress"><span></span></div>
  </div>`;

/**
 * Chrome of the slow-motion replay: letterbox bars, who took out whom, and the way to skip it.
 * While it shows, `body.killcam` hides the rest of the interface.
 */
export class KillcamView {
  private readonly root = document.createElement("section");
  private readonly progressBar: HTMLElement;

  constructor(parent: HTMLElement, onSkip: () => void) {
    this.root.className = "killcam";
    this.root.hidden = true;
    this.root.innerHTML = MARKUP;
    parent.append(this.root);
    this.progressBar = this.root.querySelector<HTMLElement>(".killcam-progress span")!;
    // Anywhere on the picture skips, not only the button.
    this.root.addEventListener("pointerdown", (event) => {
      if (event.button === 0) onSkip();
    });
  }

  show(caption: KillcamCaption) {
    const { root } = this;
    const part = (selector: string) => root.querySelector<HTMLElement>(selector)!;
    part(".killcam-title").textContent = caption.final ? t("最终击杀") : t("击杀回放");
    part(".killcam-skip span").textContent = t("跳过");
    const killer = part(".killcam-killer"),
      victim = part(".killcam-victim");
    killer.textContent = caption.killer?.name ?? "";
    killer.style.color = caption.killer?.color ?? "";
    victim.textContent = caption.killer ? caption.victim.name : t("{0} 被淘汰", caption.victim.name);
    victim.style.color = caption.victim.color;
    part(".killcam-names").classList.toggle("solo", !caption.killer);
    this.progress(0);
    root.hidden = false;
    document.body.classList.add("killcam");
    replayAnimation(root, "playing");
  }

  /** 0..1 of the replay's running time. */
  progress(fraction: number) {
    this.progressBar.style.transform = `scaleX(${fraction.toFixed(3)})`;
  }

  hide() {
    this.root.hidden = true;
    this.root.classList.remove("playing");
    document.body.classList.remove("killcam");
  }
}
