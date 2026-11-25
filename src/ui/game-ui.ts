import { DEFAULT_SMOKE } from "../core/equipment";
import { version } from "../../package.json";
import { modifiedStat, ITEMS, PERKS, SKILLS, SHOP_SKILLS, SLOT_LIMIT, TIERS, isEquipment, perkById } from "../core/content";
import { SKINS, SKIN_PRESETS, BOMB_STYLES, type Appearance, type BotSlot, type AvatarSkin, type BombStyle } from "../core/room";
import { MAPS, generateMap, seededRandom } from "../core/maps";
import { DEFAULT_MODE, MATCH_MODES, type MatchMode } from "../core/match-modes";
import type { Difficulty, GameSnapshot, Player, SkillId } from "../core/types";
import { inTacticalView } from "../core/types";
import { roomMarkup, updateRoom } from "./match-room";
import "./reward-effects.css";
import "./equipment-wheel.css";
import "./deployment-menu.css";
import { EquipmentWheel } from "./equipment-wheel";
import { MutationNotice } from "./mutation-notice";
import { MUTATIONS } from "../core/mutations";
import { graphicsForm, graphicsChange, syncGraphics, languageSelect } from "./graphics-options";
import { bindShellCopy, field, t, type Language } from "../i18n";
import type { GraphicsSettings } from "../render/graphics-settings";
import type { ZombieRate } from "../core/room";
import { CombatFeed } from "./combat-feed";
import { icon } from "./icons";
import { drawMinimap } from "./minimap";
import { bindings, skillBinding, type Action, type BindingId } from "../input/bindings";
import { bindingButton, controlSettings, keyHint, mountControls, quickEquipControl } from "./control-settings";
const modeIds = Object.keys(MATCH_MODES) as MatchMode[];
const skillKeyHint = (id:SkillId) => SKILLS[id].passive ? `<kbd>${t("被动")}</kbd>` : keyHint(skillBinding(id));
const activePerkBadge = () => `<span class="active-perk-badge">${t("主动强化")}</span>`;

const skillButton = (id: SkillId) => {
  const skill = SKILLS[id],
    glyph = skill.icon;
  return `<button class="skill-button" data-skill="${id}" aria-label="${field(skill,"name")}"><span class="skill-visual">${icon(glyph)}<i class="clock-shade" id="${id}-progress"></i><svg class="clock-ring" viewBox="0 0 40 40" aria-hidden="true"><circle id="${id}-ring" cx="20" cy="20" r="18" pathLength="100"/></svg></span><span><b>${field(skill,"name")}</b><small id="${id}-time">就绪</small></span>${skillKeyHint(id)}</button>`;
};
export interface UICallbacks {
  skin(
    file: File | undefined,
    model: "auto" | "default" | "slim",
  ): Promise<void>;
  trade(id: SkillId, refund: boolean): void;
  chat(): void;
  deploy(): void;
  start(): void;
  resume(): void;
  restart(): void;
  home(): void;
  outfit(value: Partial<Appearance>): void;
  configureBot(id: string, changes: Partial<Pick<BotSlot,"skin" | "enabled" | "difficulty">>): void;
  zombieRate(value: ZombieRate): void;
  drawPortrait(canvas: HTMLElement, skin: string, seat: number): Promise<void>;
  enterShop(): void;
  map(id: string): void;
  mode(id: MatchMode): void;
  terrain(): void;
  pause(): void;
  help(): void;
  sound(): void;
  uiClick(): void;
  choose(id: string): void;
  usePerk(id: string): void;
  skill(id: SkillId): void;
  graphics(): void;
  changeGraphics(value: GraphicsSettings): void;
  closeGraphics(): void;
  language(value:Language):void;
}
export class GameUI {
  private refreshCopy:()=>void;
  private readonly fullscreenButton: HTMLButtonElement;
  private fullscreenPending = false;
  readonly feed: CombatFeed;
  private overlay: HTMLElement;
  private perkTray?: HTMLElement;
  private lastHud = "";
  readonly wheel: EquipmentWheel;
  readonly mutationNotice:MutationNotice;
  private lastBuffs = "";
  private heat: HTMLElement;
  private criticalVeil: HTMLElement;
  private lastDanger = 0;
  private resetWarning: HTMLElement;
  private collapseWarning: HTMLElement;
  private eventCursor = 0;
  private callbacks: UICallbacks;
  constructor(root: HTMLElement, callbacks: UICallbacks) {
    this.callbacks = callbacks;
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="vignette"></div><div id="damage"></div>
      <header class="topbar"><a class="brand" href="#" aria-label="爆破前线首页"><img class="brand-mark" src="./assets/menu/insignia.png" alt=""><span>爆破前线<small>DEMOLITION</small></span></a></header>
        <div class="top-actions" role="group" aria-label="游戏控制">
          <button class="icon-btn graphics-btn" id="graphics" title="设置">${icon("graphics")}<span>设置</span></button>
          <button class="icon-btn" id="fullscreen" type="button"></button>
          <button class="icon-btn" id="sound" aria-label="开启声音" title="开启声音">${icon("muted")}</button>
          <button class="icon-btn" id="help" aria-label="玩法说明" title="玩法说明">${icon("help")}</button>
          <button class="icon-btn game-only" id="pause" aria-label="暂停游戏" title="暂停 · Esc">${icon("pause")}</button>
        </div>
      <main id="lobby">
        <div class="lobby-scrim"></div>
        <div class="deployment-layout">
        <section class="hero">
          <div class="mode-picker">
            <div class="mode-list" role="group" aria-label="对局模式" style="--mode-count:${modeIds.length}">
              ${modeIds.map(id => `<button type="button" data-mode="${id}" aria-pressed="${id === DEFAULT_MODE}" ${MATCH_MODES[id].available ? "" : 'disabled title="尚未开放"'}>${MATCH_MODES[id].available ? "" : icon("lock")}${MATCH_MODES[id].name}</button>`).join("")}
            </div>
            <h1 aria-label="${MATCH_MODES[DEFAULT_MODE].name}">${modeIds.map(id => `<span data-mode-title="${id}" aria-hidden="true" class="${id === DEFAULT_MODE ? "current" : ""}">${MATCH_MODES[id].name}</span>`).join("")}</h1>
          </div>
          <div class="skin-controls outfit-controls">
            <label for="avatar-preset">角色皮肤</label><select id="avatar-preset">${Object.entries(SKIN_PRESETS).map(([id,name])=>`<option value="${id}">${name}</option>`).join("")}<option value="custom" disabled>自定义 PNG</option></select>
            <button id="skin-import">导入 PNG</button><input id="skin-file" type="file" accept="image/png" hidden/>
            <div class="arm-setting" hidden><label for="skin-model">自定义手臂</label><select id="skin-model"><option value="auto">自动识别</option><option value="default">标准 · Steve</option><option value="slim">纤细 · Alex</option></select></div>
            <label for="bomb-style">炸药涂装</label><select id="bomb-style">${Object.entries(BOMB_STYLES).map(([id,s])=>`<option value="${id}">${s.name}</option>`).join("")}</select>
            <small id="skin-status" role="status"></small>
          </div>
          <button class="start-btn" id="start">${icon("play")} 开始对局 <kbd>ENTER</kbd></button>
        </section>
        <div id="lobby-avatar" tabindex="0" role="group" aria-label="角色预览，可拖动或按方向键旋转"></div>
        <section class="map-selection" aria-label="作战区域"><div class="section-caption"><span>作战区域</span><button id="terrain-preview" aria-pressed="false">战场预览</button></div><div class="map-options">${MAPS.map((map, i) => `<button class="map-option ${i === 0 ? "selected" : ""}" data-map="${map.id}" aria-pressed="${i === 0}"><canvas class="map-miniature" width="${map.size}" height="${map.size}" aria-hidden="true"></canvas><span><b>${map.name}</b><small>${map.size} × ${map.size}</small></span><i class="selection-dot"></i></button>`).join("")}</div></section>
        </div>
        <footer class="design-credit"><a href="https://tianyihuang.com" target="_blank" rel="noopener noreferrer" lang="en">Game designed by TwinIsland</a><span>v${version}</span></footer>
      </main>
      <div id="hud" hidden>
        <div class="round-status"><span id="round-mode">${MATCH_MODES[DEFAULT_MODE].name}</span><b id="timer">03:00</b><span id="alive">4 / 4 存活</span><span id="terrain-reset-hint" hidden>${keyHint("resetTerrain")} 重置地形</span></div>
        <div id="players" class="players"></div>
        <aside class="radar"><div class="radar-title"><span>${icon("radar")} 战术雷达</span><span id="radar-state">在线</span></div><canvas id="minimap" width="260" height="260" aria-label="2D 战术地图，显示玩家、炸药和道具位置"></canvas><div class="radar-footer"><span id="radar-map">前哨基地</span><span><i></i> 你</span></div><div id="buffs" class="buffs"></div></aside>
        <div id="smoke-veil" aria-hidden="true"></div><div id="crosshair"><i></i></div><div id="countdown"></div>
        <div class="battle-heat" aria-hidden="true"></div>
        <div class="critical-veil" aria-hidden="true"></div>
        <div class="arena-warnings">
          <div class="reset-warning" role="status" hidden><span>灭世 · 地形重置</span><strong></strong></div>
          <div class="collapse-warning" role="status" hidden>${icon("collapse")}<span class="collapse-count-in">维度坍缩即将启动</span><span class="collapse-active">维度坍缩 · 二维视角</span><strong></strong></div>
        </div>
        <aside id="equipment-wheel"></aside>
        <div class="board-charge-hint">${icon("bubble")}<kbd>空格</kbd><span>原地放置炸药</span></div>
        <div class="bottom-hud"><div id="player-stats" class="player-stats"></div><div class="loadout"><div class="skill-buttons">${SHOP_SKILLS.map(skillButton).join("")}</div>
          </div></div>
      </div>
      <div id="overlay" hidden></div><div id="fatal" hidden role="alert"></div>`,
    );
    const wheel = root.querySelector<HTMLElement>("#equipment-wheel")!;
    this.heat = root.querySelector<HTMLElement>(".battle-heat")!;
    this.criticalVeil = root.querySelector<HTMLElement>(".critical-veil")!;
    this.resetWarning = root.querySelector<HTMLElement>(".reset-warning")!;
    this.collapseWarning = root.querySelector<HTMLElement>(".collapse-warning")!;
    this.wheel = new EquipmentWheel(wheel);
    this.mutationNotice = new MutationNotice(root.querySelector<HTMLElement>("#hud")!);
    for (const button of root.querySelectorAll<HTMLElement>("[data-map]")) {
      const map = MAPS.find(m => m.id === button.dataset.map)!;
      if (map.artwork) {
        const art = document.createElement("img");
        art.className = "map-art";
        art.alt = "";
        art.src = map.artwork;
        button.prepend(art);
      }
      const context = button.querySelector("canvas")!.getContext("2d")!;
      generateMap(map,seededRandom(74691)).forEach((row,z) => row.forEach((cell,x) => {
        context.fillStyle = ["#303a33","#b2baa6","#737e64"][cell];
        context.fillRect(x,z,1,1);
      }));
    }
    root.addEventListener("change", async (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      if (target.hasAttribute("data-language")) {
        if (target.value === "en" || target.value === "zh") callbacks.language(target.value);
        return;
      }
      const graphics = target.closest<HTMLFormElement>("#graphics-form");
      if (graphics) {
        const value = graphicsChange(graphics,target.name);
        callbacks.changeGraphics(value);
        syncGraphics(graphics,value);
        return;
      }
      if (target.id === "avatar-preset") { callbacks.outfit({skin:target.value as Appearance["skin"]});
        document.querySelector<HTMLElement>(".arm-setting")!.hidden=target.value!=="custom";
        document.querySelector("#skin-status")!.textContent=""; return; }
      if (target.id === "bomb-style") { callbacks.outfit({bombStyle:target.value as BombStyle}); return; }
      if (target.id === "zombie-rate") { callbacks.zombieRate(target.value as ZombieRate); return; }
      const bot = target.dataset.bot;
      if (bot) {
        if (target instanceof HTMLInputElement) callbacks.configureBot(bot,{enabled:target.checked});
        else if (target.dataset.setting === "skin") callbacks.configureBot(bot,{skin:target.value as AvatarSkin});
        else callbacks.configureBot(bot,{difficulty:target.value as Difficulty});
        return;
      }
      if (target.id !== "skin-file" && target.id !== "skin-model") return;
      const file =
        target.id === "skin-file"
          ? (target as HTMLInputElement).files?.[0]
          : undefined;
      const model = document.querySelector<HTMLSelectElement>("#skin-model")!
        .value as "auto" | "default" | "slim";
      const status = document.querySelector<HTMLElement>("#skin-status")!;
      status.textContent = t("加载中");
      try {
        await callbacks.skin(file, model);
        status.textContent = file ? file.name : t("模型已更新");
      } catch (error) {
        status.textContent =
          error instanceof Error ? error.message : t("皮肤加载失败");
      }
      if (target.id === "skin-file") (target as HTMLInputElement).value = "";
    });
    this.feed = new CombatFeed(root.querySelector<HTMLElement>("#hud")!);
    this.fullscreenButton = root.querySelector<HTMLButtonElement>("#fullscreen")!;
    document.addEventListener("fullscreenchange", () => this.syncFullscreen());
    const syncHints = () => {
      this.syncFullscreen();
      for (const el of root.querySelectorAll<HTMLElement>("[data-keyhint]")) {
        const id = el.dataset.keyhint as BindingId;
        el.textContent = bindings.label(id);
        if (id.startsWith("equip:")) el.hidden = !bindings.codes(id).length;
      }
      root.querySelector("#pause")!.setAttribute("title",t("暂停 · {0}",bindings.label("pause")));
      root.querySelector("#equipment-wheel")!.setAttribute("aria-label",t("按住 {0}，移动鼠标，松开装备",bindings.label("gearWheel")));
    };
    syncHints();
    bindings.addEventListener("change",syncHints);
    const shellCopy = bindShellCopy(root);
    this.refreshCopy = () => {
      shellCopy();
      syncHints();
      for (const option of root.querySelectorAll<HTMLOptionElement>("#avatar-preset option"))
        if (SKINS[option.value]) option.textContent = field(SKINS[option.value],"name");
      for (const option of root.querySelectorAll<HTMLOptionElement>("#bomb-style option"))
        option.textContent = field(BOMB_STYLES[option.value],"name");
      for (const map of MAPS) root.querySelector(`[data-map="${map.id}"] b`)!.textContent = field(map,"name");
      for (const skill of SHOP_SKILLS) {
        const button = root.querySelector<HTMLButtonElement>(`[data-skill="${skill}"]`)!;
        button.ariaLabel = field(SKILLS[skill],"name");
        button.querySelector("b")!.textContent = button.ariaLabel;
        if (SKILLS[skill].passive) button.querySelector("kbd")!.textContent = t("被动");
      }
    };
    this.refreshCopy();
    this.overlay = document.querySelector("#overlay")!;
    root.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>(
        "button, .brand, summary",
      );
      if (!button || button.matches(":disabled")) return;
      const id = button.id;
      if (button.classList.contains("brand")) {
        e.preventDefault();
        return callbacks.home();
      }
      if (id === "start") return callbacks.start();
      if (id === "room-confirm") return callbacks.enterShop();
      if (id === "help" || id === "help-menu") return callbacks.help();
      if (id === "pause") return callbacks.pause();
      if (id === "resume") return callbacks.resume();
      if (id === "restart") return callbacks.restart();
      if (id === "home") return callbacks.home();
      if (id === "deploy") return callbacks.deploy();
      if (id === "graphics") return callbacks.graphics();
      if (id === "graphics-done") return callbacks.closeGraphics();
      if (id === "terrain-preview") return callbacks.terrain();
      if (id === "sound") return callbacks.sound();
      if (!button.matches("[data-skill],[data-perk]")) callbacks.uiClick();
      if (button.dataset.mode) {
        const mode = button.dataset.mode as MatchMode;
        if (MATCH_MODES[mode]?.available) callbacks.mode(mode);
        return;
      }
      if (id === "skin-import")
        document.querySelector<HTMLInputElement>("#skin-file")!.click();
      else if (id === "fullscreen") void this.toggleFullscreen();
      else if (button.dataset.trade) callbacks.trade(button.dataset.trade as SkillId, button.dataset.refund === "true");
      else if (id === "chat-open") callbacks.chat();
      else if (button.dataset.map) callbacks.map(button.dataset.map);
      else if (button.dataset.perk) callbacks.choose(button.dataset.perk);
      else if (button.dataset.usePerk) callbacks.usePerk(button.dataset.usePerk);
      else if (button.dataset.skill)
        callbacks.skill(button.dataset.skill as SkillId);
    });
  }
  refreshLanguage(self:Player) {
    this.refreshCopy();
    this.wheel.refreshLanguage();
    this.feed.refreshLanguage();
    this.mutationNotice.refresh();
    if (this.perkTray) {
      const expanded = this.perkTray.classList.contains("expanded");
      this.clearPerks();
      this.perks(self);
      if (expanded) this.perkTray?.classList.add("expanded");
    }
    this.lastHud = this.lastBuffs = "";
  }
  setAppearance(value: Appearance) {
    const preset=document.querySelector<HTMLSelectElement>("#avatar-preset")!;
    const custom=preset.querySelector<HTMLOptionElement>('[value="custom"]')!;
    if (value.skin==="custom") custom.disabled=false;
    try {
      if (localStorage.getItem("demolition-skin")) custom.disabled=false;
      const model=localStorage.getItem("demolition-skin-model");
      if (model==="default" || model==="slim" || model==="auto") document.querySelector<HTMLSelectElement>("#skin-model")!.value=model;
    } catch {}
    preset.value=value.skin;
    document.querySelector<HTMLElement>(".arm-setting")!.hidden=value.skin!=="custom";
    document.querySelector<HTMLSelectElement>("#bomb-style")!.value=value.bombStyle;
  }
  room(slots: BotSlot[], look: Appearance, mapName: string, rate: ZombieRate, mode:MatchMode) {
    if (!this.overlay.querySelector(".room-modal")) this.show(roomMarkup(slots), "room-modal");
    updateRoom(this.overlay.querySelector<HTMLElement>(".room-modal")!, slots, look, mapName, rate, this.callbacks.drawPortrait,mode);
  }
  setMode(game: boolean) {
    this.mutationNotice.clear();
    document.body.classList.toggle("in-game", game);
    document.querySelector<HTMLElement>("#lobby")!.hidden = game;
    document.querySelector<HTMLElement>("#hud")!.hidden = !game;
    this.hideOverlay();
    this.clearPerks();
    document.querySelector("#rank-up")?.remove();
    this.feed.clear();
    this.eventCursor = 0;
    document.querySelector("#damage")!.classList.remove("flash");
    this.lastHud = "";
    this.lastBuffs = "";
  }
  setMatchMode(mode: MatchMode) {
    document.querySelector<HTMLElement>(".mode-list")!.style.setProperty("--selected",String(modeIds.indexOf(mode)));
    document.querySelector(".mode-picker h1")!.setAttribute("aria-label",t(MATCH_MODES[mode].name));
    document.querySelectorAll<HTMLElement>("[data-mode-title]").forEach(el => el.classList.toggle("current",el.dataset.modeTitle === mode));
    document.querySelector("#round-mode")!.textContent = t(MATCH_MODES[mode].name);
    document.querySelectorAll<HTMLElement>("[data-mode]").forEach(b =>
      b.setAttribute("aria-pressed",String(b.dataset.mode === mode)));
  }
  terrainPreview(active: boolean) {
    const button = document.querySelector<HTMLButtonElement>("#terrain-preview")!;
    button.setAttribute("aria-pressed",String(active));
    button.textContent = active ? t("返回部署界面") : t("战场预览");
  }
  setMap(id: string) {
    document.querySelectorAll<HTMLElement>("[data-map]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.map === id);
      b.setAttribute("aria-pressed", String(b.dataset.map === id));
    });
  }
  private syncFullscreen() {
    const button = this.fullscreenButton;
    const active = Boolean(document.fullscreenElement);
    button.disabled = !active && !document.fullscreenEnabled;
    button.innerHTML = icon(active ? "exitFullscreen" : "fullscreen");
    button.setAttribute("aria-pressed", String(active));
    button.ariaLabel = t("切换全屏");
    const label = active ? t("退出全屏") : t("进入全屏");
    const shortcut = bindings.label("fullscreen");
    button.title = button.disabled ? t("当前环境不支持全屏")
      : shortcut === "—" ? label : `${label} · ${shortcut}`;
  }
  async toggleFullscreen() {
    if (this.fullscreenPending || this.fullscreenButton.disabled) return;
    this.fullscreenPending = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.fullscreenButton.title = t("无法切换全屏");
    } finally {
      this.fullscreenPending = false;
    }
  }
  setSound(on: boolean) {
    const b = document.querySelector<HTMLButtonElement>("#sound")!;
    b.innerHTML = icon(on ? "volume" : "muted");
    b.title = b.ariaLabel = on ? t("关闭声音") : t("开启声音");
  }
  battleFire(layer:string, seconds?:number) {
    if (this.heat.dataset.layer !== layer) this.heat.dataset.layer = layer;
    const visible = seconds !== undefined && seconds > 0;
    if (this.resetWarning.hidden === visible) this.resetWarning.hidden = !visible;
    if (visible && this.resetWarning.lastElementChild!.textContent !== String(seconds))
      this.resetWarning.lastElementChild!.textContent = String(seconds);
  }
  showCollapse(seconds:number, pending:boolean) {
    const banner = this.collapseWarning;
    if (banner.hidden !== (seconds <= 0)) banner.hidden = seconds <= 0;
    if (banner.hidden) return;
    banner.toggleAttribute("data-pending", pending);
    const value = String(seconds);
    if (banner.lastElementChild!.textContent !== value) banner.lastElementChild!.textContent = value;
  }
  showHealthDanger(healthFraction:number) {
    const danger = healthFraction <= .30 ? .38 + .62*(1-Math.max(0,healthFraction)/.30) : 0;
    if (danger === this.lastDanger) return;
    this.lastDanger = danger;
    this.criticalVeil.toggleAttribute("data-active",danger > 0);
    this.criticalVeil.style.setProperty("--blood-opacity",String(danger));
    this.criticalVeil.style.setProperty("--breath-cycle",`${2.85-1.35*danger}s`);
  }
  update(state: Readonly<GameSnapshot>, self: Player, landing?:{x:number;z:number;valid:boolean}, selectedPerk?:string, browsingPerks=false) {
    const density = state.smoke.reduce((max,c)=>Math.max(max,
      Math.min(1,((c.radius ?? DEFAULT_SMOKE.radius)-Math.hypot(self.x-c.x,self.z-c.z))/.55,
        ((c.duration ?? DEFAULT_SMOKE.duration)-c.expiresAt+state.time)*4,(c.expiresAt-state.time)*2)),0);
    document.querySelector<HTMLElement>("#smoke-veil")!.style.opacity=String(self.alive && !inTacticalView(self,state.time) ? density*.76 : 0);
    const practice = state.mode === "practice";
    const seconds = practice ? Math.floor(state.time) : Math.max(0, Math.ceil(state.duration - state.time));
    document.querySelector<HTMLElement>("#terrain-reset-hint")!.hidden = !state.canResetTerrain || state.phase !== "playing";
    document.querySelector("#timer")!.textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    document.querySelector("#alive")!.textContent =
      t("{0} / {1} 存活",state.players.filter(p=>p.alive).length,state.players.length);
    document.querySelector("#countdown")!.innerHTML =
      state.phase === "countdown"
        ? `<span>${t("准备开始")}</span><b>${Math.ceil(state.countdown)}</b>`
        : "";
    const signature = JSON.stringify(
      state.players.map((p) => [
        p.hp,
        p.maxHp,
        p.attack,
        p.score,
        p.alive,
        p.level,
        p.xp,
        p.range,
        p.capacity,
        p.speed,
        Math.ceil(p.shield),
        p.kills,
        p.perks,
      ]),
    );
    if (signature !== this.lastHud) {
      this.lastHud = signature;
      document.querySelector("#players")!.innerHTML = state.players
        .map(
          (p) =>
            `<div class="player-row ${p.id === self.id ? "self" : ""} ${p.alive ? "" : "eliminated"}"><span class="avatar" style="--player-color:${p.color}"><i></i><i></i></span><span class="player-name">${p.id === self.id ? t("你") : p.name}<small>${p.bot ? t("电脑玩家") : t("本人")} · LV.${p.level}</small></span><span class="row-hearts"><i class="enemy-health"><i style="width:${100*p.hp/p.maxHp}%;background:${p.color}"></i></i>${p.alive ? `${practice && !p.bot ? "∞" : Math.ceil(p.hp)} HP` : t("已淘汰")}</span></div>`,
        )
        .join("");
      document.querySelector("#player-stats")!.innerHTML =
        `<div class="health-row"><span class="health-icon">${icon("heart")}</span><b>${practice && !self.bot ? "∞" : `${Math.ceil(self.hp)}<small> / ${self.maxHp}</small>`}</b>${self.shield ? `<span class="shield-count">${icon("shield")}${Math.ceil(self.shield)}s</span>` : ""}</div><div class="hp-gauge"><i style="width:${(self.hp / self.maxHp) * 100}%"></i></div><div id="stamina" role="meter" aria-label="${t("体力")}" aria-valuemin="0"><i></i><span></span></div><div class="xp-label"><b>LV. ${self.level}</b><span>${t("强化积分")} <em>${self.xp} / ${self.nextLevel}</em></span></div><div class="xp-track"><i style="width:${Math.min(100, (self.xp / self.nextLevel) * 100)}%"></i></div><div class="stat-values"><span title="${t("总积分")}">${icon("crown")} ${self.score}</span><span title="${t("攻击力")}">${icon("target")} ${Math.round(self.attack)}</span><span>${icon("flask")} ${self.range} ${t("格")}</span><span>${icon("speed")} ${self.speed.toFixed(1)}</span></div>`;
    }
    const energy = document.querySelector<HTMLElement>("#stamina")!;
    const current = Math.ceil(self.stamina);
    energy.style.setProperty("--energy", `${100*self.stamina/self.maxStamina}%`);
    energy.setAttribute("aria-valuenow",String(current));
    energy.setAttribute("aria-valuemax",String(self.maxStamina));
    energy.querySelector("span")!.textContent = `${t("体力")} ${current} / ${self.maxStamina}`;
    this.wheel.update(state,self);
    for (const skill of SHOP_SKILLS) {
      const def = SKILLS[skill];
      const locked = !!def.isActive && !!def.canActivate && !def.canActivate(self,state.time);
      const remain = Math.max(0, (self.cooldowns[skill] ?? 0) - state.time);
      document.querySelector(`#${skill}-time`)!.textContent =
        locked ? t("视角锁定") : def.isActive?.(self,state.time) ? t("已开启") :
        remain > 0 ? t("{0} 秒冷却",Math.ceil(remain)) : SKILLS[skill].passive ? t("被动") : t("技能就绪");
      const fraction = Math.min(1, remain / Math.max(.001,modifiedStat(self,"cooldown",SKILLS[skill].cooldown,state.time)));
      const shade = document.querySelector<HTMLElement>(`#${skill}-progress`)!;
      shade.style.setProperty("--remaining", `${fraction * 360}deg`);
      document
        .querySelector(`#${skill}-ring`)!
        .setAttribute("stroke-dasharray", `${(1 - fraction) * 100} 100`);
      const button = document.querySelector<HTMLButtonElement>(
        `[data-skill="${skill}"]`,
      )!;
      button.classList.toggle("cooling", remain > 0);
      if (def.isActive) button.setAttribute("aria-pressed",String(def.isActive(self,state.time)));
      button.hidden = !self.skills.includes(skill);
      button.disabled = locked || !!def.passive || remain > 0 || !self.alive || state.phase !== "playing";
    }
    const stacks = new Map<string, number>();
    self.perks.forEach((id) => stacks.set(id, (stacks.get(id) ?? 0) + 1));
    const activeRows:string[] = [];
    const buffIcons = [...stacks].map(([id, count]) => {
        const p = perkById(id)!;
        if (p.use) {
          const selected = id === selectedPerk;
          const disabled = !self.alive || state.phase !== "playing" || (p.canUse && !p.canUse(self,state));
          activeRows.push(`<li><button type="button" class="active-perk tier-${p.tier}" data-use-perk="${id}" aria-current="${selected}" style="--buff-color:${TIERS[p.tier].color}" title="${field(p,"description")}" ${disabled ? "disabled" : ""}>
            ${icon(p.icon)}${activePerkBadge()}<span class="active-perk-caption"><span>${field(p,"name")}${count>1 ? " ×"+count : ""}</span>${selected ? keyHint("usePerk") : ""}</span>
          </button></li>`);
          return "";
        }
        return `<span class="buff-icon tier-${p.tier}" style="--buff-color:${TIERS[p.tier].color}" title="${field(p,"name")} ×${count} · ${field(p,"description")}">${icon(p.icon)}${count > 1 ? `<b>${count}</b>` : ""}</span>`;
      })
      .join("");
    const activeSkills = self.skills.map(id => {
      const skill = SKILLS[id];
      const remaining = (skill?.activeUntil?.(self) ?? 0) - state.time;
      if (skill?.isActive?.(self,state.time)) return `<span>${icon(skill.icon)}${field(skill,"name")}</span>`;
      return remaining > 0 ? `<span>${icon(skill.icon)}${field(skill,"name")} ${Math.ceil(remaining)}s</span>` : "";
    }).join("");
    const jammed = self.jammedUntil > state.time
      ? `<span class="jammed">${icon("radar")}${t("雷达受扰")} ${Math.ceil(self.jammedUntil - state.time)}s</span>` : "";
    const genes = Object.entries(self.mutations ?? {}).map(([id,count]) => {
      const m=MUTATIONS[id];
      return m ? `<span class="buff-icon" style="--buff-color:#83f5c8" title="${t("基因改造")} · ${field(m,"name")} ×${count} · ${field(m,"description")}">${icon(m.icon)}${count>1 ? `<b>${count}</b>` : ""}</span>` : "";
    }).join("");
    const focusHint = inTacticalView(self,state.time) && !browsingPerks ? keyHint("browsePerks") : "";
    const activeList = activeRows.length ? `<section class="active-perk-list" data-focused="${browsingPerks}"><header>${t("主动强化")}<span>${focusHint} ← →</span></header><ul>${activeRows.join("")}</ul></section>` : "";
    const buffs = activeList + activeSkills + (buffIcons || genes ? `<div class="buff-icons">${buffIcons}${genes}</div>` : "") + jammed;
    if (buffs !== this.lastBuffs) {
      document.querySelector("#buffs")!.innerHTML = buffs;
      this.lastBuffs = buffs;
    }

    document.querySelector("#radar-state")!.textContent =
      self.jammedUntil > state.time ? t("受干扰") : t("在线");
    document.querySelector("#radar-map")!.textContent = field(MAPS.find(m=>m.id===state.mapId)!,"name");
    drawMinimap(document.querySelector("#minimap")!, state, self,landing);
    document.querySelector("#crosshair")!.classList.toggle("off", !self.alive);
  }
  combatEvents(state:Readonly<GameSnapshot>, self:Player) {
    const latest = state.events.at(-1);
    if (!latest || latest.id <= this.eventCursor) return;
    for (const event of state.events)
      if (event.id > this.eventCursor) {
        const actor = state.players.find(p=>p.id===event.playerId);
        if (actor) this.feed.event(event,actor,self.id);
        if (event.mutation && event.playerId === self.id) this.mutationNotice.push(event.mutation);
        if ((event.type === "hit" || event.type === "cover-hit") && event.playerId === self.id) {
          const marker = document.querySelector("#crosshair")!;
          marker.classList.remove("confirmed");
          void (marker as HTMLElement).offsetWidth;
          marker.classList.add("confirmed");
        }
        if (event.type === "hurt" && !event.blocked && event.playerId === self.id) {
          document.querySelector("#damage")!.classList.remove("flash");
          void (document.querySelector("#damage") as HTMLElement).offsetWidth;
          document.querySelector("#damage")!.classList.add("flash");
        }
      }
    this.eventCursor = latest.id;
  }
  shop(player: Player) {
    const mounted = this.overlay.querySelector(".shop-modal");
    if (mounted) {
      mounted.querySelector("[data-credits]")!.textContent = String(player.credits);
      mounted.querySelector("[data-slots]")!.textContent = `${player.skills.length} / ${SLOT_LIMIT}`;
      for (const card of mounted.querySelectorAll<HTMLButtonElement>("[data-trade]")) {
        const id = card.dataset.trade as SkillId, owned = player.skills.includes(id);
        card.dataset.refund = String(owned);
        card.disabled = !owned && (player.credits < SKILLS[id].price || player.skills.length >= SLOT_LIMIT);
        card.classList.toggle("purchased",owned);
        card.querySelector("b")!.textContent = `${owned ? t("退还") : t("购买")} · ${SKILLS[id].price}`;
      }
      return;
    }
    const cards = SHOP_SKILLS.map(id => {
      const skill = SKILLS[id], owned = player.skills.includes(id);
      const unavailable = !owned && (player.credits < skill.price || player.skills.length >= SLOT_LIMIT);
      return `<button class="shop-card ${owned ? "purchased" : ""}" data-trade="${id}" data-refund="${owned}" ${unavailable ? "disabled" : ""}>
        ${icon(skill.icon)}<strong>${field(skill,"name")}</strong>${skillKeyHint(id)}
        <small>${field(skill,"description")}</small><b>${owned ? t("退还") : t("购买")} · ${skill.price}</b></button>`;
    }).join("");
    this.show(`<header><h2>${t("技能商店")}</h2><p>${t("资金")} <b data-credits>${player.credits}</b>　${t("技能槽")} <b data-slots>${player.skills.length} / ${SLOT_LIMIT}</b></p></header>
      <div class="shop-grid">${cards}</div><button class="primary" id="deploy">${t("部署入场")}</button>`, "shop-modal");
  }
  pause() {
    this.show(
      `<h2>${t("暂停")}</h2>${languageSelect()}<button class="primary" id="resume">${icon("play")} ${t("继续对局")}</button><div class="modal-actions"><button id="restart">${t("重新开局")}</button><button id="home">${t("返回首页")}</button></div>`,
    );
  }
  help(inGame: boolean) {
    const entry = (glyph: string, name: string, description: string, detail = "", color = "#becdc4", control = "", badge = "") =>
      `<li style="--entry-color:${color}">${icon(glyph)}<div class="guide-card-body">
        <div class="guide-card-heading"><span><b>${name}</b> <small>${detail}</small></span>${badge}</div>
        <p class="guide-description">${description}</p>${control}</div></li>`;
    const section = (category: string, title: string, rows: string[]) =>
      `<details class="guide-section" data-category="${category}" open><summary>${title}<small>${rows.length}</small></summary><ul>${rows.join("")}</ul></details>`;
    const perks = Object.keys(TIERS).flatMap(tier => PERKS.filter(p => p.tier === tier).map(p =>
      entry(p.icon, field(p,"name"), field(p,"description"), t(TIERS[p.tier].name), TIERS[p.tier].color, "", p.use ? activePerkBadge() : "")));
    const charge = t("炸药");
    const items = [entry("bubble", charge, t("部署在空地上，引信结束后产生十字爆炸。"), "", undefined, quickEquipControl("bomb",charge))];
    for (const item of Object.values(ITEMS)) {
      const name = field(item,"name");
      items.push(entry(item.icon, name, field(item,"description"), "", item.color,
        isEquipment(item) ? quickEquipControl(item.id,name) : ""));
    }
    const genes = Object.values(MUTATIONS).map(m => entry(m.icon,field(m,"name"),field(m,"description"),"","#83f5c8"));
    const skills = Object.values(SKILLS).map(s => {
      const name = field(s,"name");
      const detail = [`${s.price} ${t("资金")}`];
      if (s.passive) detail.push(t("被动"));
      if (s.cooldown) detail.push(`${t("冷却")} ${s.cooldown} ${t("秒")}`);
      return entry(s.icon,name,field(s,"description"),detail.join(" · "),"#dcc18b",
        s.passive ? "" : bindingButton(skillBinding(s.id),t("快捷键"),name));
    });
    this.show(
      `<header class="manual-toolbar"><h2>${t("作战手册")}</h2><button type="button" data-reset-controls>${t("恢复默认键位")}</button></header>
      ${controlSettings()}${section("skills",t("商店技能"), skills)}${section("perks",t("升级强化"), perks)}${section("genes",t("基因改造"), genes)}${section("equipment",t("物品与装备"), items)}<button class="primary" id="${inGame ? "resume" : "home"}">${t("返回")}</button>`,
      "help-modal",
    );
    mountControls(this.overlay.querySelector<HTMLElement>(".help-modal")!);
  }
  graphics(value: GraphicsSettings) {
    this.show(graphicsForm(), "graphics-modal");
    syncGraphics(this.overlay.querySelector<HTMLFormElement>("#graphics-form")!,value);
  }
  promotion(from: number, to: number) {
    document.querySelector("#rank-up")?.remove();
    const banner = document.createElement("div");
    banner.id = "rank-up";
    banner.setAttribute("role","status");
    banner.setAttribute("aria-label",t("等级由 {0} 升至 {1}",from,to));
    banner.innerHTML = `<i class="rank-wings" aria-hidden="true"></i><span class="rank-caption">${t("等级提升")}</span>
      <div class="rank-numbers"><small>LV. ${from}</small><i>›</i><strong><em>LV.</em> ${to}</strong></div>`;
    document.querySelector("#hud")!.append(banner);
    banner.addEventListener("animationend", e => { if (e.target === banner) banner.remove(); });
    return {banner, cards: Array.from(document.querySelectorAll<HTMLElement>("#perk-tray .perk-card"))};
  }
  togglePerks() {
    this.perkTray?.classList.toggle("expanded");
  }
  clearPerks() {
    this.perkTray?.remove();
    this.perkTray = undefined;
  }
  perks(self: Player) {
    const old = this.perkTray;
    if (!self.alive || !self.offers.length) {
      if (old) this.clearPerks();
      return false;
    }
    if (old?.dataset.level === String(self.level)) return false;
    const expanded = old?.classList.contains("expanded");
    old?.remove();
    const tray = document.createElement("aside");
    this.perkTray = tray;
    tray.id = "perk-tray";
    tray.dataset.level = String(self.level);
    if (expanded) tray.classList.add("expanded");
    document.querySelector("#app")!.append(tray);
    const expand = keyHint("expand");
    tray.innerHTML = `<header class="perk-notice"><strong><i></i>${t("强化就绪")}</strong><span>LV. ${self.level}</span><small><span class="perk-quick">${expand} ${t("展开")}</span><span class="perk-open">${expand} ${t("收起")}</span></small></header><div class="perk-grid">${self.offers
      .map((id, i) => {
        const p = perkById(id)!;
        const action = (["reward1","reward2","reward3"] as const)[i];
        return `<button class="perk-card tier-${p.tier}" data-perk="${p.id}" style="--perk-color:${TIERS[p.tier].color}">
          <span class="perk-card-tools"><span class="perk-key" data-keyhint="${action}">${bindings.label(action)}</span>${p.use ? activePerkBadge() : ""}</span>
          <span class="perk-icon">${icon(p.icon)}</span><small>${t(TIERS[p.tier].name)}${p.use ? "" : " · " + field(p,"tag")}</small>
          <h3>${field(p,"name")}</h3><p>${field(p,"description")}</p><span class="perk-select">${t("选择强化")}</span></button>`;
      })
      .join("")}</div>`;
    return true;
  }
  result(state: Readonly<GameSnapshot>, self: Player) {
    const winner = state.players.find((p) => p.id === state.winnerId);
    this.show(
      `<div class="result-icon">${icon(winner?.id === self.id ? "crown" : "bubble")}</div><h2>${winner?.id === self.id ? t("对局胜利") : winner ? t("{0} 赢得对局",winner.name) : t("平局")}</h2><div class="result-stats"><div><b>${self.score}</b><span>${t("总积分")}</span></div><div><b>${self.kills}</b><span>${t("淘汰对手")}</span></div><div><b>${self.level}</b><span>${t("最终等级")}</span></div><div><b>${Math.floor(state.time)}<small>s</small></b><span>${t("对局时长")}</span></div></div><button class="primary" id="restart">${icon("refresh")} ${t("再来一局")}</button><button class="text-btn" id="home">${t("返回首页")}</button>`,
    );
  }
  eliminated() {
    this.show(
      `<h2>${t("已淘汰")}</h2><button class="primary" id="resume">${t("观战剩余对局")}</button><div class="modal-actions"><button id="restart">${t("再来一局")}</button><button id="home">${t("返回首页")}</button></div>`,
    );
  }
  private show(html: string, cls = "") {
    this.overlay.innerHTML = `<section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${t("游戏菜单")}">${html}</section>`;
    this.overlay.hidden = false;
    queueMicrotask(() =>
      this.overlay.querySelector<HTMLElement>(cls === "help-modal" ? ".guide-section summary" : "button")?.focus(),
    );
  }
  hideOverlay() {
    this.overlay.hidden = true;
    this.overlay.innerHTML = "";
  }
  fatal(message: string) {
    const f = document.querySelector<HTMLElement>("#fatal")!;
    f.hidden = false;
    f.textContent = message;
  }
}
