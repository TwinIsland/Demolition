import type { GameEvent, Player } from "../core/types";
import { ITEMS, SKILLS, TIERS, perkById } from "../core/content";
import { icon } from "./icons";
import { keyHint } from "./control-settings";
import { t, language } from "../i18n";

export class CombatFeed {
  private panel = document.createElement("aside");
  private entries: HTMLElement;
  private input: HTMLInputElement;
  private rows = new Map<HTMLElement, () => void>();
  get editing() {
    return this.panel.classList.contains("editing");
  }
  constructor(hud: HTMLElement) {
    this.panel.className = "combat-feed";
    this.panel.setAttribute("aria-label", "本局通讯");
    this.panel.innerHTML = `<header>${icon("chat")} 战场通讯 <small>本局</small></header>
      <div class="feed-lines" role="log" aria-live="polite"></div>
      <button id="chat-open">${keyHint("chat")} 聊天</button>
      <input hidden maxlength="160" autocomplete="off" aria-label="本局消息" placeholder="本局消息 · Enter 发送"/>`;
    hud.append(this.panel);
    this.entries = this.panel.querySelector(".feed-lines")!;
    this.input = this.panel.querySelector("input")!;
  }
  open() {
    this.panel.classList.add("editing");
    this.input.hidden = false;
    this.input.focus({ preventScroll: true });
    this.entries.scrollTop = this.entries.scrollHeight;
  }
  close() {
    this.input.blur();
    this.input.value = "";
    this.input.hidden = true;
    this.panel.classList.remove("editing");
    this.entries.scrollTop = this.entries.scrollHeight;
  }
  clear() {
    this.close();
    this.entries.replaceChildren();
    this.rows.clear();
  }
  refreshLanguage() {
    for (const render of this.rows.values()) render();
  }
  send(time: number) {
    const message = this.input.value.trim();
    if (message) this.add(time, "chat", "你", () => message, "#a1d7c2");
    this.close();
  }
  event(e: GameEvent, player: Player, localId: string) {
    const own = player.id === localId;
    const message = () => (language === "en" ? e.textEn : e.text);
    /** Loot and perk gains name the player; other players' gains show only when rare. */
    const gain = (icon: string, label: string, color: string, rare: boolean) => {
      if (own || rare)
        this.add(e.at, icon, label, () => `${own ? t("你") : player.name} · ${message()}`, color, rare);
    };
    switch (e.type) {
      case "mutation":
        if (own) this.add(e.at, "dna", "基因改造", message, "#8af1c7", true);
        break;
      case "pickup": {
        const item = ITEMS[e.item];
        if (item) {
          const elite = item.pool === "elite";
          gain(item.icon, elite ? "精英战利品" : "补给", item.color, elite);
        }
        break;
      }
      case "perk":
      case "perk-use": {
        const perk = perkById(e.perk);
        if (perk)
          gain(
            perk.icon,
            perk.use ? "主动强化" : TIERS[perk.tier].name,
            TIERS[perk.tier].color,
            perk.tier !== "silver",
          );
        break;
      }
      case "kill":
        this.add(e.at, "target", "淘汰", message, "#eea184");
        break;
      case "level":
        if (own) this.add(e.at, "surge", "升级", message, "#e9cb83");
        break;
      case "hit":
        if (own) this.add(e.at, "target", "战报", message, "#a3b5aa");
        break;
      case "cover": {
        const item = e.item ? ITEMS[e.item] : undefined;
        if (own) this.add(e.at, item?.icon ?? "bomb", item?.melee ? "拆除" : "爆破", message, "#c9b78d");
        break;
      }
      case "skill":
        if (own) this.add(e.at, SKILLS[e.skill]?.icon || "surge", "技能", message, "#9accc8");
        break;
      case "equipment":
        if (own) this.add(e.at, ITEMS[e.item]?.icon ?? "shield", "装备", message, "#d5c9a4");
        break;
      case "hurt":
        if (own) this.add(e.at, e.blocked ? "shield" : "heart", "战报", message, "#ddab98");
        break;
      case "shield-end":
        if (own && e.reason === "broken") this.add(e.at, "shield", "战报", message, "#a2d8e0");
        break;
    }
  }
  private add(
    time: number,
    glyph: string,
    label: string,
    message: () => string,
    color: string,
    rare = false,
  ) {
    const follow =
      !this.editing || this.entries.scrollHeight - this.entries.scrollTop - this.entries.clientHeight < 10;
    const row = document.createElement("div");
    row.className = rare ? "feed-row rare" : "feed-row";
    row.style.setProperty("--feed-accent", color);
    row.innerHTML = `<time></time>${icon(glyph)}<b></b><span></span>`;
    row.querySelector("time")!.textContent =
      `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
    const render = () => {
      row.querySelector("b")!.textContent = t(label);
      row.querySelector("span")!.textContent = message();
    };
    render();
    this.rows.set(row, render);
    this.entries.append(row);
    if (this.entries.childElementCount > 60) {
      const oldest = this.entries.firstElementChild as HTMLElement;
      this.rows.delete(oldest);
      oldest.remove();
    }
    if (follow) this.entries.scrollTop = this.entries.scrollHeight;
  }
}
