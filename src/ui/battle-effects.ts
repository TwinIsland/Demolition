import { KICK } from "../core/geometry";
import { t } from "../i18n";
import { HtmlSlot, query, replayAnimation } from "./dom";
import { icon } from "./icons";
import type { HudFrame, HudView } from "./view";

/** Fire layer behind the HUD: an open perk offer, a terrain-reset warning, or the reset itself. */
export type BattleFireLayer = "" | "offer" | "warning" | "eruption";

/** Health fraction at which the wounded veil starts to show. */
const CRITICAL_HEALTH = 0.3;

/**
 * Full-screen layers over the 3D view: crosshair, start countdown, battle fire, the wounded
 * veil, arena warnings and the damage flash. `root` is the app shell because `#damage` sits outside
 * the HUD so that it also covers menus.
 */
export class BattleEffectsView implements HudView {
  /** Markup for the layers that live inside `#hud`, in stacking order. */
  static readonly markup = `<div id="crosshair"><i></i></div><div id="countdown"></div>
        <div class="battle-heat" aria-hidden="true"></div>
        <div class="critical-veil" aria-hidden="true"></div>
        <div class="arena-warnings">
          <div class="reset-warning" role="status" hidden><span>灭世 · 地形重置</span><strong></strong></div>
          <div class="collapse-warning" role="status" hidden>${icon("collapse")}<span class="collapse-count-in">维度坍缩即将启动</span><span class="collapse-active">维度坍缩 · 二维视角</span><strong></strong></div>
        </div>`;

  private readonly damage: HTMLElement;
  private readonly crosshair: HTMLElement;
  private kickWindup = 0;
  private readonly countdown: HtmlSlot;
  private readonly heat: HTMLElement;
  private readonly criticalVeil: HTMLElement;
  private readonly resetWarning: HTMLElement;
  private readonly resetSeconds: HTMLElement;
  private readonly resetLabel: HTMLElement;
  private resetShift = false;
  private readonly collapseWarning: HTMLElement;
  private readonly collapseSeconds: HTMLElement;
  private danger = 0;

  constructor(readonly root: HTMLElement) {
    this.damage = query(root, "#damage");
    this.crosshair = query(root, "#crosshair");
    this.countdown = new HtmlSlot(query(root, "#countdown"));
    this.heat = query(root, ".battle-heat");
    this.criticalVeil = query(root, ".critical-veil");
    this.resetWarning = query(root, ".reset-warning");
    this.resetSeconds = query(this.resetWarning, "strong");
    this.resetLabel = query(this.resetWarning, "span");
    this.collapseWarning = query(root, ".collapse-warning");
    this.collapseSeconds = query(this.collapseWarning, "strong");
  }

  update({ snapshot, viewer }: HudFrame) {
    this.countdown.render(
      snapshot.phase === "countdown"
        ? `<span>${t("准备开始")}</span><b>${Math.ceil(snapshot.countdown)}</b>`
        : "",
    );
    this.crosshair.classList.toggle("off", !viewer.alive);
    // Slide Kick windup: a ring around the crosshair fills while the push is held.
    const push = viewer.alive ? viewer.kickPush : undefined;
    const windup = push ? Math.min(1, Math.max(0, (snapshot.time - push.since) / KICK.windup)) : 0;
    this.crosshair.classList.toggle("kick-windup", !!push);
    if (windup !== this.kickWindup) this.crosshair.style.setProperty("--kick-windup", windup.toFixed(2));
    this.kickWindup = windup;
  }

  /** `seconds` is the time left before a terrain reset; the warning shows while it is positive. */
  setBattleFire(layer: BattleFireLayer, seconds?: number, shift = false) {
    if (this.heat.dataset.layer !== layer) this.heat.dataset.layer = layer;
    const visible = seconds !== undefined && seconds > 0;
    if (visible && shift !== this.resetShift) {
      this.resetShift = shift;
      this.resetLabel.textContent = t(shift ? "后室 · 房间即将移位" : "灭世 · 地形重置");
      this.resetWarning.toggleAttribute("data-shift", shift);
    }
    if (this.resetWarning.hidden === visible) this.resetWarning.hidden = !visible;
    if (visible && this.resetSeconds.textContent !== String(seconds))
      this.resetSeconds.textContent = String(seconds);
  }

  /** Shows the dimension-collapse banner; `pending` selects the count-in wording. */
  setCollapse(seconds: number, pending: boolean) {
    const banner = this.collapseWarning;
    if (banner.hidden !== seconds <= 0) banner.hidden = seconds <= 0;
    if (banner.hidden) return;
    banner.toggleAttribute("data-pending", pending);
    const value = String(seconds);
    if (this.collapseSeconds.textContent !== value) this.collapseSeconds.textContent = value;
  }

  setHealthDanger(healthFraction: number) {
    const danger =
      healthFraction <= CRITICAL_HEALTH
        ? 0.38 + 0.62 * (1 - Math.max(0, healthFraction) / CRITICAL_HEALTH)
        : 0;
    if (danger === this.danger) return;
    this.danger = danger;
    this.criticalVeil.toggleAttribute("data-active", danger > 0);
    this.criticalVeil.style.setProperty("--blood-opacity", String(danger));
    this.criticalVeil.style.setProperty("--breath-cycle", `${2.85 - 1.35 * danger}s`);
  }

  confirmHit() {
    replayAnimation(this.crosshair, "confirmed");
  }

  flashDamage() {
    replayAnimation(this.damage, "flash");
  }

  clearDamageFlash() {
    this.damage.classList.remove("flash");
  }

  dispose() {}
}
