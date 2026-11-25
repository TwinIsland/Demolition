import { t } from "../i18n";
import { HtmlSlot } from "./dom";
import { playerCardExtras } from "./player-card";
import { mountSkinHeads } from "./skin-heads";
import type { HudFrame, HudView } from "./view";

/** Roster column: one row per player with level and remaining health. */
export class ScoreboardView implements HudView {
  private readonly rows: HtmlSlot;

  constructor(readonly root: HTMLElement) {
    this.rows = new HtmlSlot(root);
    mountSkinHeads(root);
  }

  update({ snapshot, viewer }: HudFrame) {
    const practice = snapshot.mode === "practice";
    this.rows.render(
      snapshot.players
        .map(
          (p) =>
            `<div class="player-row ${p.id === viewer.id ? "self" : ""} ${p.alive ? "" : "eliminated"}"><span class="avatar" data-player="${p.id}" data-skin="${p.skin ?? ""}" style="--player-color:${p.color}"><i></i><i></i></span><span class="player-name">${p.id === viewer.id ? t("你") : p.name}<small>${p.bot ? t("电脑玩家") : t("本人")} · LV.${p.level}</small></span><span class="row-hearts"><i class="enemy-health"><i style="width:${(100 * p.hp) / p.maxHp}%;background:${p.color}"></i></i>${p.alive ? `${practice && !p.bot ? "∞" : Math.ceil(p.hp)} HP` : t("已淘汰")}</span>${playerCardExtras(p)}</div>`,
        )
        .join(""),
    );
  }

  dispose() {}
}
