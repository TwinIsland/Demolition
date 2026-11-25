import { t, field, setLanguage } from "./i18n";
import { loading, afterPaint, localizeDocument } from "./ui/loading";
import "./style.css";
import { saveGraphics } from "./render/graphics-settings";
import { canEquip } from "./core/equipment";
import { MAPS } from "./core/maps";
import { DEFAULT_MODE, MATCH_MODES, type MatchMode } from "./core/match-modes";
import { DEFAULT_SKIN, DEFAULT_FINISH, BOMB_STYLES, SKIN_PRESETS, ZOMBIE_RATES, type ZombieRate, defaultSlots, type Appearance } from "./core/room";
import type { SkillId } from "./core/types";
import { KeyboardAgent } from "./agents/keyboard-agent";
import { MENU_MUSIC, Sound } from "./audio/sound";
import { GameRenderer } from "./render/game-renderer";
import { createSession } from "./session/create-session";
import { GameUI } from "./ui/game-ui";
import { inTacticalView } from "./core/types";
import { bindings } from "./input/bindings";

type View = "loading" | "lobby" | "graphics" | "room" | "shop" | "playing" | "paused" | "help" | "eliminated" | "result";
const root = document.querySelector<HTMLElement>("#app")!;
const editable = (target: EventTarget | null) => target instanceof Element &&
  !!target.closest('textarea,input:not([type]),input[type="text"],input[type="search"],[contenteditable="true"]');
document.addEventListener("contextmenu", event => event.preventDefault());
for (const name of ["selectstart","dragstart"]) document.addEventListener(name,event => {
  if (!editable(event.target)) event.preventDefault();
});
document.addEventListener("keydown",event => {
  if ((event.ctrlKey || event.metaKey) && event.code === "KeyA" && !editable(event.target)) event.preventDefault();
});
let renderer: GameRenderer;
try {
  renderer = new GameRenderer(root);
} catch (error) {
  throw new Error(t("需要 WebGL 2，请启用浏览器硬件加速"), { cause: error });
}
const localId = "you";
let mapId = MAPS[0].id;
let matchMode: MatchMode = DEFAULT_MODE;
let view: View = "loading";
let closed = false;
let helpFromLobby = true;
let deathShown = false;
let displayedLevel = 1;
let roomBackdropPending = false;
let previewTerrain = false;
const slots = defaultSlots();
const appearance: Appearance = {skin:DEFAULT_SKIN.id, bombStyle:DEFAULT_FINISH.id};
try {
  if (localStorage.getItem("demolition-skin")) appearance.skin = "custom";
  const stored = JSON.parse(localStorage.getItem("demolition-appearance") ?? "{}");
  if (Object.hasOwn(SKIN_PRESETS,stored.skin) || stored.skin === "custom") appearance.skin = stored.skin;
  if (Object.hasOwn(BOMB_STYLES,stored.bombStyle)) appearance.bombStyle = stored.bombStyle;
} catch {}
function saveAppearance() {
  renderer.dressPreview(appearance);
  try { localStorage.setItem("demolition-appearance", JSON.stringify(appearance)); } catch {}

}
let zombieRate: ZombieRate = "normal";
try {
  const saved = localStorage.getItem("demolition-zombie-rate");
  if (saved && Object.hasOwn(ZOMBIE_RATES, saved)) zombieRate = saved as ZombieRate;
} catch {}
let seed = 74691;
const session = createSession({ mode:matchMode, mapId, seed, humanId: localId, appearance, opponents: slots });
const keyboard = new KeyboardAgent(localId, renderer.canvas);
const sound = new Sound();
let wheelKey:string | undefined;
let pointerX:number | undefined, pointerY:number | undefined;

function equip(id:string) {
  if (view !== "playing" || !keyboard.enabled || keyboard.selectingWheel) return;
  const state = session.getSnapshot();
  const self = state.players.find(p => p.id === localId);
  if (state.phase === "finished" || !self?.alive || !canEquip(self,id)) return;
  if (id === self.equipped) sound.confirmEquipment();
  keyboard.queueEquipment(id);
}

function closeDragWheel(commit=false) {
  if (!keyboard.selectingWheel) return;
  const id=ui.wheel.endDrag();
  keyboard.selectingWheel=false;
  wheelKey=undefined;
  if (commit && id) equip(id);
}

function unlock() {
  sound.battleFire(0);
  closeDragWheel();
  ui.feed.close();
  keyboard.enabled = false;
  keyboard.clear();
  session.advance(0);
  if (document.pointerLockElement) document.exitPointerLock();
}
function pause(audible = true) {
  if (view !== "playing") return;
  view = "paused";
  unlock();
  ui.pause();
  if (audible) sound.menu("accept");
}
function start() {
  unlock();
  sound.setMusic(MENU_MUSIC);
  view = "room";
  roomBackdropPending = true;
  ui.setMode(false);
  ui.room(slots, appearance, field(MAPS.find(m => m.id === mapId)!,"name"), zombieRate,matchMode);
  sound.menu("accept");
}
async function enterShop() {
  if (view !== "room" || (matchMode !== "practice" && !slots.some(s=>s.enabled))) return;
  view = "loading";
  unlock();
  sound.reset();
  sound.setMusic(MAPS.find(m => m.id === mapId)?.bgm ?? "./assets/bgm.ogg");
  sound.menu("accept");
  loading.show(field(MAPS.find(m => m.id === mapId)!,"name"));
  try {
    await afterPaint();
    if (closed) return;
    seed = (Date.now() + ++seed) >>> 0;
    session.restart({ mode:matchMode, appearance, opponents: slots, zombieRate, mapId, seed, humanId: localId });
    const state = session.getSnapshot();
    loading.drawMap(state);
    await afterPaint();
    if (closed) return;
    await renderer.prepare(state,true,loading.progress);
    if (closed) return;
    renderer.render(state,"first-person",localId,keyboard.pitch,performance.now()/1000,keyboard.yaw);
    deathShown = false;
    displayedLevel = state.players.find(p => p.id === localId)!.level;
    ui.setSound(sound.enabled);
    ui.setMode(true);
    view = "shop";
    loading.hide();
    ui.shop(state.players.find(p => p.id === localId)!);
  } catch (error) {
    if (!closed) loading.fail(error);
  }
}
function trade(id: SkillId, refund: boolean) {
  if (view !== "shop") return;
  session.submit(localId, { moveX: 0, moveZ: 0, yaw: keyboard.yaw, [refund ? "refund" : "buy"]: id });
  session.advance(0);
  ui.shop(session.getSnapshot().players.find(p => p.id === localId)!);
}
function deploy() {
  if (view !== "shop") return;
  sound.menu("accept");
  view = "playing";
  ui.hideOverlay();
  keyboard.clear();
  keyboard.enabled = true;
  void keyboard.lockPointer();
}
function home() {
  view = "lobby";
  previewTerrain = false;
  ui.terrainPreview(false);
  unlock();
  session.restart({ mode:matchMode, appearance, mapId, seed: ++seed, humanId: localId });
  sound.reset();
  sound.setMusic(MENU_MUSIC);
  ui.setMode(false);
  sound.menu("back");
}
function resume() {
  if (view === "help" && helpFromLobby) {
    home();
    return;
  }

  sound.menu(view === "eliminated" ? "accept" : "back");
  view = "playing";
  ui.hideOverlay();
  keyboard.clear();
  keyboard.enabled = session
    .getSnapshot()
    .players.find((p) => p.id === localId)!.alive;
  if (keyboard.enabled) void keyboard.lockPointer();
}
function choose(id: string) {
  if (view !== "playing") return;
  if (ui.feed.editing) ui.feed.close();
  session.submit(localId, { moveX: 0, moveZ: 0, yaw: keyboard.yaw, perk: id });
  session.advance(0);
  if (
    session.getSnapshot().players.find((p) => p.id === localId)!.offers.length
  )
    return;
  view = "playing";
  ui.hideOverlay();
  ui.clearPerks();
  closeDragWheel();
  keyboard.enabled = true;
  void keyboard.lockPointer();
}
const ui = new GameUI(root, {
  async skin(file, model) {
    await renderer.importSkin(file, model);
    appearance.skin = "custom";
    saveAppearance();
    ui.setAppearance(appearance);
  },
  chat: openChat,
  start,
  resume,
  restart: start,
  trade, deploy,
  enterShop,
  outfit(value) {
    if (view !== "lobby") return;
    Object.assign(appearance,value);
    if (value.skin) void renderer.previewSkin(value.skin).catch(console.error);
    saveAppearance();
  },
  drawPortrait: (canvas,skin,seat) => renderer.drawPortrait(canvas,skin,seat),
  zombieRate(value) {
    if (view !== "room" || !Object.hasOwn(ZOMBIE_RATES,value)) return;
    zombieRate = value;
    try { localStorage.setItem("demolition-zombie-rate",value); } catch {}
  },
  configureBot(id, changes) {
    if (view !== "room") return;
    const slot = slots.find(s=>s.id === id);
    if (slot) Object.assign(slot, changes);
    ui.room(slots, appearance, field(MAPS.find(m => m.id === mapId)!,"name"), zombieRate,matchMode);
  },
  home,
  pause,
  choose,
  mode(id) {
    if (view !== "lobby" || !MATCH_MODES[id]?.available) return;
    matchMode = id;
    ui.setMatchMode(id);
  },
  map(id) {
    if (view !== "lobby" || id === mapId) return;
    const map = MAPS.find(entry => entry.id === id);
    if (!map) return;
    mapId = id;
    session.restart({ mode:matchMode, appearance, mapId, seed: ++seed });
    renderer.selectLobbyMap(map);
    ui.setMap(mapId);
  },
  terrain() {
    if (view !== "lobby") return;
    previewTerrain = !previewTerrain;
    ui.terrainPreview(previewTerrain);
    sound.menu(previewTerrain ? "accept" : "back");
  },
  help() {
    if (view === "shop" || view === "room") return;
    helpFromLobby = view === "lobby" || (view === "help" && helpFromLobby);
    view = "help";
    unlock();
    ui.help(!helpFromLobby);
    sound.menu("accept");
  },
  uiClick: () => sound.menu(),
  sound() {
    ui.setSound(sound.toggle());
    sound.menu();
  },
  skill(id) {
    if (view === "playing") keyboard.queueSkill(id);
  },
  usePerk(id) {
    if (view === "playing" && keyboard.enabled) keyboard.queuePerk(id);
  },
  graphics() {
    if (view !== "lobby") return;
    view = "graphics";
    ui.graphics(renderer.graphics);
    sound.menu("accept");
  },
  changeGraphics(value) {
    if (view !== "graphics") return;
    renderer.setGraphics(value);
    saveGraphics(value);
  },
  closeGraphics,
  language(value) {
    if (view !== "graphics" && view !== "paused") return;
    setLanguage(value);
    localizeDocument();
    renderer.canvas.ariaLabel=t("3D 爆破战场");
    ui.refreshLanguage(session.getSnapshot().players.find(p=>p.id===localId)!);
    ui.setMatchMode(matchMode);
    ui.setSound(sound.enabled);
    ui.terrainPreview(previewTerrain);
    if (view === "graphics") ui.graphics(renderer.graphics);
    else ui.pause();
    queueMicrotask(()=>root.querySelector<HTMLSelectElement>("[data-language]")?.focus());
  },

});
function closeGraphics() {
  if (view !== "graphics") return;
  view = "lobby";
  ui.hideOverlay();
  root.querySelector<HTMLButtonElement>("#graphics")!.focus();
  sound.menu("back");
}
function openChat() {
  if (view !== "playing" || ui.feed.editing) return;
  keyboard.clear();
  keyboard.enabled=false;
  closeDragWheel();
  if (document.pointerLockElement) document.exitPointerLock();
  ui.feed.open();
}
function leaveChat(send:boolean) {
  if (send) ui.feed.send(session.getSnapshot().time);
  else ui.feed.close();
  keyboard.clear();
  keyboard.enabled=view==="playing" && !!session.getSnapshot().players.find(p=>p.id===localId)?.alive;
  if (keyboard.enabled) void keyboard.lockPointer();
}
renderer.attachPreview(root.querySelector<HTMLElement>("#lobby-avatar")!);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
renderer.selectLobbyMap(MAPS[0]);
renderer.dressPreview(appearance);
ui.setMode(false);
ui.setAppearance(appearance);
ui.setSound(sound.enabled);
root.addEventListener("change", e => {
  if (e.target instanceof Element && e.target.matches('select,input[type="checkbox"]')) sound.menu();
});
window.addEventListener("keydown", (e) => {
  if (view === "loading") return;
  if (ui.feed.editing) {
    if (e.isComposing || e.keyCode===229) return;
    if (e.code==="Enter" || e.code==="Escape") {
      e.preventDefault();
      if (!e.repeat) leaveChat(e.code==="Enter");
    }
    return;
  }
  if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
  const action = bindings.action(e.code);
  if (action === "fullscreen" && !editable(e.target)) {
    e.preventDefault();
    if (!e.repeat) { void ui.toggleFullscreen(); sound.menu(); }
    return;
  }
  if (view==="playing" && action==="chat") {
    e.preventDefault();
    if (!e.repeat) openChat();
    return;
  }
  if (e.code === "Enter" && view === "lobby" &&
      !(e.target instanceof Element && e.target.closest("select,button,summary,input,a"))) {
    e.preventDefault();
    if (!e.repeat) start();
  }
  if (action === "expand") {
    if (view === "playing") {
      e.preventDefault();
      if (!e.repeat) ui.togglePerks();
    }
  }
  if (e.code === "Escape" || (action === "pause" && (view === "playing" || view === "paused"))) {
    if (e.repeat) return;
    if (view === "graphics") closeGraphics();
    else if (view === "room") home();
    else if (view === "playing") pause();
    else if (view === "paused" || view === "help") resume();
  }
  if (view !== "playing" || !keyboard.enabled || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  if (action === "gearWheel") {
    e.preventDefault();
    if (editable(e.target) || keyboard.topDown || keyboard.selectingWheel) return;
    keyboard.beginWheel();
    wheelKey=e.code;
    ui.wheel.beginDrag();
    sound.menu();
  } else if (action?.startsWith("equip:") && !keyboard.topDown && !editable(e.target)) {
    e.preventDefault();
    closeDragWheel();
    equip(action.slice("equip:".length));
  } else if (action === "reward1" || action === "reward2" || action === "reward3") {
    const self = session.getSnapshot().players.find(p => p.id === localId)!;
    const offer = self.offers[Number(action.slice(-1)) - 1];
    if (self.alive && offer) { e.preventDefault(); choose(offer); }
  }
});
window.addEventListener("mousemove",e=>{
  const locked = document.pointerLockElement === renderer.canvas;
  if (keyboard.selectingWheel) {
    const dx = locked || pointerX === undefined ? e.movementX : e.clientX-pointerX;
    const dy = locked || pointerY === undefined ? e.movementY : e.clientY-pointerY;
    if (ui.wheel.moveDrag(dx,dy)) sound.selectionTick();
  }
  pointerX = locked ? undefined : e.clientX;
  pointerY = locked ? undefined : e.clientY;
});
window.addEventListener("keyup",e=>{
  if (e.code===wheelKey) closeDragWheel(true);
});
document.addEventListener("pointerlockchange", () => {
  pointerX = pointerY = undefined;
  if (!document.pointerLockElement && view === "playing" && keyboard.enabled)
    pause(document.hasFocus() && !document.hidden);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause(false);
});
window.addEventListener("blur", () => pause(false));
root.addEventListener("auxclick", e => { if (view === "playing" && e.button === 1) e.preventDefault(); });
renderer.canvas.addEventListener("click", () => {
  if (keyboard.topDown || keyboard.selectingWheel) return;
  if (view === "playing" && keyboard.enabled && !document.pointerLockElement)
    void keyboard.lockPointer();
});
let previous = 0,
  nextUI = 0;
renderer.setAnimationLoop((ms) => {
  if (view === "loading") { previous = 0; return; }
  const now = ms / 1000,
    dt = previous ? Math.min(0.1, now - previous) : 0;
  previous = now;
  if (view === "room") {
    if (roomBackdropPending) {
      renderer.render(session.getSnapshot(),"lobby",localId,0,now);
      roomBackdropPending = false;
    }
    renderer.renderRoom(now);
    return;
  }
  if (view === "playing") {
    const observation = session.getSnapshot(),
      self = observation.players.find((p) => p.id === localId)!;
    session.submit(localId, keyboard.decide({ self, state: observation, dt }));
    session.advance(dt);
  }
  const state = session.getSnapshot(),
    self = state.players.find((p) => p.id === localId)!;
  const topDown = self.alive && inTacticalView(self,state.time);
  if (topDown && keyboard.selectingWheel) closeDragWheel();
  keyboard.setTopDown(topDown);
  if (root.hasAttribute("data-top-down") !== topDown) root.toggleAttribute("data-top-down",topDown);
  sound.update(state, localId);
  if (view === "playing") {
    sound.matchClock(state);
    ui.combatEvents(state,self);
    if (ui.mutationNotice.update(state.time)) sound.mutationReady();
    if (state.phase === "finished") {
      view = "result";
      unlock();
      ui.clearPerks();
      ui.result(state, self);
    } else if (!self.alive && !deathShown) {
      deathShown = true;
      view = "eliminated";
      unlock();
      ui.clearPerks();
      ui.eliminated();
    } else {
      if (ui.perks(self)) sound.perkReady();
      if (self.level > displayedLevel) {
        const {banner,cards} = ui.promotion(displayedLevel,self.level);
        renderer.promotion(now,banner,cards);
        sound.levelUp();
        displayedLevel = self.level;
      }
    }
  }
  const mode =
    view === "lobby" || view === "graphics" || (view === "help" && helpFromLobby)
      ? "lobby"
      : self.alive
        ? "first-person"
        : "spectator";
  renderer.render(
    session.getRenderSnapshot?.() ?? state,
    mode,
    localId,
    keyboard.pitch,
    now,
    keyboard.yaw,
    mode === "lobby" && !previewTerrain,
    mode === "lobby" && !reducedMotion.matches ? sound.menuBeat(now) : 0,
    view === "playing" && keyboard.aiming,
  );
  if (view === "lobby" || view === "graphics") renderer.renderPreview(now);
  const inBattle = view === "playing" && state.phase === "playing";
  const canAim = inBattle && self.alive && keyboard.enabled && !keyboard.selectingWheel && !ui.feed.editing;
  sound.aimAt(canAim ? renderer.landingPreview : undefined);
  const collapse = inBattle ? state.arenaView : undefined;
  const pending = !!collapse && state.time < collapse.startsAt;
  const remaining = collapse ? (pending ? collapse.startsAt : collapse.endsAt) - state.time : 0;
  const collapseSeconds = Math.ceil(Math.fround(remaining));
  ui.showCollapse(collapseSeconds, pending);
  if (inBattle) sound.collapseClock(collapse ? (pending ? collapseSeconds : 0) : undefined);
  const reset = inBattle ? state.terrainReset : undefined;
  const seconds = reset ? (reset.completedAt === undefined ? Math.max(1,Math.ceil(reset.at-state.time)) : 0) : undefined;
  const layer = reset ? (seconds === 0 ? "eruption" : "warning") :
    inBattle && self.alive && self.offers.length ? "offer" : "";
  ui.battleFire(layer,seconds);
  ui.showHealthDanger(inBattle && self.alive ? self.hp/self.maxHp : 1);
  sound.battleFire(layer === "eruption" ? .75 : layer === "warning" ? .34 : layer === "offer" ? .45 : 0, reset?.id,seconds);
  if (view === "playing") renderer.drawRewardEffects(now,reducedMotion.matches || !layer ? 0 : layer === "eruption" ? 2.1 : 1,layer === "offer");
  renderer.finishFrame();
  if (now >= nextUI) {
    if (view !== "lobby" && view !== "graphics") ui.update(state,self,renderer.landingPreview,keyboard.selectedPerk,keyboard.browsingPerks);
    nextUI = now + 0.075;
  }
});
window.addEventListener(
  "pagehide",
  () => {
    closed = true;
    keyboard.dispose();
    session.dispose();
    sound.dispose();
    renderer.dispose();
  },
  { once: true },
);


async function loadLobby() {
  loading.show();
  await afterPaint();
  if (closed) return;
  const state = session.getSnapshot();
  await renderer.prepare(state,false,loading.progress);
  if (closed) return;
  const now = performance.now()/1000;
  renderer.render(state,"lobby",localId,0,now,undefined,true);
  renderer.renderPreview(now);
  view = "lobby";
  loading.hide();
}
void loadLobby().catch(error => { if (!closed) loading.fail(error); });
