import { t } from "../i18n";
import { HtmlSlot, query } from "./dom";
import { icon } from "./icons";
import type { HudFrame, HudView } from "./view";

/** Bottom-left panel: the viewer's health, shield, stamina, level progress and core stats. */
export class VitalsView implements HudView {
  private readonly panel: HtmlSlot;

  constructor(readonly root: HTMLElement) {
    this.panel = new HtmlSlot(root);
  }

  update({ snapshot, viewer }: HudFrame) {
    const endless = snapshot.mode === "practice" && !viewer.bot;
    this.panel.render(
      `<div class="health-row"><span class="health-icon">${icon("heart")}</span><b>${endless ? "∞" : `${Math.ceil(viewer.hp)}<small> / ${viewer.maxHp}</small>`}</b>${viewer.shield ? `<span class="shield-count">${icon("shield")}${Math.ceil(viewer.shield)}s</span>` : ""}</div><div class="hp-gauge"><i style="width:${(viewer.hp / viewer.maxHp) * 100}%"></i></div><div id="stamina" role="meter" aria-label="${t("体力")}" aria-valuemin="0"><i></i><span></span></div><div class="xp-label"><b>LV. ${viewer.level}</b><span>${t("强化积分")} <em>${viewer.xp} / ${viewer.nextLevel}</em></span></div><div class="xp-track"><i style="width:${Math.min(100, (viewer.xp / viewer.nextLevel) * 100)}%"></i></div><div class="stat-values"><span title="${t("总积分")}">${icon("crown")} ${viewer.score}</span><span title="${t("攻击力")}">${icon("target")} ${Math.round(viewer.attack)}</span><span>${icon("flask")} ${viewer.range} ${t("格")}</span><span>${icon("speed")} ${viewer.speed.toFixed(1)}</span></div>`,
    );
    // Stamina moves every frame, so it is patched in place instead of repainting the panel.
    const stamina = query(this.root, "#stamina");
    const current = Math.ceil(viewer.stamina);
    stamina.style.setProperty("--energy", `${(100 * viewer.stamina) / viewer.maxStamina}%`);
    stamina.setAttribute("aria-valuenow", String(current));
    stamina.setAttribute("aria-valuemax", String(viewer.maxStamina));
    query(stamina, "span").textContent = `${t("体力")} ${current} / ${viewer.maxStamina}`;
  }

  dispose() {}
}
