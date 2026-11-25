import { ITEMS, PERKS, SKILLS, TIERS, isEquipment } from "../core/content";
import { MUTATIONS } from "../core/mutations";
import { field, t } from "../i18n";
import { skillBinding } from "../input/bindings";
import { activePerkBadge } from "./buff-panel";
import { bindingButton, controlSettings, quickEquipControl } from "./control-settings";
import { icon } from "./icons";

interface ManualEntry {
  glyph: string;
  name: string;
  description: string;
  detail?: string;
  color?: string;
  /** Markup for a key-binding control under the description. */
  control?: string;
  badge?: string;
}

const entry = ({
  glyph,
  name,
  description,
  detail = "",
  color = "#becdc4",
  control = "",
  badge = "",
}: ManualEntry) =>
  `<li style="--entry-color:${color}">${icon(glyph)}<div class="guide-card-body">
        <div class="guide-card-heading"><span><b>${name}</b> <small>${detail}</small></span>${badge}</div>
        <p class="guide-description">${description}</p>${control}</div></li>`;

const section = (category: string, title: string, rows: string[]) =>
  `<details class="guide-section" data-category="${category}" open><summary>${title}<small>${rows.length}</small></summary><ul>${rows.join("")}</ul></details>`;

function skillEntries() {
  return Object.values(SKILLS).map((skill) => {
    const name = field(skill, "name");
    const detail = [`${skill.price} ${t("资金")}`];
    if (skill.passive) detail.push(t("被动"));
    if (skill.cooldown) detail.push(`${t("冷却")} ${skill.cooldown} ${t("秒")}`);
    return entry({
      glyph: skill.icon,
      name,
      description: field(skill, "description"),
      detail: detail.join(" · "),
      color: "#dcc18b",
      control: skill.passive ? "" : bindingButton(skillBinding(skill.id), t("快捷键"), name),
    });
  });
}

function perkEntries() {
  return Object.keys(TIERS).flatMap((tier) =>
    PERKS.filter((perk) => perk.tier === tier).map((perk) =>
      entry({
        glyph: perk.icon,
        name: field(perk, "name"),
        description: field(perk, "description"),
        detail: t(TIERS[perk.tier].name),
        color: TIERS[perk.tier].color,
        badge: perk.use ? activePerkBadge() : "",
      }),
    ),
  );
}

function geneEntries() {
  return Object.values(MUTATIONS).map((gene) =>
    entry({
      glyph: gene.icon,
      name: field(gene, "name"),
      description: field(gene, "description"),
      color: "#83f5c8",
    }),
  );
}

function equipmentEntries() {
  const bomb = t("炸药");
  const rows = [
    entry({
      glyph: "bomb",
      name: bomb,
      description: t("部署在空地上，引信结束后产生十字爆炸。"),
      control: quickEquipControl("bomb", bomb),
    }),
  ];
  for (const item of Object.values(ITEMS)) {
    const name = field(item, "name");
    rows.push(
      entry({
        glyph: item.icon,
        name,
        description: field(item, "description"),
        color: item.color,
        control: isEquipment(item) ? quickEquipControl(item.id, name) : "",
      }),
    );
  }
  return rows;
}

/** Field manual: rebindable controls plus a generated catalogue of all registered content. */
export function manualMarkup(inGame: boolean) {
  return `<header class="manual-toolbar"><h2>${t("作战手册")}</h2><button type="button" data-reset-controls>${t("恢复默认键位")}</button></header>
      ${controlSettings()}${section("skills", t("商店技能"), skillEntries())}${section("perks", t("升级强化"), perkEntries())}${section("genes", t("基因改造"), geneEntries())}${section("equipment", t("物品与装备"), equipmentEntries())}<button class="primary" id="${inGame ? "resume" : "home"}">${t("返回")}</button>`;
}
