import { SHOP_SKILLS, SKILLS, SLOT_LIMIT } from "../core/content";
import type { Player, SkillId } from "../core/types";
import type { StoryShopOptions } from "../story/stage";
import { field, t } from "../i18n";
import { query } from "./dom";
import { artIcon } from "./icons";
import { skillKeyHint } from "./skill-bar";

const owns = (player: Player, id: SkillId) => player.skills.includes(id);
const unaffordable = (player: Player, id: SkillId) =>
  !owns(player, id) && (player.credits < SKILLS[id].price || player.skills.length >= SLOT_LIMIT);
const tradeLabel = (player: Player, id: SkillId) =>
  `${owns(player, id) ? t("退还") : t("购买")} · ${SKILLS[id].price}`;
const slotCount = (player: Player) => `${player.skills.length} / ${SLOT_LIMIT}`;

export function shopMarkup(player: Player, { requiredSkills }: StoryShopOptions = {}) {
  const cards = SHOP_SKILLS.map((id) => {
    const skill = SKILLS[id];
    const required = requiredSkills?.includes(id);
    const locked = requiredSkills && !required;
    return `<button class="shop-card ${owns(player, id) ? "purchased" : ""}" ${required ? 'data-tutorial-required="true"' : ""} data-trade="${id}" data-refund="${owns(player, id)}" ${locked || unaffordable(player, id) ? "disabled" : ""}>
        ${artIcon(skill)}<strong>${field(skill, "name")}</strong>${skillKeyHint(id)}
        <small>${field(skill, "description")}</small><b>${tradeLabel(player, id)}</b></button>`;
  }).join("");
  // The full-width space keeps the two counters apart without extra markup.
  return `<header><h2>${t("技能商店")}</h2><p>${t("资金")} <b data-credits>${player.credits}</b>\u3000${t("技能槽")} <b data-slots>${slotCount(player)}</b></p></header>
      ${requiredSkills ? `<p class="shop-lesson">${t("购买金框中的两项技能后继续")}：${requiredSkills.map((id) => field(SKILLS[id], "name")).join("、")}</p>` : ""}
      <div class="shop-grid">${cards}</div><button class="primary" id="deploy" ${requiredSkills?.some((id) => !owns(player, id)) ? "disabled" : ""}>${t(requiredSkills ? "继续教学" : "部署入场")}</button>`;
}

/** Patches an open shop in place so focus stays on the card that was just traded. */
export function updateShop(shop: HTMLElement, player: Player) {
  const required = shop.dataset.requiredSkills?.split(" ");
  query(shop, "[data-credits]").textContent = String(player.credits);
  query(shop, "[data-slots]").textContent = slotCount(player);
  for (const card of shop.querySelectorAll<HTMLButtonElement>("[data-trade]")) {
    const id = card.dataset.trade as SkillId;
    card.dataset.refund = String(owns(player, id));
    card.disabled = (!!required && !required.includes(id)) || unaffordable(player, id);
    card.classList.toggle("purchased", owns(player, id));
    query(card, "b").textContent = tradeLabel(player, id);
  }
  query<HTMLButtonElement>(shop, "#deploy").disabled = required?.some((id) => !owns(player, id)) ?? false;
}
