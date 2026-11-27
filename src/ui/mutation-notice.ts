import { MUTATIONS } from "../core/mutations";
import type { MutationId } from "../core/types";
import { field, t } from "../i18n";
import { artIcon, icon } from "./icons";
import "./mutation-notice.css";

export class MutationNotice {
  private queue: MutationId[] = [];
  private active?: MutationId;
  private until = 0;
  private panel = document.createElement("aside");
  constructor(hud: HTMLElement) {
    this.panel.className = "mutation-notice";
    this.panel.setAttribute("role", "status");
    this.panel.hidden = true;
    hud.append(this.panel);
  }
  push(id: MutationId) {
    if (MUTATIONS[id]) this.queue.push(id);
  }
  update(time: number) {
    if (this.active && time < this.until) return false;
    if (!this.active && !this.queue.length) return false;
    this.active = this.queue.shift();
    this.panel.hidden = !this.active;
    if (!this.active) return false;
    this.until = time + 2.25;
    this.refresh();
    return true;
  }
  refresh() {
    if (!this.active) return;
    const m = MUTATIONS[this.active];
    this.panel.innerHTML = `<div class="gene-scan"></div><div class="gene-emblem">${artIcon("mutations", m.id, m.icon)}</div>
      <div class="gene-result"><small>${icon("dna")}${t("基因改造")}</small><strong>${field(m, "name")}</strong>
      <span>${field(m, "description")}</span></div>`;
  }
  clear() {
    this.queue = [];
    this.active = undefined;
    this.panel.hidden = true;
  }
}
