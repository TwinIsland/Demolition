import { TIERS, perkById } from "../core/content";
import type { Player } from "../core/types";
import { field, t } from "../i18n";
import { bindings } from "../input/bindings";
import { activePerkBadge } from "./buff-panel";
import { keyHint } from "./control-settings";
import { artIcon } from "./icons";

const OFFER_ACTIONS = ["reward1", "reward2", "reward3"] as const;

/**
 * Non-blocking tray of perk offers. Unlike the HUD views it exists only while an offer is open and
 * is checked every frame, so that the arrival cue is not delayed by the HUD refresh interval.
 */
export class PerkTray {
  private tray?: HTMLElement;

  /** `root` is the element the tray is appended to while open. */
  constructor(readonly root: HTMLElement) {}

  get cards(): HTMLElement[] {
    return this.tray ? Array.from(this.tray.querySelectorAll<HTMLElement>(".perk-card")) : [];
  }

  /** Shows the viewer's current offer. Returns true when a new offer appeared. */
  offer(viewer: Player): boolean {
    const old = this.tray;
    if (!viewer.alive || !viewer.offers.length) {
      this.clear();
      return false;
    }
    // One offer per level: the same level means the tray already shows it.
    if (old?.dataset.level === String(viewer.level)) return false;
    const tray = document.createElement("aside");
    tray.id = "perk-tray";
    tray.dataset.level = String(viewer.level);
    if (old?.classList.contains("expanded")) tray.classList.add("expanded");
    old?.remove();
    this.tray = tray;
    this.root.append(tray);
    const expand = keyHint("expand");
    tray.innerHTML = `<header class="perk-notice"><strong><i></i>${t("强化就绪")}</strong><span>LV. ${viewer.level}</span><small><span class="perk-quick">${expand} ${t("展开")}</span><span class="perk-open">${expand} ${t("收起")}</span></small></header><div class="perk-grid">${viewer.offers
      .map((id, i) => {
        const perk = perkById(id)!;
        const action = OFFER_ACTIONS[i];
        return `<button class="perk-card tier-${perk.tier}" data-perk="${perk.id}" style="--perk-color:${TIERS[perk.tier].color}">
          <span class="perk-card-tools"><span class="perk-key" data-keyhint="${action}">${bindings.label(action)}</span>${perk.use ? activePerkBadge() : ""}</span>
          <span class="perk-icon">${artIcon("perks", perk.id, perk.icon)}</span><small>${t(TIERS[perk.tier].name)}${perk.use ? "" : " · " + field(perk, "tag")}</small>
          <h3>${field(perk, "name")}</h3><p>${field(perk, "description")}</p><span class="perk-select">${t("选择强化")}</span></button>`;
      })
      .join("")}</div>`;
    return true;
  }

  toggleExpanded() {
    this.tray?.classList.toggle("expanded");
  }

  clear() {
    this.tray?.remove();
    this.tray = undefined;
  }

  /** Rebuilds an open tray in the current language, keeping it expanded or collapsed. */
  refreshLanguage(viewer: Player) {
    if (!this.tray) return;
    const expanded = this.tray.classList.contains("expanded");
    this.clear();
    this.offer(viewer);
    if (expanded) this.tray?.classList.add("expanded");
  }

  dispose() {
    this.clear();
  }
}
