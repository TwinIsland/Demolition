import { LEVEL_GAIN_TEXT } from "../core/level-rewards";
import { preloadEverything } from "./preload";
import { KeyboardAgent } from "../agents/keyboard-agent";
import { CREDITS_MUSIC, MENU_MUSIC, Sound } from "../audio/sound";
import { perkById } from "../core/content";
import { MAPS } from "../core/maps";
import { MATCH_MODES } from "../core/match-modes";
import { ZONE } from "../core/zone";
import {
  idleInput,
  inTacticalView,
  type GameSnapshot,
  type MatchSession,
  type PerkId,
  type Player,
  type SkillId,
  type Vec2,
} from "../core/types";
import { setLanguage, t, type Language } from "../i18n";
import type { GameRenderer } from "../render/game-renderer";
import { saveGraphics } from "../render/graphics-settings";
import { createSession } from "../session/create-session";
import type { BattleFireLayer } from "../ui/battle-effects";
import { FeedbackHud } from "../ui/feedback-hud";
import { motionScale } from "../feel/settings";
import { Killcam, lastFallen } from "../replay/killcam";
import { ReplayRecorder } from "../replay/recorder";
import { GameUI, type UIActions } from "../ui/game-ui";
import { mountUiFeedback } from "../ui/ui-feedback";
import { afterPaint, loading, localizeDocument } from "../ui/loading";
import { battlePresentation } from "./battle-presentation";
import { EquipmentControl } from "./equipment-control";
import { GameLoop, Throttle } from "./game-loop";
import { MatchSetup } from "./match-setup";
import { ScreenMachine, type Screen } from "./screens";
import { isZombieRate, readCustomSkin } from "./settings";

const LOCAL_PLAYER_ID = "you";
/** Seconds between HUD refreshes; the 3D view still renders every frame. */
const HUD_INTERVAL = 0.075;
/** Loop volume of the battle-fire ambience for each HUD fire layer. */
const FIRE_VOLUME: Record<BattleFireLayer, number> = { "": 0, offer: 0.45, warning: 0.34, eruption: 0.75 };
/** Strength of the rendered screen-edge fire for each layer. */
const FIRE_STRENGTH: Record<BattleFireLayer, number> = { "": 0, offer: 1, warning: 1, eruption: 2.1 };

/**
 * Application controller: owns the session, input agent, audio and UI, decides which screen is
 * showing, and drives one frame at a time. All match rules stay behind `MatchSession`.
 */
export class GameApp {
  private readonly screens = new ScreenMachine();
  private readonly session: MatchSession;
  private readonly keyboard: KeyboardAgent;
  private readonly sound = new Sound();
  private readonly typeTick = () => this.sound.typeTick();
  private readonly unmountUiFeedback = mountUiFeedback(document.querySelector<HTMLElement>("#app")!, {
    hover: () => this.sound.selectionTick(),
    active: () => !document.pointerLockElement,
  });
  private readonly ui: GameUI;
  /** Equipment wheel and quick-equip keys; the input router calls it directly. */
  readonly equipment: EquipmentControl;
  private readonly loop = new GameLoop((now, dt) => this.frame(now, dt));
  private readonly hudRefresh = new Throttle(HUD_INTERVAL);
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  private readonly setup = new MatchSetup(LOCAL_PLAYER_ID);

  /** The last seconds of the match, kept for the killcam. */
  private readonly recorder = new ReplayRecorder();
  /** The replay that is playing, and the screen that reports the kill once it is over. */
  private killcam?: { director: Killcam; then: "eliminated" | "result" };
  private closed = false;
  /** Where "back" leads from the manual: the lobby, or the match it was opened over. */
  private helpFromLobby = true;
  private deathShown = false;
  private readonly feedback: FeedbackHud;
  private displayedLevel = 1;
  private roomBackdropPending = false;
  private previewTerrain = false;
  /** Perk whose targeting tablet is open. */
  private targetingPerk?: PerkId;

  constructor(
    root: HTMLElement,
    private readonly renderer: GameRenderer,
  ) {
    this.session = createSession(this.setup.initialOptions());
    this.keyboard = new KeyboardAgent(LOCAL_PLAYER_ID, renderer.canvas);
    this.keyboard.onTargetedPerk = (id) => this.beginTargeting(id);
    this.ui = new GameUI(root, this.uiActions());
    this.feedback = new FeedbackHud(root);
    this.equipment = new EquipmentControl({
      keyboard: this.keyboard,
      wheel: this.ui.wheel,
      sound: this.sound,
      canAct: () => this.controllingPlayer,
      viewer: () => this.session.getSnapshot().players.find((p) => p.id === LOCAL_PLAYER_ID),
      matchOver: () => this.session.getSnapshot().phase === "finished",
    });
    renderer.onThunder = ({ delay, strength }) =>
      setTimeout(() => {
        if (this.screens.is("playing")) this.sound.thunder(strength);
      }, delay * 1000);
    renderer.attachPreview(this.ui.avatarMount);
    renderer.selectLobbyMap(MAPS[0]);
    renderer.dressPreview(this.setup.appearance);
    this.ui.setInGame(false);
    this.ui.setAppearance(this.setup.appearance, readCustomSkin());
    this.ui.setSound(this.sound.enabled);
  }

  /** Starts the frame loop and loads the lobby. */
  start() {
    this.loop.start((callback) => this.renderer.setAnimationLoop(callback));
    void this.loadLobby().catch((error) => {
      if (!this.closed) loading.fail(error);
    });
  }

  dispose() {
    this.closed = true;
    this.keyboard.dispose();
    this.session.dispose();
    this.sound.dispose();
    this.renderer.dispose();
    this.ui.dispose();
    this.unmountUiFeedback();
  }

  // --- State read by the input router ---

  get screen(): Screen {
    return this.screens.current;
  }

  get chatting(): boolean {
    return this.ui.feed.editing;
  }

  /** True while key presses drive the player rather than a menu or the chat box. */
  get controllingPlayer(): boolean {
    return this.screens.is("playing") && this.keyboard.enabled;
  }

  get topDown(): boolean {
    return this.keyboard.topDown;
  }

  // --- Screen transitions ---

  openRoom() {
    this.dropReplay();
    this.releaseControls();
    this.sound.setMusic(MENU_MUSIC);
    this.screens.transition("room");
    this.roomBackdropPending = true;
    this.ui.setInGame(false);
    this.showRoom();
    this.sound.menu("accept");
  }

  goHome() {
    this.dropReplay();
    this.screens.transition("lobby");
    this.previewTerrain = false;
    this.ui.setTerrainPreview(false);
    this.releaseControls();
    this.session.restart(this.setup.lobbyOptions());
    this.sound.reset();
    this.sound.setMusic(MENU_MUSIC);
    this.ui.setInGame(false);
    this.ui.enterLobby();
    this.sound.menu("back");
  }

  pause(audible = true) {
    if (!this.screens.is("playing")) return;
    this.screens.transition("paused");
    this.releaseControls();
    this.ui.showPause();
    if (audible) this.sound.menu("accept");
  }

  resume() {
    if (this.screens.is("help") && this.helpFromLobby) {
      this.goHome();
      return;
    }
    this.sound.menu(this.screens.is("eliminated") ? "accept" : "back");
    this.screens.transition("playing");
    this.ui.hideOverlay();
    this.keyboard.clear();
    // An eliminated player resumes as a spectator, without controls.
    this.keyboard.enabled = this.viewer().alive;
    if (this.keyboard.enabled) void this.keyboard.lockPointer();
  }

  /** Escape, or the pause key: steps one level out of the current screen. */
  back() {
    if (this.screens.is("graphics")) this.closeGraphics();
    else if (this.screens.is("credits")) this.closeCredits();
    else if (this.screens.is("room")) this.goHome();
    else if (this.screens.is("lobby")) {
      if (this.ui.lobbyBack()) this.sound.menu("back");
    } else if (this.screens.is("playing")) this.pause();
    else if (this.screens.is("paused", "help")) this.resume();
    else if (this.screens.is("replay")) this.skipReplay();
  }

  closeCredits() {
    if (!this.screens.is("credits")) return;
    this.screens.transition("lobby");
    this.ui.hideOverlay();
    this.sound.menu("back");
    this.sound.setMusic(MENU_MUSIC);
  }

  closeGraphics() {
    if (!this.screens.is("graphics")) return;
    this.screens.transition("lobby");
    this.ui.hideOverlay();
    this.ui.focusGraphicsButton();
    this.sound.menu("back");
  }

  // --- Chat ---

  openChat() {
    if (!this.screens.is("playing") || this.ui.feed.editing) return;
    this.keyboard.clear();
    this.keyboard.enabled = false;
    this.equipment.closeWheel();
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.feed.open();
  }

  leaveChat(send: boolean) {
    if (send) this.ui.feed.send(this.session.getSnapshot().time);
    else this.ui.feed.close();
    this.keyboard.clear();
    this.keyboard.enabled = this.screens.is("playing") && this.viewer().alive;
    if (this.keyboard.enabled) void this.keyboard.lockPointer();
  }

  // --- Targeted perks ---

  /** True while the targeting tablet has the keyboard and mouse. */
  get targeting(): boolean {
    return this.targetingPerk !== undefined;
  }

  /** Opens the targeting tablet. The match keeps running; the operator stands still meanwhile. */
  private beginTargeting(id: PerkId) {
    const state = this.session.getSnapshot(),
      viewer = this.viewer(state),
      perk = perkById(id);
    if (!this.controllingPlayer || this.ui.feed.editing || state.phase !== "playing") return;
    if (!perk?.targeted || !viewer.perks.includes(id) || (perk.canUse && !perk.canUse(viewer, state))) return;
    this.targetingPerk = id;
    this.keyboard.clear();
    this.keyboard.enabled = false;
    this.equipment.closeWheel();
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.strike.open(perk, state, viewer);
    this.sound.menu("accept");
  }

  /** Closes the tablet and hands control back; with a `target`, the perk is fired at it. */
  endTargeting(target?: Vec2) {
    const id = this.targetingPerk;
    if (!id) return;
    this.targetingPerk = undefined;
    this.ui.strike.close();
    this.keyboard.clear();
    this.keyboard.enabled = this.screens.is("playing") && this.viewer().alive;
    if (!this.keyboard.enabled) return;
    if (target) this.keyboard.queuePerk(id, target);
    else this.sound.menu("back");
    void this.keyboard.lockPointer();
  }

  /** Keyboard steering of the tablet cursor, and Enter to fire. */
  steerTargeting(dx: number, dz: number) {
    this.ui.strike.nudge(dx, dz);
  }

  confirmTargeting() {
    this.ui.strike.confirm();
  }

  // --- Equipment and perks ---

  /** Takes the offered perk at `index`. Returns false when there is nothing to take. */
  chooseOffer(index: number): boolean {
    const viewer = this.viewer();
    const offer = viewer.offers[index];
    if (!viewer.alive || !offer) return false;
    this.choosePerk(offer);
    return true;
  }

  togglePerks() {
    this.ui.togglePerks();
  }

  toggleFullscreen() {
    void this.ui.toggleFullscreen();
    this.sound.menu();
  }

  playClick() {
    this.sound.menu();
  }

  /** Re-locks the pointer after the browser released it without pausing (for example a canvas click). */
  recapturePointer() {
    if (this.keyboard.topDown || this.keyboard.selectingWheel) return;
    if (this.controllingPlayer && !document.pointerLockElement) void this.keyboard.lockPointer();
  }

  // --- UI actions ---

  private uiActions(): UIActions {
    return {
      selectMode: (id) => {
        if (!this.screens.is("lobby") || !MATCH_MODES[id]?.available) return;
        this.setup.mode = id;
        this.ui.setMatchMode(id);
      },
      selectMap: (id) => {
        if (!this.screens.is("lobby") || id === this.setup.mapId) return;
        const map = MAPS.find((entry) => entry.id === id);
        if (!map) return;
        this.setup.mapId = id;
        this.session.restart(this.setup.backdropOptions());
        this.renderer.selectLobbyMap(map);
        this.ui.setMap(id);
      },
      toggleTerrainPreview: () => {
        if (!this.screens.is("lobby")) return;
        this.previewTerrain = !this.previewTerrain;
        this.ui.setTerrainPreview(this.previewTerrain);
        this.sound.menu(this.previewTerrain ? "accept" : "back");
      },
      changeOutfit: (value) => {
        if (!this.screens.is("lobby")) return;
        Object.assign(this.setup.appearance, value);
        if (value.skin) void this.renderer.previewSkin(value.skin).catch(console.error);
        this.applyAppearance();
      },
      importSkin: async (file, model) => {
        await this.renderer.importSkin(file, model);
        this.setup.appearance.skin = "custom";
        this.applyAppearance();
        this.ui.setAppearance(this.setup.appearance, readCustomSkin());
      },
      openRoom: () => this.openRoom(),
      configureBot: (id, changes) => {
        if (!this.screens.is("room")) return;
        const slot = this.setup.slots.find((s) => s.id === id);
        if (slot) Object.assign(slot, changes);
        this.showRoom();
      },
      setZoneDuration: (seconds) => {
        if (!this.screens.is("room") || !(ZONE.durations as readonly number[]).includes(seconds)) return;
        this.setup.setZoneDuration(seconds);
      },
      setZombieRate: (value) => {
        if (!this.screens.is("room") || !isZombieRate(value)) return;
        this.setup.setZombieRate(value);
      },
      drawPortrait: (canvas, skin, seat) => this.renderer.drawPortrait(canvas, skin, seat),
      enterShop: () => void this.enterShop(),
      tradeSkill: (id, refund) => this.tradeSkill(id, refund),
      deploy: () => this.deploy(),
      activateSkill: (id) => {
        if (this.screens.is("playing")) this.keyboard.queueSkill(id);
      },
      choosePerk: (id) => this.choosePerk(id),
      canShop: () => this.controllingPlayer && !this.keyboard.selectingWheel && !this.keyboard.topDown,
      setShopSelecting: (selecting) => {
        // The equipment wheel uses the same flag to hold the camera still while the mouse picks.
        this.equipment.closeWheel();
        this.keyboard.selectingWheel = selecting;
      },
      shopTick: () => this.sound.selectionTick(),
      buySupply: (id) => {
        if (this.controllingPlayer) this.keyboard.queueSupply(id);
      },
      shopSound: (cue) => this.sound.shop(cue),
      usePerk: (id) => {
        if (this.controllingPlayer) this.keyboard.queuePerk(id);
      },
      confirmStrike: (target) => this.endTargeting(target),
      cancelStrike: () => this.endTargeting(),
      openChat: () => this.openChat(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      goHome: () => this.goHome(),
      openHelp: () => this.openHelp(),
      openGraphics: () => {
        if (!this.screens.is("lobby")) return;
        this.screens.transition("graphics");
        this.ui.showGraphics(this.renderer.graphics, this.sound.volumes);
        this.sound.menu("accept");
      },
      changeGraphics: (value) => {
        if (!this.screens.is("graphics")) return;
        this.renderer.setGraphics(value);
        saveGraphics(value);
      },
      closeGraphics: () => this.closeGraphics(),
      setVolume: (channel, position) => {
        if (this.screens.is("graphics")) this.sound.setVolume(channel, position);
      },
      previewVolume: (channel) => {
        if (this.screens.is("graphics")) this.sound.previewVolume(channel);
      },
      openCredits: () => {
        if (!this.screens.is("lobby")) return;
        this.screens.transition("credits");
        this.ui.showCredits(() => this.sound.creditsSpectrum());
        this.sound.menu("accept");
        this.sound.setMusic(CREDITS_MUSIC);
      },
      closeCredits: () => this.closeCredits(),
      setLanguage: (value) => this.changeLanguage(value),
      toggleSound: () => {
        this.ui.setSound(this.sound.toggle());
        this.sound.menu();
      },
      playClick: () => this.playClick(),
      skipReplay: () => this.skipReplay(),
    };
  }

  private openHelp() {
    if (this.screens.is("shop", "room", "credits")) return;
    // Reopening the manual from itself keeps the place it was first opened from.
    this.helpFromLobby = this.screens.is("lobby") || (this.screens.is("help") && this.helpFromLobby);
    this.screens.transition("help");
    this.releaseControls();
    this.ui.showHelp(!this.helpFromLobby);
    this.sound.menu("accept");
  }

  private changeLanguage(value: Language) {
    if (!this.screens.is("graphics", "paused")) return;
    setLanguage(value);
    localizeDocument();
    this.renderer.canvas.ariaLabel = t("3D 爆破战场");
    this.ui.refreshLanguage(this.viewer());
    this.ui.setMatchMode(this.setup.mode);
    this.ui.setSound(this.sound.enabled);
    this.ui.setTerrainPreview(this.previewTerrain);
    // The open dialog is rebuilt in the new language, so focus has to be put back on the select.
    if (this.screens.is("graphics")) this.ui.showGraphics(this.renderer.graphics, this.sound.volumes);
    else this.ui.showPause();
    queueMicrotask(() => this.ui.focusLanguageSelect());
  }

  private applyAppearance() {
    this.renderer.dressPreview(this.setup.appearance);
    this.setup.saveAppearance();
  }

  private showRoom() {
    this.ui.showRoom(
      this.setup.slots,
      this.setup.appearance,
      this.setup.mapName,
      this.setup.zombieRate,
      this.setup.mode,
      this.setup.zoneDuration,
      this.setup.zoneScale,
    );
  }

  // --- Match flow ---

  private async loadLobby() {
    loading.show();
    await afterPaint();
    if (this.closed) return;
    const state = this.session.getSnapshot();
    await preloadEverything(this.renderer, this.sound, state, loading.progress);
    if (this.closed) return;
    const now = performance.now() / 1000;
    this.renderer.render(state, "lobby", LOCAL_PLAYER_ID, 0, now, undefined, true);
    this.renderer.renderPreview(now);
    this.screens.transition("lobby");
    loading.hide();
    this.ui.enterLobby();
  }

  /** Builds the match behind the loading screen, then opens the skill shop. */
  private async enterShop() {
    if (!this.screens.is("room") || !this.setup.ready) return;
    this.screens.transition("loading");
    this.releaseControls();
    this.sound.reset();
    this.sound.setMusic(this.setup.music);
    this.sound.menu("accept");
    loading.show(this.setup.mapName);
    try {
      await afterPaint();
      if (this.closed) return;
      this.session.restart(this.setup.matchOptions());
      const state = this.session.getSnapshot();
      loading.drawMap(state);
      await afterPaint();
      if (this.closed) return;
      await this.renderer.prepare(state, true, loading.progress);
      if (this.closed) return;
      this.renderer.render(
        state,
        "first-person",
        LOCAL_PLAYER_ID,
        this.keyboard.pitch,
        performance.now() / 1000,
        this.keyboard.yaw,
      );
      const viewer = this.viewer(state);
      this.deathShown = false;
      this.recorder.clear();
      this.feedback.clear();
      this.displayedLevel = viewer.level;
      this.ui.setSound(this.sound.enabled);
      this.ui.setInGame(true);
      this.screens.transition("shop");
      loading.hide();
      this.ui.showShop(viewer);
      this.sound.shop("open");
    } catch (error) {
      if (!this.closed) loading.fail(error);
    }
  }

  private tradeSkill(id: SkillId, refund: boolean) {
    if (!this.screens.is("shop")) return;
    this.session.submit(LOCAL_PLAYER_ID, {
      ...idleInput(this.keyboard.yaw),
      ...(refund ? { refundSkill: id } : { buySkill: id }),
    });
    const before = this.viewer().credits;
    // A zero-length advance settles the trade without moving match time.
    this.session.advance(0);
    const viewer = this.viewer();
    this.sound.shop(viewer.credits === before ? "deny" : "buy");
    this.ui.showShop(viewer);
  }

  private deploy() {
    if (!this.screens.is("shop")) return;
    this.sound.shop("close");
    this.screens.transition("playing");
    this.ui.hideOverlay();
    this.keyboard.clear();
    this.keyboard.enabled = true;
    void this.keyboard.lockPointer();
  }

  private choosePerk(id: PerkId) {
    if (!this.screens.is("playing")) return;
    if (this.ui.feed.editing) this.ui.feed.close();
    this.session.submit(LOCAL_PLAYER_ID, { ...idleInput(this.keyboard.yaw), choosePerk: id });
    this.session.advance(0);
    // A further pending level refills the offer; keep control with the tray until none is left.
    if (this.viewer().offers.length) return;
    this.ui.hideOverlay();
    this.ui.clearPerks();
    this.equipment.closeWheel();
    this.keyboard.enabled = true;
    void this.keyboard.lockPointer();
  }

  /** Hands input back to the page: closes transient input UI, clears held keys, frees the pointer. */
  private releaseControls() {
    this.targetingPerk = undefined;
    this.ui.strike.close();
    this.sound.battleFire(0);
    this.sound.rain(0);
    this.sound.wildlife();
    this.equipment.closeWheel();
    this.ui.feed.close();
    this.keyboard.enabled = false;
    this.keyboard.clear();
    this.session.advance(0);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private viewer(state: Readonly<GameSnapshot> = this.session.getSnapshot()): Player {
    return state.players.find((p) => p.id === LOCAL_PLAYER_ID)!;
  }

  // --- Frame ---

  private frame(now: number, dt: number) {
    if (this.screens.is("loading")) {
      this.loop.resetClock();
      return;
    }
    if (this.screens.is("room")) {
      this.renderRoom(now);
      return;
    }
    if (this.screens.is("replay")) {
      this.replayFrame(now, dt);
      return;
    }
    if (this.screens.is("playing")) {
      const observation = this.session.getSnapshot();
      const input = this.keyboard.decide({ self: this.viewer(observation), state: observation, dt });
      this.session.submit(LOCAL_PLAYER_ID, input);
      const simStarted = performance.now();
      this.session.advance(dt);
      this.renderer.profile("sim", performance.now() - simStarted);
      this.recorder.capture(this.session.getSnapshot());
    }
    const state = this.session.getSnapshot();
    const viewer = this.viewer(state);
    const topDown = viewer.alive && inTacticalView(viewer, state.time);
    if (topDown && this.keyboard.selectingWheel) this.equipment.closeWheel();
    this.keyboard.setTopDown(topDown);
    this.ui.setTopDown(topDown);
    this.sound.update(state, LOCAL_PLAYER_ID);
    if (this.screens.is("playing")) this.followMatch(state, viewer, now);
    this.renderScene(state, viewer, now);
    this.presentBattle(state, viewer, now);
    this.renderer.finishFrame();
    if (this.hudRefresh.ready(now) && !this.screens.is("lobby", "graphics", "credits")) {
      const hudStarted = performance.now();
      this.ui.update({
        snapshot: state,
        viewer,
        landing: this.renderer.landingPreview,
        selectedPerk: this.keyboard.selectedPerk,
      });
      // Lands in the next frame's sample, which is the frame that waits for it.
      this.renderer.profile("hud", performance.now() - hudStarted);
    }
  }

  private renderRoom(now: number) {
    // The dialog is translucent: draw the lobby scene once so it has a backdrop.
    if (this.roomBackdropPending) {
      this.renderer.render(this.session.getSnapshot(), "lobby", LOCAL_PLAYER_ID, 0, now);
      this.roomBackdropPending = false;
    }
    this.renderer.renderRoom(now);
  }

  /** Reacts to what the simulation produced this frame: events, match end, death, offers, level-ups. */
  private followMatch(state: Readonly<GameSnapshot>, viewer: Player, now: number) {
    this.sound.matchClock(state);
    this.ui.showEvents(state, viewer);
    this.feedback.update(state, viewer, this.keyboard.yaw, now);
    if (this.ui.mutationNotice.update(state.time)) this.sound.mutationReady();
    if (state.phase === "finished") {
      // The final kill, whoever made it; a draw by timeout has none.
      const fallen = lastFallen(state);
      if (!fallen || !this.beginReplay(state, fallen, "result")) this.showOutcome("result");
    } else if (!viewer.alive && !this.deathShown) {
      this.deathShown = true;
      if (!this.beginReplay(state, viewer, "eliminated")) this.showOutcome("eliminated");
    } else {
      if (this.ui.offerPerks(viewer)) this.sound.perkReady();
      if (viewer.level > this.displayedLevel) {
        // The fixed gains of every level crossed since the banner last showed.
        const gains = state.events
          .flatMap((e) => (e.type === "level" && e.playerId === viewer.id ? [e.gains] : []))
          .slice(this.displayedLevel - viewer.level)
          .flat()
          .map((gain) => LEVEL_GAIN_TEXT[gain]);
        const { banner, cards } = this.ui.showPromotion(this.displayedLevel, viewer.level, gains);
        this.renderer.promotion(now, banner, cards);
        this.sound.levelUp();
        this.displayedLevel = viewer.level;
      }
    }
  }

  /** The after-action screen: the decided match, or the viewer's own elimination. */
  private showOutcome(screen: "eliminated" | "result") {
    const state = this.session.getSnapshot(),
      viewer = this.viewer(state);
    this.screens.transition(screen);
    this.releaseControls();
    this.ui.clearPerks();
    this.ui.showResult(state, viewer, this.typeTick);
    if (screen === "eliminated") this.sound.eliminated();
    else if (state.winnerId === viewer.id) this.sound.victory();
    else if (viewer.alive) this.sound.eliminated();
  }

  // --- Killcam ---

  /**
   * Plays the last moments of `victim` back in slow motion before `then` is shown. The match
   * stands still meanwhile. Returns false when there is nothing to play, or motion is switched off.
   */
  private beginReplay(state: Readonly<GameSnapshot>, victim: Player, then: "eliminated" | "result") {
    const diedAt = victim.stats?.diedAt;
    if (diedAt === undefined || motionScale() === 0 || this.reducedMotion.matches) return false;
    // The frame of the kill itself is the one the replay ends on.
    this.recorder.capture(state, true);
    const director = Killcam.plan(this.recorder.clip(diedAt - 3), victim.id);
    if (!director) return false;
    this.killcam = { director, then };
    this.screens.transition("replay");
    this.releaseControls();
    this.ui.clearPerks();
    this.feedback.clear();
    const killer = state.players.find((p) => p.id === director.killerId);
    this.ui.killcam.show({ final: then === "result", victim, killer });
    this.renderer.beginReplay(director.terrainChanges);
    this.sound.beginReplay(director.duration);
    return true;
  }

  private replayFrame(now: number, dt: number) {
    const { director } = this.killcam!;
    const finished = director.advance(dt);
    const { state, shot, rate, progress, cues } = director.frame();
    this.sound.replayCues(cues, shot.focus, rate);
    this.renderer.replayShot = shot;
    this.renderer.render(state, "replay", LOCAL_PLAYER_ID, 0, now, 0, false, 0, false);
    this.renderer.finishFrame();
    this.ui.killcam.progress(progress);
    if (finished) this.skipReplay();
  }

  /** Ends the replay, on its last frame or on the player's key, and moves on to the result. */
  skipReplay() {
    const then = this.killcam?.then;
    if (!then) return;
    this.dropReplay();
    this.showOutcome(then);
  }

  /** Puts the replay away without moving on, for the ways out that skip the result as well. */
  private dropReplay() {
    if (!this.killcam) return;
    this.killcam = undefined;
    this.renderer.endReplay();
    this.ui.killcam.hide();
    this.sound.endReplay();
  }

  private renderScene(state: Readonly<GameSnapshot>, viewer: Player, now: number) {
    const inLobby =
      this.screens.is("lobby", "graphics", "credits") || (this.screens.is("help") && this.helpFromLobby);
    const mode = inLobby ? "lobby" : viewer.alive ? "first-person" : "spectator";
    this.renderer.render(
      this.session.getRenderSnapshot?.() ?? state,
      mode,
      LOCAL_PLAYER_ID,
      this.keyboard.pitch,
      now,
      this.keyboard.yaw,
      inLobby && !this.previewTerrain,
      inLobby && !this.reducedMotion.matches ? this.sound.menuBeat(now) : 0,
      this.controllingPlayer && !this.keyboard.selectingWheel,
    );
    if (this.screens.is("lobby", "graphics", "credits")) this.renderer.renderPreview(now);
  }

  /** Drives the HUD layers and ambience that follow match time every frame, not on the HUD interval. */
  private presentBattle(state: Readonly<GameSnapshot>, viewer: Player, now: number) {
    const playing = this.screens.is("playing");
    const inBattle = playing && state.phase === "playing";
    const canAim =
      inBattle &&
      viewer.alive &&
      this.keyboard.enabled &&
      !this.keyboard.selectingWheel &&
      !this.ui.feed.editing;
    this.sound.aimAt(canAim ? this.renderer.landingPreview : undefined);

    const battle = battlePresentation(state, viewer, inBattle);
    this.ui.setCollapse(battle.collapseSeconds, battle.collapsePending);
    if (inBattle) this.sound.collapseClock(battle.collapseWarning);
    this.ui.setBattleFire(battle.fireLayer, battle.resetSeconds, battle.resetShift);
    this.ui.setHealthDanger(battle.healthFraction);
    this.sound.battleFire(
      FIRE_VOLUME[battle.fireLayer],
      battle.resetId,
      battle.resetSeconds,
      battle.resetShift,
    );
    this.sound.rain(playing ? this.renderer.rainLevel : 0);
    this.sound.wildlife(playing ? state.mapId : undefined);
    if (playing)
      this.renderer.drawRewardEffects(
        now,
        this.reducedMotion.matches ? 0 : FIRE_STRENGTH[battle.fireLayer],
        battle.fireLayer === "offer",
      );
  }
}
