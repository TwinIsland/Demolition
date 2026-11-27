import { t } from "../i18n";
import { languageSelect } from "./graphics-options";
import { icon } from "./icons";

export function pauseMarkup() {
  return `<h2>${t("暂停")}</h2>${languageSelect()}<button class="primary" id="resume">${icon("play")} ${t("继续对局")}</button><div class="modal-actions"><button id="restart">${t("重新开局")}</button><button id="home">${t("返回首页")}</button></div>`;
}
