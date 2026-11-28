import "./reward-effects.css";
import "./equipment-wheel.css";
import "./deployment-menu.css";
import "./feedback-hud.css";
import "./strike-panel.css";
import "./credits.css";
import "./music-box.css";
import "./story-gallery.css";
import "./story-pause.css";
import "./story-theme.css";
// The visual skin overrides every surface, so it must stay the last stylesheet.
import "./icon-art.css";
import "./match-result.css";
import "./game-skin.css";
import { MATCH_MODES, type MatchMode } from "../core/match-modes";
import type { Appearance, AvatarSkin, BotSlot, ZombieRate } from "../core/room";
import type { Difficulty, GameSnapshot, Player, SkillId } from "../core/types";
import { bindShellCopy } from "../i18n";
import { bindings, type BindingId } from "../input/bindings";
import type { GraphicsSettings } from "../render/graphics-settings";
import type { SkinModel } from "../render/minecraft-skins";
import type { UIActions } from "./actions";
import { BattleEffectsView, type BattleFireLayer } from "./battle-effects";
import { BuffPanelView } from "./buff-panel";
import { CombatFeed } from "./combat-feed";
import { mountControls } from "./control-settings";
import { creditsMarkup, mountCredits } from "./credits";
import type { SpectrumReader } from "./credits-spectrum";
import type { MusicPlayer } from "../audio/music-player";
import { mountMusicBox, musicBoxMarkup } from "./music-box";
import { galleryMarkup, mountGallery } from "./story-gallery";
import { mountStory, storyMarkup, type StoryHandle, type StoryHost } from "../story/story-view";
import { STORY_ART } from "../story/assets";
import type { StoryHud, StoryShopOptions } from "../story/stage";
import { query } from "./dom";
import { EquipmentWheel } from "./equipment-wheel";
import { graphicsChange, graphicsForm, syncGraphics, syncVolumeRow } from "./graphics-options";
import type { VolumeChannel, Volumes } from "../audio/sound";
import { icon } from "./icons";
import { KillcamView } from "./killcam";
import { LobbyView } from "./lobby";
import { manualMarkup } from "./manual";
import { pauseMarkup, storyPauseMarkup } from "./match-menus";
import { applyResultFrames, placement, resultKind, resultMarkup } from "./match-result";
import { paintSkinHeads } from "./skin-heads";
import { playResult } from "./match-result-motion";
import { roomMarkup, updateRoom } from "./match-room";
import { MutationNotice } from "./mutation-notice";
import { Overlay } from "./overlay";
import { PerkTray } from "./perk-tray";
import { RadarView } from "./radar";
import { OutcomeBadge } from "./outcome-badge";
import { clearRankBanner, showRankBanner } from "./rank-banner";
import { RoundStatusView } from "./round-status";
import { ScoreboardView } from "./scoreboard";
import { shopMarkup, updateShop } from "./shop";
import { SkillBarView } from "./skill-bar";
import { StrikePanel } from "./strike-panel";
import { TopBar } from "./top-bar";
import { SupplyShopView } from "./supply-shop";
import type { HudFrame, HudView } from "./view";
import { WalletView } from "./wallet";
import { VitalsView } from "./vitals";

export type { UIActions } from "./actions";
export type { HudFrame } from "./view";

/** Mount points only; each view fills in its own element. */
const SHELL = `
      <div class="vignette"></div><div id="damage"></div>
      <header class="topbar"><a class="brand" href="#" aria-label="爆破前线首页"><img class="brand-mark brand-mark-default" src="./assets/menu/insignia.png" alt=""><img class="brand-mark brand-mark-story" src="${STORY_ART.logo}" alt=""><span>爆破前线<small>DEMOLITION</small></span></a></header>
        <div class="top-actions" role="group" aria-label="游戏控制"></div>
      <main id="lobby"></main>
      <div id="hud" hidden>
        <div class="round-status"></div>
        <div id="players" class="players"></div>
        <aside class="radar"></aside>
        ${BattleEffectsView.markup}
        <aside id="equipment-wheel"></aside>
        <div class="board-bomb-hint">${icon("bomb")}<kbd>空格</kbd><span>原地放置炸药</span></div>
        <aside id="supply-shop" class="supply-shop" aria-label="补给"></aside>
        <div class="bottom-hud"><div id="wallet" class="wallet"></div><div id="player-stats" class="player-stats"></div><div class="loadout"><div class="skill-buttons"></div>
          </div></div>
      </div>
      <aside id="strike-panel" class="strike-panel" hidden></aside>
      <div id="overlay" hidden></div><div id="fatal" hidden role="alert"></div>`;

/**
 * Composes the views and routes DOM events to `UIActions`. It holds no game state: everything it
 * shows comes from the arguments of the call that shows it.
 */
export class GameUI {
  readonly feed: CombatFeed;
  readonly wheel: EquipmentWheel;
  readonly mutationNotice: MutationNotice;
  /** Targeting tablet for perks that need a cell. */
  readonly strike: StrikePanel;
  /** Chrome of the slow-motion replay. */
  readonly killcam: KillcamView;
  private readonly hud: HTMLElement;
  private readonly topBar: TopBar;
  private readonly lobby: LobbyView;
  private readonly overlay: Overlay;
  private readonly roundStatus: RoundStatusView;
  private readonly effects: BattleEffectsView;
  private readonly skills: SkillBarView;
  private readonly perkTray: PerkTray;
  /** Refreshed together on the HUD interval. */
  private readonly hudViews: readonly HudView[];
  private readonly refreshShellCopy: () => void;
  private readonly listeners = new AbortController();
  /** Id of the newest event already shown. */
  private eventCursor = 0;

  /** Built at startup so its WebGL programs are compiled long before a match ends. */
  private readonly badge = new OutcomeBadge();

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: UIActions,
  ) {
    root.insertAdjacentHTML("beforeend", SHELL);
    this.hud = query(root, "#hud");
    this.topBar = new TopBar(query(root, ".top-actions"));
    this.lobby = new LobbyView(query(root, "#lobby"), actions);
    this.roundStatus = new RoundStatusView(query(root, ".round-status"));
    const scoreboard = new ScoreboardView(query(root, "#players"));
    const radar = new RadarView(query(root, ".radar"));
    const buffs = new BuffPanelView(query(root, "#buffs"));
    this.effects = new BattleEffectsView(root);
    this.wheel = new EquipmentWheel(query(root, "#equipment-wheel"));
    const vitals = new VitalsView(query(root, "#player-stats"));
    this.skills = new SkillBarView(query(root, ".skill-buttons"));
    const wallet = new WalletView(query(root, "#wallet"));
    const supply = new SupplyShopView(query(root, "#supply-shop"), {
      canOpen: () => actions.canShop(),
      setSelecting: (selecting) => actions.setShopSelecting(selecting),
      tick: () => actions.shopTick(),
      buy: (id) => actions.buySupply(id),
      sound: (cue) => actions.shopSound(cue),
    });
    this.strike = new StrikePanel(query(root, "#strike-panel"), {
      confirm: (target) => actions.confirmStrike(target),
      cancel: () => actions.cancelStrike(),
      tick: () => actions.shopTick(),
    });
    this.hudViews = [
      this.strike,
      this.effects,
      this.roundStatus,
      scoreboard,
      vitals,
      wallet,
      supply,
      this.wheel,
      this.skills,
      buffs,
      radar,
    ];
    this.mutationNotice = new MutationNotice(this.hud);
    this.feed = new CombatFeed(this.hud);
    this.overlay = new Overlay(query(root, "#overlay"));
    this.perkTray = new PerkTray(root);
    this.killcam = new KillcamView(root, () => actions.skipReplay());

    const { signal } = this.listeners;
    this.syncKeyHints();
    bindings.addEventListener("change", () => this.syncKeyHints(), { signal });
    // Bound last so that it also covers the copy each view rendered above.
    this.refreshShellCopy = bindShellCopy(root);
    this.refreshCopy();
    root.addEventListener("change", (event) => this.onChange(event), { signal });
    root.addEventListener("input", (event) => this.onInput(event), { signal });
    root.addEventListener("click", (event) => this.onClick(event), { signal });
  }

  /** Element the renderer mounts the lobby avatar preview on. */
  get avatarMount(): HTMLElement {
    return query(this.root, "#lobby-avatar");
  }

  // --- Lobby and chrome ---

  /** Switches between the lobby shell and the in-match HUD, clearing per-match UI state. */
  setInGame(inGame: boolean) {
    delete this.root.dataset.storyHud;
    this.mutationNotice.clear();
    document.body.classList.toggle("in-game", inGame);
    this.lobby.root.hidden = inGame;
    this.lobby.reset();
    this.hud.hidden = !inGame;
    this.hideOverlay();
    this.clearPerks();
    this.strike.close();
    clearRankBanner(this.hud);
    this.feed.clear();
    this.eventCursor = 0;
    this.effects.clearDamageFlash();
  }

  /** Plays the main menu's arrival. Call when the lobby comes into view. */
  enterLobby() {
    this.lobby.enter();
  }

  /** Leaves an open lobby sub-menu. Returns false when the main menu itself is showing. */
  lobbyBack(): boolean {
    return this.lobby.back();
  }

  /** Runs the primary action of a lobby tab that has its own. Returns false on the versus tab. */
  lobbyConfirm(): boolean {
    return this.lobby.confirm();
  }

  /** The main menu's open top-level tab. */
  get lobbyTab() {
    return this.lobby.tab;
  }

  /** Re-reads the story save, after the story wrote to it. */
  refreshStory() {
    this.lobby.refreshStory();
  }

  setAppearance(value: Appearance, customSkin: { imported: boolean; model?: SkinModel }) {
    this.lobby.setAppearance(value, customSkin);
  }

  setMatchMode(mode: MatchMode) {
    this.lobby.setMatchMode(mode);
    this.roundStatus.setMode(mode);
  }

  setTerrainPreview(active: boolean) {
    this.lobby.setTerrainPreview(active);
  }

  setMap(id: string) {
    this.lobby.setMap(id);
  }

  setSound(on: boolean) {
    this.topBar.setSound(on);
  }

  /** Marks the shell while the tactical top-down view is active; the stylesheet restyles the HUD. */
  setTopDown(active: boolean) {
    if (this.root.hasAttribute("data-top-down") !== active)
      this.root.toggleAttribute("data-top-down", active);
  }

  toggleFullscreen() {
    return this.topBar.toggleFullscreen();
  }

  /** Re-renders everything in the current language. `viewer` rebuilds an open perk tray. */
  refreshLanguage(viewer: Player) {
    this.refreshCopy();
    this.wheel.refreshLanguage();
    this.feed.refreshLanguage();
    this.mutationNotice.refresh();
    this.perkTray.refreshLanguage(viewer);
  }

  // --- Overlay screens ---

  showRoom(
    slots: BotSlot[],
    look: Appearance,
    mapName: string,
    rate: ZombieRate,
    mode: MatchMode,
    zoneDuration: number,
    zoneScale = 1,
  ) {
    const room = this.overlay.dialog("room-modal") ?? this.overlay.show(roomMarkup(slots), "room-modal");
    updateRoom(room, slots, look, mapName, rate, this.actions.drawPortrait, mode, zoneDuration, zoneScale);
  }

  /**
   * A match under the story: the lobby gets out of the way and comes back, without touching the
   * overlay, which is where the story itself is mounted.
   */
  setStoryMatch(on: boolean) {
    this.lobby.root.hidden = on;
    if (!on) this.setStoryHud(false);
  }

  /** Show only the HUD elements named by the current lesson. */
  setStoryHud(value: StoryHud) {
    const on = typeof value === "boolean" ? value : value.length > 0;
    if (on) this.root.dataset.storyHud = typeof value === "boolean" ? "full" : value.join(" ");
    else delete this.root.dataset.storyHud;
    document.body.classList.toggle("in-game", on);
    this.hud.hidden = !on;
    if (on) return;
    this.mutationNotice.clear();
    this.clearPerks();
    this.strike.close();
    clearRankBanner(this.hud);
    this.feed.clear();
    this.eventCursor = 0;
    this.effects.clearDamageFlash();
  }

  /** The skill shop as a dialog inside `parent`, for a scene that keeps the overlay to itself. */
  mountShop(parent: HTMLElement, player: Player, options: StoryShopOptions = {}) {
    const shop = document.createElement("section");
    shop.className = "modal shop-modal";
    shop.setAttribute("role", "dialog");
    if (options.requiredSkills) shop.dataset.requiredSkills = options.requiredSkills.join(" ");
    shop.innerHTML = shopMarkup(player, options);
    parent.append(shop);
    queueMicrotask(() => shop.querySelector<HTMLElement>("button")?.focus());
    return shop;
  }

  /** Refresh a shop inside the story without replacing its stage. */
  updateStoryShop(shop: HTMLElement, player: Player) {
    updateShop(shop, player);
  }

  showShop(player: Player) {
    const shop = this.overlay.dialog("shop-modal");
    if (shop) updateShop(shop, player);
    else this.overlay.show(shopMarkup(player), "shop-modal");
  }

  showPause() {
    if (this.story) this.storyDialog("pause", storyPauseMarkup(), "pause-modal");
    else this.overlay.show(pauseMarkup());
  }

  showHelp(inGame: boolean) {
    const dialog = this.story
      ? this.storyDialog("help", manualMarkup(true), "help-modal")
      : this.overlay.show(manualMarkup(inGame), "help-modal", ".guide-section summary");
    mountControls(dialog);
  }

  showGraphics(value: GraphicsSettings, volumes: Readonly<Volumes>) {
    const dialog = this.story
      ? this.storyDialog("graphics", graphicsForm(volumes), "graphics-modal")
      : this.overlay.show(graphicsForm(volumes), "graphics-modal");
    syncGraphics(query<HTMLFormElement>(dialog, "#graphics-form"), value);
  }

  showMusicBox(player: MusicPlayer, setVolume: (volume: number) => void) {
    const dialog = this.storyDialog("music", musicBoxMarkup(), "music-box-modal");
    this.stopStoryMenu = mountMusicBox(dialog, player, setVolume);
  }

  showGallery() {
    const dialog = this.storyDialog("gallery", galleryMarkup(), "gallery-modal");
    this.stopStoryMenu = mountGallery(dialog);
  }

  private stopCredits?: () => void;

  showCredits(readSpectrum: SpectrumReader) {
    this.stopCredits?.();
    this.stopCredits = mountCredits(
      this.overlay.show(creditsMarkup(), "credits-modal", "#credits-close"),
      readSpectrum,
    );
  }

  private story?: StoryHandle;
  private storyHost?: StoryHost;
  private storyMenu?: HTMLElement;
  private stopStoryMenu?: () => void;
  storyMenuKind?: "pause" | "graphics" | "help" | "music" | "gallery";

  private storyDialog(
    kind: "pause" | "graphics" | "help" | "music" | "gallery",
    html: string,
    className: string,
  ) {
    this.stopStoryMenu?.();
    this.stopStoryMenu = undefined;
    this.storyMenu?.remove();
    this.story?.pause(true);
    this.storyMenuKind = kind;
    const menu = document.createElement("div");
    menu.className = "story-menu";
    menu.innerHTML = `<section class="modal ${className}" role="dialog" aria-modal="true">${html}</section>`;
    this.root.append(menu);
    this.storyMenu = menu;
    queueMicrotask(() => menu.querySelector<HTMLElement>("button,select")?.focus());
    return menu.firstElementChild as HTMLElement;
  }

  closeStoryMenu() {
    this.stopStoryMenu?.();
    this.stopStoryMenu = undefined;
    this.storyMenu?.remove();
    this.storyMenu = undefined;
    this.storyMenuKind = undefined;
    this.story?.pause(false);
  }

  showStory(host: StoryHost, act?: string, titled = false) {
    this.stopStoryMenu?.();
    this.stopStoryMenu = undefined;
    this.story?.stop();
    this.storyMenu?.remove();
    this.storyMenu = this.storyMenuKind = undefined;
    this.storyHost = host;
    this.root.dataset.storyMode = "true";
    const screen = this.overlay.screen(storyMarkup(), "story-screen");
    this.story = mountStory(screen, host, act, titled);
  }

  restartStory() {
    if (this.storyHost && this.story) this.showStory(this.storyHost, this.story.actId, true);
  }

  /**
   * The after-action screen: the match result once it is decided, otherwise the viewer's own
   * elimination. `tick` sounds the counters of the reveal.
   */
  showResult(snapshot: Readonly<GameSnapshot>, viewer: Player, tick: () => void) {
    const kind = resultKind(snapshot, viewer);
    const screen = this.overlay.screen(resultMarkup(snapshot, viewer, kind), `result-screen outcome-${kind}`);
    applyResultFrames(screen);
    paintSkinHeads(screen);
    this.badge.show(
      query(screen, ".outcome-badge-slot"),
      kind === "eliminated" ? "defeat" : kind,
      placement(snapshot, viewer),
    );
    playResult(screen, tick);
  }

  hideOverlay() {
    this.stopStoryMenu?.();
    this.stopStoryMenu = undefined;
    this.stopCredits?.();
    this.stopCredits = undefined;
    this.story?.stop();
    this.story = undefined;
    this.storyHost = undefined;
    this.storyMenu?.remove();
    this.storyMenu = this.storyMenuKind = undefined;
    delete this.root.dataset.storyMode;
    this.overlay.hide();
  }

  focusLanguageSelect() {
    this.root.querySelector<HTMLSelectElement>("[data-language]")?.focus();
  }

  focusGraphicsButton() {
    query(this.root, "#graphics").focus();
  }

  // --- Match HUD ---

  update(frame: HudFrame) {
    for (const view of this.hudViews) view.update(frame);
  }

  /** Feeds events newer than the last call to the combat feed, notices and hit feedback. */
  showEvents(snapshot: Readonly<GameSnapshot>, viewer: Player) {
    const latest = snapshot.events.at(-1);
    if (!latest || latest.id <= this.eventCursor) return;
    for (const event of snapshot.events) {
      if (event.id <= this.eventCursor) continue;
      const player = snapshot.players.find((p) => p.id === event.playerId);
      if (player) this.feed.event(event, player, viewer.id);
      if (event.playerId !== viewer.id) continue;
      if (event.type === "mutation") this.mutationNotice.push(event.mutation);
      if (event.type === "hit" || event.type === "cover-hit") this.effects.confirmHit();
      if (event.type === "hurt" && !event.blocked) this.effects.flashDamage();
    }
    this.eventCursor = latest.id;
  }

  /** Shows the viewer's perk offer. Returns true when a new offer appeared. */
  offerPerks(viewer: Player): boolean {
    return this.perkTray.offer(viewer);
  }

  togglePerks() {
    this.perkTray.toggleExpanded();
  }

  clearPerks() {
    this.perkTray.clear();
  }

  /** Shows the level-up banner and returns the elements the renderer decorates with effects. */
  showPromotion(from: number, to: number, gains: string[]) {
    return { banner: showRankBanner(this.hud, from, to, gains), cards: this.perkTray.cards };
  }

  setBattleFire(layer: BattleFireLayer, seconds?: number, shift = false) {
    this.effects.setBattleFire(layer, seconds, shift);
  }

  setCollapse(seconds: number, pending: boolean) {
    this.effects.setCollapse(seconds, pending);
  }

  setHealthDanger(healthFraction: number) {
    this.effects.setHealthDanger(healthFraction);
  }

  dispose() {
    this.stopStoryMenu?.();
    this.stopStoryMenu = undefined;
    this.stopCredits?.();
    this.listeners.abort();
    this.topBar.dispose();
    this.lobby.dispose();
    this.perkTray.dispose();
    for (const view of this.hudViews) view.dispose();
  }

  // --- Internals ---

  /** Re-renders the copy that was built once with the shell. */
  private refreshCopy() {
    this.refreshShellCopy();
    this.syncKeyHints();
    this.lobby.refreshLanguage();
    this.skills.refreshLanguage();
  }

  /** Rewrites every element that displays a key binding. */
  private syncKeyHints() {
    this.topBar.syncKeyHints();
    for (const hint of this.root.querySelectorAll<HTMLElement>("[data-keyhint]")) {
      const id = hint.dataset.keyhint as BindingId;
      hint.textContent = bindings.label(id);
      // An unbound quick-equip key shows no key cap at all.
      if (id.startsWith("equip:")) hint.hidden = !bindings.codes(id).length;
    }
    this.wheel.syncKeyHints();
  }

  /** Faders act while they are dragged; everything else waits for `change`. */
  private onInput(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.volume) return;
    syncVolumeRow(target);
    this.actions.setVolume(target.dataset.volume as VolumeChannel, Number(target.value) / 100);
  }

  private onChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.volume) {
      this.actions.previewVolume(target.dataset.volume as VolumeChannel);
      return;
    }
    if (target.hasAttribute("data-language")) {
      if (target.value === "en" || target.value === "zh") this.actions.setLanguage(target.value);
      return;
    }
    const graphics = target.closest<HTMLFormElement>("#graphics-form");
    if (graphics) {
      const value = graphicsChange(graphics, target.name);
      this.actions.changeGraphics(value);
      syncGraphics(graphics, value);
      return;
    }
    if (target.id === "zone-duration") {
      this.actions.setZoneDuration(Number(target.value));
      return;
    }
    if (target.id === "zombie-rate") {
      this.actions.setZombieRate(target.value as ZombieRate);
      return;
    }
    const bot = target.dataset.bot;
    if (!bot) return;
    if (target instanceof HTMLInputElement) this.actions.configureBot(bot, { enabled: target.checked });
    else if (target.dataset.setting === "skin")
      this.actions.configureBot(bot, { skin: target.value as AvatarSkin });
    else this.actions.configureBot(bot, { difficulty: target.value as Difficulty });
  }

  private onClick(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLElement>("button, .brand, summary");
    if (!button || button.matches(":disabled")) return;
    const { actions } = this;
    if (button.classList.contains("brand")) {
      event.preventDefault();
      actions.goHome();
      return;
    }
    // Navigation buttons play their own sound in the action; everything else gets the click.
    switch (button.id) {
      case "start":
      case "restart":
        return actions.openRoom();
      case "room-confirm":
        return actions.enterShop();
      case "help":
      case "help-menu":
        return actions.openHelp();
      case "pause":
        return actions.pause();
      case "story-music-box":
        return actions.openMusicBox();
      case "story-gallery":
        return actions.openGallery();
      case "gallery-close":
      case "music-box-close":
        return actions.resume();
      case "resume":
        return actions.resume();
      case "home":
        return actions.goHome();
      case "deploy":
        return actions.deploy();
      case "graphics":
        return actions.openGraphics();
      case "graphics-done":
        return actions.closeGraphics();
      case "credits":
        return actions.openCredits();
      case "credits-close":
        return actions.closeCredits();
      case "terrain-preview":
        return actions.toggleTerrainPreview();
      case "sound":
        return actions.toggleSound();
    }
    const { mode, trade, map, perk, usePerk, skill } = button.dataset;
    // A locked lobby choice only opens its dialog (see LobbyView) and sounds refused.
    if (button.matches("#lobby .locked")) return actions.playLocked();
    if (!button.matches("[data-skill],[data-perk]")) actions.playClick();
    if (mode) {
      if (MATCH_MODES[mode as MatchMode]?.available) actions.selectMode(mode as MatchMode);
    } else if (button.id === "skin-import") this.lobby.openSkinPicker();
    else if (button.id === "fullscreen") void this.toggleFullscreen();
    else if (trade) actions.tradeSkill(trade as SkillId, button.dataset.refund === "true");
    else if (button.id === "chat-open") actions.openChat();
    else if (map) actions.selectMap(map);
    else if (perk) actions.choosePerk(perk);
    else if (usePerk) actions.usePerk(usePerk);
    else if (skill) actions.activateSkill(skill as SkillId);
  }
}
