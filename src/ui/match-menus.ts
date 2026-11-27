import { t } from "../i18n";
import { languageSelect } from "./graphics-options";
import { icon } from "./icons";

export function pauseMarkup() {
  return `<h2>${t("暂停")}</h2>${languageSelect()}<button class="primary" id="resume">${icon("play")} ${t("继续对局")}</button><div class="modal-actions"><button id="restart">${t("重新开局")}</button><button id="home">${t("返回首页")}</button></div>`;
}

/** Story mode keeps the pixel-game menu separate from the battle's metal panels. */
export function storyPauseMarkup() {
  return `<header class="story-pause-heading"><i class="story-pause-glyph" aria-hidden="true"></i><h2>${t("暂停")}</h2></header>
    <nav class="story-pause-options" aria-label="${t("游戏菜单")}">
      <button type="button" class="story-pause-option" id="resume"><span>${t("继续游戏")}</span><kbd>ESC</kbd></button>
      <button type="button" class="story-pause-option" id="restart"><span>${t("重玩本章")}</span></button>
      <button type="button" class="story-pause-option" id="home"><span>${t("返回首页")}</span></button>
    </nav>${languageSelect()}`;
}
