import { t } from "../i18n";
import { crateCost } from "../core/economy";
import { canBuild } from "../core/systems/building";
import { keyHint } from "./control-settings";
import { query, replayAnimation, setText } from "./dom";
import { icon } from "./icons";
import type { HudFrame, HudView } from "./view";

const COUNT_MS = 420;
const DELTA_MS = 1100;

/**
 * Coin balance. Earning counts the number up with a
 * floating "+N"; spending counts down with a floating "-N".
 */
export class WalletView implements HudView {
  private readonly amount: HTMLElement;
  private readonly deltas: HTMLElement;
  private readonly buildHint: HTMLElement;
  private readonly buildCost: HTMLElement;
  private target?: number;
  private shown = 0;
  private from = 0;
  private startedAt = 0;
  private frame = 0;
  private owner = "";

  constructor(readonly root: HTMLElement) {
    root.innerHTML = `<span class="wallet-coin">${icon("coin")}</span><b class="wallet-amount">0</b><span class="wallet-deltas" aria-hidden="true"></span><span class="wallet-supply wallet-crate">${icon("crate")}${keyHint("build")}<b class="wallet-build-cost"></b></span>`;
    this.amount = query(root, ".wallet-amount");
    this.deltas = query(root, ".wallet-deltas");
    this.buildHint = query(root, ".wallet-crate");
    this.buildCost = query(root, ".wallet-build-cost");
  }

  update({ snapshot, viewer }: HudFrame) {
    const credits = viewer.credits;
    this.root.title = t("金币 {0}", credits);
    const cost = crateCost(viewer.cratesBuilt ?? 0);
    setText(this.buildCost, String(cost));
    this.buildHint.title = t("建造木箱 · {0} 金币", cost);
    this.buildHint.hidden = !viewer.alive || snapshot.phase !== "playing";
    this.buildHint.style.opacity = canBuild(snapshot, viewer) && !viewer.building ? "1" : "0.45";

    // A new match or another viewer: show the balance without animating the difference.
    if (this.target === undefined || this.owner !== viewer.id || !viewer.alive) {
      this.owner = viewer.id;
      this.target = this.shown = credits;
      cancelAnimationFrame(this.frame);
      setText(this.amount, String(credits));
      return;
    }
    if (credits === this.target) return;
    this.float(credits - this.target);
    replayAnimation(this.root, credits > this.target ? "earned" : "spent");
    this.from = this.shown;
    this.target = credits;
    this.startedAt = performance.now();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.count);
  }

  private readonly count = (now: number) => {
    const progress = Math.min(1, (now - this.startedAt) / COUNT_MS);
    const eased = 1 - (1 - progress) ** 3;
    this.shown = Math.round(this.from + ((this.target ?? 0) - this.from) * eased);
    setText(this.amount, String(this.shown));
    if (progress < 1) this.frame = requestAnimationFrame(this.count);
  };

  private float(delta: number) {
    const chip = document.createElement("i");
    chip.className = delta > 0 ? "gain" : "loss";
    chip.textContent = delta > 0 ? `+${delta}` : `−${-delta}`;
    this.deltas.append(chip);
    setTimeout(() => chip.remove(), DELTA_MS);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
  }
}
