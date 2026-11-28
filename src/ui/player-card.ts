/**
 * Second line of a HUD player card: combat stats plus perk and gene icons.
 * Icons fill at most two rows; anything beyond collapses into one "…" chip
 * whose tooltip lists what is hidden.
 */
import { TIERS, perkById } from "../core/content";
import { MUTATIONS } from "../core/mutations";
import type { Player } from "../core/types";
import { field, t } from "../i18n";
import { icon } from "./icons";

const CARD_BUFFS_PER_ROW = 8;
const MAX_BUFFS = CARD_BUFFS_PER_ROW * 2;
const GENE_COLOR = "#83f5c8";

interface CardBuff {
  glyph: string;
  color: string;
  count: number;
  label: string;
}

const escapeAttr = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function cardBuffs(player: Player): CardBuff[] {
  const stacks = new Map<string, number>();
  for (const id of player.perks) stacks.set(id, (stacks.get(id) ?? 0) + 1);
  const buffs: CardBuff[] = [];
  for (const [id, count] of stacks) {
    const perk = perkById(id);
    if (perk)
      buffs.push({ glyph: perk.icon, color: TIERS[perk.tier].color, count, label: field(perk, "name") });
  }
  for (const [id, count] of Object.entries(player.mutations ?? {})) {
    const gene = MUTATIONS[id];
    if (gene && count > 0)
      buffs.push({ glyph: gene.icon, color: GENE_COLOR, count, label: field(gene, "name") });
  }
  return buffs;
}

const stack = (buff: CardBuff) => (buff.count > 1 ? `${buff.label} ×${buff.count}` : buff.label);

export function playerCardExtras(player: Player): string {
  const stats =
    `<span class="card-stats">` +
    `<span title="${t("攻击力")}">${icon("target")}${Math.round(player.attack)}</span>` +
    `<span title="${t("爆炸范围")}">${icon("flask")}${player.range}</span>` +
    `<span title="${t("炸药数量")}">${icon("bubble")}${player.capacity}</span>` +
    `<span title="${t("移动速度")}">${icon("speed")}${player.speed.toFixed(1)}</span></span>`;
  const buffs = cardBuffs(player);
  if (!buffs.length) return stats;
  const overflow = buffs.length > MAX_BUFFS;
  const shown = overflow ? buffs.slice(0, MAX_BUFFS - 1) : buffs;
  const chips = shown
    .map(
      (buff) =>
        `<i class="card-buff" style="--buff-color:${buff.color}" title="${escapeAttr(stack(buff))}">${icon(buff.glyph)}${buff.count > 1 ? `<b>${buff.count}</b>` : ""}</i>`,
    )
    .join("");
  const more = overflow
    ? `<i class="card-buff card-buff-more" title="${escapeAttr(
        buffs
          .slice(MAX_BUFFS - 1)
          .map(stack)
          .join("\n"),
      )}">…</i>`
    : "";
  return `${stats}<span class="card-buffs">${chips}${more}</span>`;
}
