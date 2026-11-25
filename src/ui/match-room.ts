import { t, field } from "../i18n";
import {
  SKINS,
  BOT_PROFILES,
  BOMB_STYLES,
  ZOMBIE_RATES,
  type Appearance,
  type BotSlot,
  type ZombieRate,
} from "../core/room";
import { icon } from "./icons";
import { MATCH_MODES, type MatchMode } from "../core/match-modes";
import { ZONE } from "../core/zone";
import "./match-room.css";

const DIFFICULTY_LABELS = { easy: "简单", normal: "普通", hard: "困难", adaptive: "自适应" };
function seat(id: string, index: number, color: string) {
  const bot = index !== 0;
  return `<article class="player-card" data-seat="${id}" style="--seat-color:${color}">
    <header><span>${bot ? t("AI 对手") : t("本机玩家")}</span>${
      bot
        ? `<label class="seat-switch"><input type="checkbox" data-bot="${id}" aria-label="${t("启用 {0}", id.toUpperCase())}"><i></i></label>`
        : icon("crown")
    }</header>
    <div class="player-view"><div class="player-anchor" aria-hidden="true"></div><span class="seat-empty">${t("空位")}</span></div>
    <div class="player-info"><h3>${bot ? id.toUpperCase() : t("你")}</h3>
    ${
      bot
        ? `<label>${t("角色")}<select data-bot="${id}" data-setting="skin"></select></label>
      <label>${t("难度")}<select data-bot="${id}" data-setting="difficulty"></select></label>`
        : `<div>${t("角色")}<b data-outfit="skin"></b></div><div>${t("涂装")}<b data-outfit="finish"></b></div>`
    }</div></article>`;
}
export function roomMarkup(slots: BotSlot[]) {
  return `<header class="room-heading"><div><div class="room-modes"><strong>${t("本地训练")}</strong><button disabled>${t("真人匹配 · 未开放")}</button></div>
      <h2>${t("匹配房间")}</h2></div><div class="room-location">${icon("map")}<span></span></div></header>
    <div class="room-config"><strong>${t("参战人员")} <b data-occupancy></b></strong>
      <label>${t("僵尸刷新频率")}<select id="zombie-rate"></select></label>
      <label title="${t("安全区缩到最小所需的时间")}">${t("对局时长")}<select id="zone-duration"></select></label></div>
    <div class="room-roster">${seat("you", 0, "#dbb775")}${slots.map((s, i) => seat(s.id, i + 1, BOT_PROFILES.find((p) => p.id === s.id)!.color)).join("")}</div>
    <footer class="room-actions"><button id="home">${t("返回主页")}</button><button class="primary" id="room-confirm">${t("进入技能商店")} ${icon("play")}</button></footer>`;
}
function selectValue(select: HTMLSelectElement, choices: Record<string, string>, value: string) {
  if (!select.options.length)
    for (const [id, name] of Object.entries(choices))
      select.add(new Option(choices === DIFFICULTY_LABELS ? t(name) : name, id));
  select.value = value;
}
export function updateRoom(
  room: HTMLElement,
  slots: BotSlot[],
  look: Appearance,
  mapName: string,
  rate: ZombieRate,
  draw: (canvas: HTMLElement, skin: string, seat: number) => Promise<void>,
  mode: MatchMode,
  zoneDuration: number = ZONE.defaultDuration,
) {
  const count = 1 + slots.filter((s) => s.enabled).length;
  room.querySelector("[data-occupancy]")!.textContent = `${count} / 4`;
  room.querySelector(".room-location span")!.textContent = mapName;
  room.querySelector(".room-modes strong")!.textContent = t(MATCH_MODES[mode].name);
  room.querySelector('[data-outfit="skin"]')!.textContent = SKINS[look.skin]
    ? field(SKINS[look.skin], "name")
    : t("自定义");
  room.querySelector('[data-outfit="finish"]')!.textContent = field(BOMB_STYLES[look.bombStyle], "name");
  selectValue(
    room.querySelector<HTMLSelectElement>("#zombie-rate")!,
    Object.fromEntries(Object.entries(ZOMBIE_RATES).map(([k, v]) => [k, t(v.name)])),
    rate,
  );
  selectValue(
    room.querySelector<HTMLSelectElement>("#zone-duration")!,
    Object.fromEntries(ZONE.durations.map((seconds) => [String(seconds), t("{0} 秒", seconds)])),
    String(zoneDuration),
  );
  const confirm = room.querySelector<HTMLButtonElement>("#room-confirm")!;
  confirm.disabled = mode !== "practice" && count < 2;
  confirm.title = confirm.disabled ? t("至少启用一名 AI 对手") : "";
  room.querySelectorAll<HTMLElement>("[data-seat]").forEach((card, index) => {
    const slot = slots.find((s) => s.id === card.dataset.seat);
    const skin = slot?.skin ?? look.skin;
    if (slot) {
      card.classList.toggle("empty", !slot.enabled);
      card.querySelector("input")!.checked = slot.enabled;
      const select = card.querySelector<HTMLSelectElement>('[data-setting="skin"]')!;
      selectValue(
        select,
        Object.fromEntries(Object.values(SKINS).map((s) => [s.id, field(s, "name")])),
        slot.skin,
      );
      const difficulty = card.querySelector<HTMLSelectElement>('[data-setting="difficulty"]')!;
      selectValue(difficulty, DIFFICULTY_LABELS, slot.difficulty);
      select.disabled = difficulty.disabled = !slot.enabled;
    }
    const canvas = card.querySelector<HTMLElement>(".player-anchor")!;
    if (slot?.enabled !== false && canvas.dataset.skin !== skin) {
      canvas.dataset.skin = skin;
      void draw(canvas, skin, index).catch(console.error);
    }
  });
}
