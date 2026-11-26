import type { GameSnapshot, Player } from "../core/types";
import { t } from "../i18n";
import { languageSelect } from "./graphics-options";
import { debriefMarkup } from "./debrief";
import { icon } from "./icons";

export function pauseMarkup() {
  return `<h2>${t("暂停")}</h2>${languageSelect()}<button class="primary" id="resume">${icon("play")} ${t("继续对局")}</button><div class="modal-actions"><button id="restart">${t("重新开局")}</button><button id="home">${t("返回首页")}</button></div>`;
}

export type Outcome = "victory" | "defeat" | "draw";

export function outcomeOf(snapshot: Readonly<GameSnapshot>, viewer: Player): Outcome {
  if (snapshot.winnerId === viewer.id) return "victory";
  return snapshot.winnerId ? "defeat" : "draw";
}

/** The badge canvas is mounted into `.outcome-badge-slot` once the dialog is open. */
const banner = (kicker: string, headline: string, detail = "") =>
  `<header class="outcome-banner"><div class="outcome-badge-slot"></div><small class="modal-kicker">${kicker}</small><h2 data-text="${headline}">${headline}</h2>${detail ? `<p>${detail}</p>` : ""}</header>`;

export function eliminatedMarkup(snapshot: Readonly<GameSnapshot>, viewer: Player) {
  return `${banner(t("行动中止"), t("已淘汰"))}${debriefMarkup(snapshot, viewer)}<button class="primary" id="resume">${t("观战剩余对局")}</button><div class="modal-actions"><button id="restart">${t("再来一局")}</button><button id="home">${t("返回首页")}</button></div>`;
}

export function resultMarkup(snapshot: Readonly<GameSnapshot>, viewer: Player) {
  const winner = snapshot.players.find((p) => p.id === snapshot.winnerId);
  const outcome = outcomeOf(snapshot, viewer);
  const head =
    outcome === "victory"
      ? banner(t("任务完成"), t("对局胜利"), t("你是最后的幸存者"))
      : outcome === "defeat"
        ? banner(t("任务失败"), t("对局失败"), t("{0} 赢得对局", winner!.name))
        : banner(t("时间耗尽"), t("平局"));
  return `${head}${debriefMarkup(snapshot, viewer)}<button class="primary" id="restart">${icon("refresh")} ${t("再来一局")}</button><div class="modal-actions"><button id="home">${t("返回首页")}</button></div>`;
}
