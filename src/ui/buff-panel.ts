import { SKILLS, TIERS, perkById } from "../core/content";
import { MUTATIONS } from "../core/mutations";
import { field, t } from "../i18n";
import { keyHint } from "./control-settings";
import { HtmlSlot } from "./dom";
import { icon } from "./icons";
import type { HudFrame, HudView } from "./view";

export const activePerkBadge = () => `<span class="active-perk-badge">${t("主动强化")}</span>`;

const GENE_COLOR = "#83f5c8";

/** Everything currently modifying the viewer: usable perks, running skills, passive perks, genes. */
export class BuffPanelView implements HudView {
  private readonly panel: HtmlSlot;

  constructor(readonly root: HTMLElement) {
    this.panel = new HtmlSlot(root);
  }

  update(frame: HudFrame) {
    const { passive, usable } = this.perks(frame);
    const genes = this.genes(frame);
    this.panel.render(
      this.usablePerks(usable) +
        this.runningSkills(frame) +
        (passive || genes ? `<div class="buff-icons">${passive}${genes}</div>` : ""),
    );
  }

  /** Splits held perks into passive icons and rows for the ones that can be triggered. */
  private perks({ snapshot, viewer, selectedPerk }: HudFrame) {
    const stacks = new Map<string, number>();
    for (const id of viewer.perks) stacks.set(id, (stacks.get(id) ?? 0) + 1);
    const usable: string[] = [];
    let passive = "";
    for (const [id, count] of stacks) {
      const perk = perkById(id)!;
      const color = TIERS[perk.tier].color;
      if (!perk.use) {
        passive += `<span class="buff-icon tier-${perk.tier}" style="--buff-color:${color}" title="${field(perk, "name")} ×${count} · ${field(perk, "description")}">${icon(perk.icon)}${count > 1 ? `<b>${count}</b>` : ""}</span>`;
        continue;
      }
      const selected = id === selectedPerk;
      const disabled =
        !viewer.alive || snapshot.phase !== "playing" || (perk.canUse && !perk.canUse(viewer, snapshot));
      usable.push(`<li><button type="button" class="active-perk tier-${perk.tier}" data-use-perk="${id}" aria-current="${selected}" style="--buff-color:${color}" title="${field(perk, "description")}" ${disabled ? "disabled" : ""}>
            ${icon(perk.icon)}${activePerkBadge()}<span class="active-perk-caption"><span>${field(perk, "name")}${count > 1 ? " ×" + count : ""}</span>${selected ? keyHint("usePerk") : ""}</span>
          </button></li>`);
    }
    return { passive, usable };
  }

  private usablePerks(rows: string[]) {
    if (!rows.length) return "";
    // The cycle key only matters when there is more than one perk to choose from.
    const cycleHint = rows.length > 1 ? keyHint("browsePerks") : "";
    return `<section class="active-perk-list"><header>${t("主动强化")}<span>${cycleHint}</span></header><ul>${rows.join("")}</ul></section>`;
  }

  private runningSkills({ snapshot, viewer }: HudFrame) {
    return viewer.skills
      .map((id) => {
        const skill = SKILLS[id];
        const remaining = (skill?.activeUntil?.(viewer) ?? 0) - snapshot.time;
        if (skill?.isActive?.(viewer, snapshot.time))
          return `<span>${icon(skill.icon)}${field(skill, "name")}</span>`;
        return remaining > 0
          ? `<span>${icon(skill.icon)}${field(skill, "name")} ${Math.ceil(remaining)}s</span>`
          : "";
      })
      .join("");
  }

  private genes({ viewer }: HudFrame) {
    return Object.entries(viewer.mutations ?? {})
      .map(([id, count]) => {
        const gene = MUTATIONS[id];
        return gene
          ? `<span class="buff-icon" style="--buff-color:${GENE_COLOR}" title="${t("基因改造")} · ${field(gene, "name")} ×${count} · ${field(gene, "description")}">${icon(gene.icon)}${count > 1 ? `<b>${count}</b>` : ""}</span>`
          : "";
      })
      .join("");
  }

  dispose() {}
}
