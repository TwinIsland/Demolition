import { t } from "../i18n";
import { SceneAssets, type LoadProgress } from "./scene-assets";
import { BlastEffect } from "./blast-effect";
import { LobbyPreview } from "./lobby-preview";
import { PlayerPortraits } from "./player-portraits";
import { SUMMON_TIME } from "../core/zombies";
import { poseZombie } from "./zombie-motion";
import { RenderFeel } from "./feel/render-feel";
import { motionScale } from "../feel/settings";
import { SummonEffects } from "./summon-effects";
import { NightVision } from "./night-vision";
import { UpgradeEffects } from "./upgrade-effects";
import { GroundFire } from "./ground-fire";
import { OfferFire } from "./offer-fire";
import type { Appearance } from "../core/room";
import type { MapDefinition } from "../core/pack-api";
import * as THREE from "three";
import { BombLights } from "./bomb-lights";
import { PerformancePanel } from "./performance-panel";
import { readGraphics, type GraphicsSettings } from "./graphics-settings";
import { DangerOverlays } from "./danger-overlays";
import { ZoneWalls } from "./zone-walls";
import { aimCell, canLob, canPlace } from "../core/placement";
import { throwPoint } from "../core/throw-path";
import { ThrowGuide } from "./throw-guide";
import { PlacementTiles } from "./placement-tiles";
import { ShieldField } from "./shield-field";
import { ZombieAsh, ZOMBIE_FALL_DURATION } from "./zombie-ash";
import type { MinecraftAvatar } from "./minecraft-avatar";
import { bombGuideColor, bombWarning, OWN_BOMB_COLOR } from "../core/bomb-warning";
import { SLIDE_STEP } from "../core/geometry";
import { OutdoorLighting } from "./outdoor-lighting";
import { dimPanels, lampLevel } from "./backrooms-hall";
import { SceneEnvironment, type ThunderCue } from "./environment/scene-environment";
import { MAPS } from "../core/maps";
import { ITEMS, RULES } from "../core/content";
import type { FireCell, GameSnapshot, Player } from "../core/types";
import { inTacticalView, isCloaked } from "../core/types";
import { StrikeEffect } from "./strike-effect";
import { Arena, TILE_SIZE, world } from "./arena";
import { WaterWake } from "./water-wake";
import { Models } from "./models";
import type { SkinModel } from "./minecraft-skins";
import { CameraRig, type CameraMode } from "./camera-rig";
import { syncEntities } from "./entity-sync";
import { PostPipeline, postQuality } from "./post/post-pipeline";
import { DynamicResolution } from "./dynamic-resolution";
import { disposeStandIns, texturesUnder, uploadTextures } from "./gpu-warmup";

/** Retina panels report 2 or 3; shading every one of those pixels buys little over 1.5. */
const MAX_PIXEL_RATIO = 1.5;
const basePixelRatio = (settings: GraphicsSettings) =>
  Math.min(devicePixelRatio, MAX_PIXEL_RATIO) * settings.scale;

export type { CameraMode };

/** Per-frame view inputs shared by the entity sync steps. */
interface FrameView {
  state: Readonly<GameSnapshot>;
  mode: CameraMode;
  localId: string;
  wallTime: number;
  /** The local player's Threat Scan is running, which also reveals cloaked operators. */
  scanning: boolean;
}

export class GameRenderer {
  landingPreview?: { x: number; z: number; valid: boolean };
  private preview?: LobbyPreview;
  private portraits?: PlayerPortraits;
  private disposed = false;
  private feel = new RenderFeel();
  private performance: PerformancePanel;
  private submitStarted = 0;
  private bombLights: BombLights;
  private nextShadow = 0;
  private shadowSignature = NaN;
  private resolution = new DynamicResolution();
  private lastFrameAt = 0;
  private overlays!: DangerOverlays;
  private zoneWalls!: ZoneWalls;
  private wallRevision = 0;
  private post: PostPipeline;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig = new CameraRig();
  private assets = new SceneAssets();
  private models = new Models(this.assets.manager);
  private arena?: Arena;
  private avatars = new Map<string, THREE.Group>();
  private zombies = new Map<number, THREE.Group>();
  private summons = new SummonEffects();
  private upgradeFx = new UpgradeEffects();
  private throwGuide = new ThrowGuide();
  private placements = new PlacementTiles();
  private shields = new ShieldField(this.assets.manager);
  private ashes = new ZombieAsh();
  private wading = new WaterWake(this.models.materials);
  private bufferSize = new THREE.Vector2();
  private target = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.84, 4, 1, Math.PI / 4),
    new THREE.MeshBasicMaterial({
      color: OWN_BOMB_COLOR,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  private nightVision = new NightVision(this.assets.manager);
  private bombs = new Map<number, THREE.Group>();
  private items = new Map<number, THREE.Group>();
  private blastEffect = new BlastEffect(this.assets.manager);
  private dynamic = new THREE.Group();
  private hand: MinecraftAvatar;
  private flights = new Map<number, THREE.Group>();
  private groundFire = new GroundFire(this.assets.manager);
  private sweep?: { id: number; cells: FireCell[]; from: number; until: number };
  private vapor = new THREE.TextureLoader(this.assets.manager).load("./assets/smoke-cloud.png");
  private offerFire = new OfferFire(this.vapor);
  private strikes = new StrikeEffect(this.assets.manager, this.models.materials, this.vapor);
  private seed = -1;
  private mapId = "";
  private observer: ResizeObserver;
  private environment: OutdoorLighting;
  private weather: SceneEnvironment;
  /** Brightness of an office floor's ceiling panels as last applied. */
  private lamps = 1;
  private quality = readGraphics();
  private lastEvent = 0;
  /** Hidden stand-ins that keep every mid-match shader program and texture on the GPU. */
  private standIns?: THREE.Group;
  /** Same kind of buffer as the post pipeline's, so warm-up compiles the programs it will use. */
  private warmTarget = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType });
  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      // Every frame reaches the canvas as a full-screen pass, so multisampling it buys nothing.
      antialias: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.info.autoReset = false;
    this.performance = new PerformancePanel(this.renderer, container);
    this.canvas = this.renderer.domElement;
    this.canvas.id = "world";
    this.canvas.setAttribute("aria-label", t("3D 爆破战场"));
    this.canvas.tabIndex = 0;
    container.prepend(this.canvas);
    this.renderer.setPixelRatio(basePixelRatio(this.quality));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // The post pipeline tone-maps the arena itself; this setting serves draws that bypass it.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.overlays = new DangerOverlays(this.dynamic, this.assets.manager);
    this.zoneWalls = new ZoneWalls(this.scene, this.models);
    this.bombLights = new BombLights(this.scene);
    this.environment = new OutdoorLighting(this.renderer, this.scene, this.assets.manager);
    this.weather = new SceneEnvironment(this.renderer, this.scene, this.environment);
    this.scene.add(this.dynamic, this.rig.camera, this.target, this.throwGuide.root, this.blastEffect.root);
    this.scene.add(
      this.placements.root,
      this.shields.root,
      this.ashes.root,
      this.strikes.root,
      this.groundFire.root,
    );
    this.target.rotation.x = -Math.PI / 2;
    this.target.renderOrder = 5;
    this.hand = this.models.firstPersonArm();
    this.hand.hold(this.models.explosive(), "bomb");
    this.rig.held.add(this.hand);
    this.scene.add(this.feel.root, this.wading.root);
    this.post = new PostPipeline(
      this.renderer,
      this.scene,
      this.rig.camera,
      postQuality(this.quality, basePixelRatio(this.quality)),
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.setGraphics(this.quality);
    this.resize();
  }
  /** 0..1 loudness of rain on the map being shown. */
  get rainLevel() {
    return this.weather.rainLevel;
  }
  /** Lightning notifies the audio layer so thunder can follow the flash. */
  set onThunder(listener: ((cue: ThunderCue) => void) | undefined) {
    this.weather.onThunder = listener;
  }
  get graphics() {
    return { ...this.quality };
  }
  setGraphics(settings: GraphicsSettings) {
    this.quality = { ...settings };
    const ratio = basePixelRatio(settings);
    this.resolution.reset();
    if (ratio !== this.renderer.getPixelRatio()) {
      this.renderer.setPixelRatio(ratio);
      this.resize();
    }
    this.environment.shadowResolution(
      settings.shadows === "high" ? 1024 : settings.shadows === "medium" ? 512 : 0,
    );
    this.renderer.shadowMap.enabled = settings.shadows !== "off";
    this.renderer.shadowMap.needsUpdate = true;
    this.nextShadow = 0;
    this.post.setQuality(postQuality(settings, ratio));
    this.weather.setQuality(settings);
    this.portraits?.setResolution(ratio);
  }
  private resize() {
    const w = this.canvas.parentElement!.clientWidth,
      h = this.canvas.parentElement!.clientHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.rig.setAspect(w / h);
  }
  private rebuild(state: Readonly<GameSnapshot>, terrainOnly = false) {
    if (this.arena) {
      this.scene.remove(this.arena.root);
      this.arena.dispose();
    }
    this.nextShadow = 0;
    this.overlays.clear();
    this.zoneWalls.clear();
    this.ashes.clear();
    this.wading.reset();
    this.blastEffect.clear();
    this.strikes.clear();
    this.arena = new Arena(this.models, state);
    this.scene.add(this.arena.root);
    this.environment.shadowCoverage((state.size * TILE_SIZE) / 2 + 2);
    this.weather.applyMap(
      MAPS.find((map) => map.id === state.mapId)!,
      state.tiles,
      this.arena.root,
    );
    this.weather.setWorkLamps(this.arena.workLamps() ?? []);
    this.seed = state.seed;
    this.mapId = state.mapId;
    this.rig.reset();
    if (terrainOnly) return;
    // A new match starts at full resolution again; this runs behind the loading screen.
    if (this.resolution.reset()) {
      this.renderer.setPixelRatio(basePixelRatio(this.quality));
      this.resize();
    }
    this.models.clearAnimations();
    for (const zombie of this.zombies.values()) (zombie as MinecraftAvatar).dispose();
    this.zombies.clear();
    this.dynamic.clear();

    this.avatars.clear();
    this.bombs.clear();
    this.flights.clear();
    this.items.clear();
    for (const p of state.players) {
      const avatar = this.models.character(p);
      this.avatars.set(p.id, avatar);
      this.dynamic.add(avatar);
    }
    this.lastEvent = 0;
  }
  render(
    state: Readonly<GameSnapshot>,
    mode: CameraMode,
    localId: string,
    pitch: number,
    wallTime: number,
    lookYaw?: number,
    showBackdrop = false,
    menuBeat = 0,
    previewThrows = true,
  ) {
    if (showBackdrop && this.preview) {
      this.renderer.info.reset();
      this.submitStarted = performance.now();
      this.performance.beginGpu();
      if (this.preview.backdrop.draw(this.renderer, wallTime, menuBeat)) return;
    }
    if (this.seed !== state.seed || this.mapId !== state.mapId)
      this.rebuild(
        state,
        this.mapId === state.mapId && state.mode === "practice" && state.phase === "playing",
      );
    const syncStarted = performance.now();
    this.feel.begin(state, localId, wallTime);
    const mapChanged = this.arena!.sync(state);
    const workLamps = this.arena!.workLamps();
    if (workLamps) this.weather.setWorkLamps(workLamps);
    this.feel.walls(state, this.arena!.wallLandings);
    if ((state.coverRevision ?? 0) !== this.wallRevision) {
      // A terrain reset may have moved permanent walls; rain lands on their tops.
      this.wallRevision = state.coverRevision ?? 0;
      if (state.wallOrigins) this.weather.updateField(state.tiles);
    }
    this.overlays.sync(state, mapChanged, localId);
    const zoneShake = this.zoneWalls.sync(state, mapChanged, this.arena!.fixedWalls);
    if (zoneShake) this.feel.rumble(zoneShake);
    const you = state.players.find((p) => p.id === localId)!;
    const firstPerson = mode === "first-person";
    const topDown = firstPerson && you.alive && inTacticalView(you, state.time);
    const scanning = firstPerson && you.alive && you.scanUntil > state.time;
    const view: FrameView = { state, mode, localId, wallTime, scanning };
    this.shields.update(state, localId, scanning);
    this.burnKilledZombies(state);
    this.ashes.update(state.time);
    this.syncZombies(state);
    this.updateAim(
      state,
      you,
      { firstPerson, topDown, previewThrows, pitch, yaw: lookYaw ?? you.yaw },
      mapChanged,
    );
    this.wading.update(
      state,
      MAPS.find((map) => map.id === state.mapId),
      wallTime,
      this.renderer.getDrawingBufferSize(this.bufferSize).y,
    );
    this.syncPlayers(view);
    this.syncBombs(view);
    this.syncThrown(state);
    this.groundFire.update(state, wallTime, this.sweepFire(state));
    this.syncItems(view);
    this.bombLights.update(state, you);
    // A bandage stays in hand until its wrap animation ends.
    this.models.equipAvatar(this.hand, this.feel.heldPlayer(you), OWN_BOMB_COLOR);
    this.lastEvent = Math.max(this.lastEvent, ...state.events.map((e) => e.id));
    const { rig } = this;
    rig.update(state, you, {
      mode,
      pitch,
      yaw: lookYaw ?? you.yaw,
      wallTime,
      menuBeat,
      tactical: topDown,
      swing: this.models.swingAmount(you, state.time),
      sink: this.wading.sink(localId),
      feel: (motion) =>
        this.feel.firstPerson(
          rig.camera,
          rig.held,
          this.hand,
          you,
          { yaw: lookYaw ?? you.yaw, pitch },
          motion,
          wallTime,
          topDown,
        ),
    });
    this.feel.topDown(
      you,
      world(you.x, state.size),
      world(you.z, state.size),
      firstPerson ? rig.tacticalBlend : 0,
      wallTime,
    );
    // Only the placement frame animates in the tactical view.
    this.target.scale.setScalar(topDown && motionScale() > 0 ? 1 + 0.1 * Math.sin(wallTime * 7) : 1);
    if (firstPerson && rig.tacticalBlend > 0) this.avatars.get(localId)!.visible = rig.tacticalBlend > 0.35;
    this.blastEffect.update(state, rig.camera);
    for (const impact of this.strikes.update(state, this.renderer.getPixelRatio(), localId)) {
      // Felt across the whole arena, hardest close to the impact.
      const distance = Math.hypot(impact.x - you.x, impact.z - you.z);
      this.feel.rumble(THREE.MathUtils.clamp(1.25 - distance / 12, 0.3, 1.1));
    }
    this.renderer.info.reset();
    this.performance.part("sync", performance.now() - syncStarted);
    this.submitStarted = performance.now();
    this.performance.beginGpu();
    // The blended perspective/orthographic projection breaks AO's depth reconstruction.
    this.post.setOcclusionActive(rig.tacticalBlend < 0.02);
    this.refreshShadows(state, wallTime, mapChanged || zoneShake > 0);
    this.adaptResolution(wallTime);
    const lamps = lampLevel(state, motionScale());
    if (lamps !== this.lamps) {
      this.lamps = lamps;
      this.weather.lampLevel = lamps;
      dimPanels(this.models, lamps);
    }
    // Renders the floor reflection, so the camera must be final here.
    this.weather.update(rig.camera, wallTime, [rig.held]);
    this.post.render();
    if (scanning) {
      const players = state.players
        .filter((p) => p.id !== localId && p.alive)
        .map((p) => this.avatars.get(p.id)!);
      this.nightVision.draw(this.renderer, rig.camera, [...players, ...this.zombies.values()], state.time);
    }
  }
  /**
   * The shadow map is redrawn only when something that casts into it changed: at once for the
   * arena itself, and at a capped rate while characters or bombs are moving.
   */
  private refreshShadows(state: Readonly<GameSnapshot>, wallTime: number, arenaChanged: boolean) {
    if (!this.renderer.shadowMap.enabled) return;
    let signature = state.bombs.length * 31 + state.thrown.length * 17;
    for (const p of state.players)
      if (p.alive)
        signature += Math.round(p.x * 6) * 3 + Math.round(p.z * 6) * 7 + Math.round(p.elevation * 6);
    for (const z of state.zombies) signature += Math.round(z.x * 6) * 5 + Math.round(z.z * 6) * 11;
    for (const b of state.bombs) signature += Math.round(b.x * 4) * 13 + Math.round(b.z * 4) * 19;
    const zone = state.phase === "playing" ? state.zone : undefined;
    if (zone) {
      signature += zone.closed * 101 + (zone.warningRing ?? 0) * 53;
      // A ring of walls is rising out of the ground: follow it until it has settled.
      if (zone.nextRingAt !== undefined && zone.nextRingAt - state.time < 3)
        signature += Math.floor(state.time * 20);
    }
    const moved = signature !== this.shadowSignature;
    if (!arenaChanged && !(moved && wallTime >= this.nextShadow)) return;
    this.shadowSignature = signature;
    this.renderer.shadowMap.needsUpdate = true;
    this.nextShadow = wallTime + 1 / (this.quality.shadows === "high" ? 20 : 10);
  }
  /** Lowers the pixel ratio while frames run over budget and restores it when they do not. */
  private adaptResolution(wallTime: number) {
    const dt = wallTime - this.lastFrameAt;
    this.lastFrameAt = wallTime;
    if (!this.resolution.sample(dt)) return;
    this.renderer.setPixelRatio(basePixelRatio(this.quality) * this.resolution.scale);
    this.resize();
  }
  /** Adds CPU time spent outside the renderer to the diagnostics panel, under `name`. */
  profile(name: string, ms: number) {
    this.performance.part(name, ms);
  }
  finishFrame() {
    const now = performance.now();
    this.performance.sample(now, now - this.submitStarted);
  }
  /** Hands freshly killed zombies to the ash effect, which owns their bodies from then on. */
  private burnKilledZombies(state: Readonly<GameSnapshot>) {
    for (const e of state.events)
      if (
        e.id > this.lastEvent &&
        e.type === "hit" &&
        e.zombie?.outcome === "killed" &&
        state.time - e.at < ZOMBIE_FALL_DURATION
      ) {
        const body = this.zombies.get(e.zombie.id) as MinecraftAvatar | undefined;
        this.zombies.delete(e.zombie.id);
        this.ashes.start(e.at, world(e.x, state.size), world(e.z, state.size), e.zombie.level, body);
      }
  }
  private syncZombies(state: Readonly<GameSnapshot>) {
    syncEntities(
      this.dynamic,
      state.zombies,
      this.zombies,
      (enemy) => {
        const zombie = this.models.zombie(enemy.level);
        zombie.scale.setScalar(1 + (enemy.level - 1) * 0.12);
        for (let n = 1; n < enemy.level; n++) {
          const band = this.models.ring(
            0.3,
            this.models.materials.glow(enemy.level === 3 ? "#bf85ff" : "#eeb449"),
          );
          band.rotation.x = -Math.PI / 2;
          band.position.y = 1.8 + 0.14 * n;
          band.name = "zombie-rank";
          zombie.add(band);
        }
        return zombie;
      },
      (group, enemy) => {
        const zombie = group as MinecraftAvatar;
        const t =
          enemy.spawnAt === undefined
            ? 1
            : THREE.MathUtils.clamp((state.time - enemy.spawnAt) / SUMMON_TIME, 0, 1);
        const rise = THREE.MathUtils.smoothstep(t, 0.12, 0.96);
        zombie.position.set(world(enemy.x, state.size), 0, world(enemy.z, state.size));
        zombie.rig.visible = t > 0.12;
        zombie.rig.position.y = 0.9 - (1 - rise) * 1.87;
        this.summons.update(zombie, enemy, t);
        for (const part of zombie.children) if (part.name === "zombie-rank") part.visible = rise > 0.88;
        zombie.rotation.y = enemy.yaw;
        poseZombie(zombie, enemy, state.time, rise);
        this.feel.zombie(zombie, enemy, state.time);
      },
    );
  }
  /** Placement ring, placement tiles and throw guide for the local player's held equipment. */
  private updateAim(
    state: Readonly<GameSnapshot>,
    you: Player,
    aim: { firstPerson: boolean; topDown: boolean; previewThrows: boolean; pitch: number; yaw: number },
    mapChanged: boolean,
  ) {
    this.target.visible =
      !aim.topDown &&
      aim.firstPerson &&
      you.alive &&
      state.phase === "playing" &&
      (you.equipped === "bomb" || Boolean(ITEMS[you.equipped]?.throwable));
    this.throwGuide.root.visible = false;
    this.landingPreview = undefined;
    this.placements.update(state, you, this.target.visible && you.equipped === "bomb", mapChanged);
    if (aim.topDown) {
      // The tactical view drops the bomb underfoot; no frame is drawn there, the head marker is enough.
      this.target.visible = false;
    } else if (this.target.visible) {
      const lob = canLob(you.equipped);
      const throwMode = lob ? "lob" : "direct";
      const cell = aimCell(you, aim.yaw, aim.pitch, you.equipped, state.time, throwMode);
      const valid = canPlace(state, you, cell, you.equipped, throwMode);
      if (ITEMS[you.equipped]?.throwable) {
        this.throwGuide.root.visible = aim.previewThrows && (valid || lob);
        if (this.throwGuide.root.visible) {
          this.landingPreview = { ...cell, valid };
          this.throwGuide.update(you, cell, state.size, valid, lob, state.time);
        }
        this.target.visible = false;
      } else {
        this.target.visible = valid;
        this.target.position.set(world(cell.x, state.size), 0.04, world(cell.z, state.size));
      }
    }
  }
  private syncPlayers({ state, mode, localId, wallTime, scanning }: FrameView) {
    for (const p of state.players) {
      this.models.updateCharacter(p, state.time, bombGuideColor(state.players, p.id, localId));
      const avatar = this.avatars.get(p.id)!;
      avatar.visible = p.alive && !(mode === "first-person" && p.id === localId);
      avatar.position.set(
        world(p.x, state.size),
        p.elevation + Math.sin(wallTime * 3 + p.id.length) * 0.025 - this.wading.sink(p.id),
        world(p.z, state.size),
      );
      avatar.rotation.y = p.yaw;
      this.feel.actor(avatar as MinecraftAvatar, p, state.time);
      if (p.invulnerableUntil > state.time && state.phase === "playing")
        avatar.visible &&= Math.sin(wallTime * 30) > -0.25;
      // Optical camo: the owner (and anyone scanning) sees a rippling body, everyone else nothing.
      const cloaked = p.alive && isCloaked(p, state.time);
      const cloak = cloaked ? Math.min(1, ((p.cloakUntil ?? 0) - state.time) / 0.35) : 0;
      (avatar as MinecraftAvatar).setCloak(cloak, state.time);
      if (p.id === localId) this.hand.setCloak(cloak, state.time);
      else if (cloaked && !scanning) avatar.visible = false;
    }
  }
  private syncBombs({ state, localId }: FrameView) {
    syncEntities(
      this.dynamic,
      state.bombs,
      this.bombs,
      (bomb) => {
        // A landed grenade stays a grenade for its short fuse.
        if (bomb.kind) return this.models.item(bomb.kind, false);
        const owner = state.players.find((p) => p.id === bomb.ownerId)!;
        return this.models.explosive(owner.color, bomb.power ?? 70, owner.bombStyle);
      },
      (mesh, bomb) => {
        const slide = bomb.slide;
        const remaining = slide
          ? THREE.MathUtils.clamp((slide.arrivedAt - state.time) / SLIDE_STEP, 0, 1)
          : 0;
        mesh.position.set(
          world(bomb.x - (slide?.x ?? 0) * remaining, state.size),
          0,
          world(bomb.z - (slide?.z ?? 0) * remaining, state.size),
        );
        if (bomb.kind) {
          // It rocks where it fell, faster as the fuse runs out.
          const left = Math.max(0, bomb.detonateAt - state.time);
          mesh.scale.setScalar(0.55);
          mesh.rotation.set(
            0,
            bomb.id * 1.7,
            Math.PI / 2 + Math.sin(state.time * (10 + 26 / (0.25 + left))) * 0.12,
          );
          mesh.position.y = 0.14;
          return;
        }
        const warning = bombWarning(bomb.detonateAt, state.time, !!slide);
        const lamp = mesh.getObjectByName("warning-lamp") as THREE.Mesh;
        lamp.material = this.models.materials.glow(bombGuideColor(state.players, bomb.ownerId, localId));
        lamp.visible = warning.lit;
        lamp.scale.setScalar(1 + 0.38 * warning.progress * (1 - warning.phase));
        if (!slide) {
          const settle = Math.max(0, 1 - (RULES.fuse - (bomb.detonateAt - state.time)) / 0.16);
          mesh.position.y = 0.18 * settle * settle;
          mesh.rotation.z = -0.09 * settle;
        } else mesh.rotation.z = 0;
      },
    );
  }
  private syncThrown(state: Readonly<GameSnapshot>) {
    syncEntities(
      this.dynamic,
      state.thrown,
      this.flights,
      (t) => this.models.item(t.kind, false),
      (mesh, t) => {
        const flight = ITEMS[t.kind].throwable!;
        const progress = THREE.MathUtils.clamp(1 - (t.landsAt - state.time) / flight.flight, 0, 1);
        const p = throwPoint(mesh.position, t.origin, t, progress, t.mode ?? flight.trajectory ?? "direct");
        mesh.position.set(world(p.x, state.size), p.y, world(p.z, state.size));
        mesh.scale.setScalar(0.55);
        mesh.rotation.z = progress * Math.PI * 2;
      },
    );
  }
  /** The Cataclysm's flames: every open cell burns for a moment after the terrain has moved. */
  private sweepFire(state: Readonly<GameSnapshot>): readonly FireCell[] {
    const reset = state.terrainReset;
    if (!reset?.scorch || reset.completedAt === undefined) {
      // The snapshot drops the reset before the last flames are out; let them burn down.
      const sweep = this.sweep;
      if (sweep && state.phase === "playing" && state.time >= sweep.from && state.time < sweep.until)
        return sweep.cells;
      this.sweep = undefined;
      return [];
    }
    if (this.sweep?.id !== reset.id) {
      // The fire rolls outward from whoever called it down, then burns for a moment everywhere.
      const duration = 1.1,
        speed = 16,
        cells: FireCell[] = [],
        origin = state.players.find((p) => p.id === reset.ownerId) ?? {
          x: state.size / 2,
          z: state.size / 2,
        };
      state.tiles.forEach((row, z) =>
        row.forEach((tile, x) => {
          if (tile === 0)
            cells.push({
              x,
              z,
              id: z * state.size + x + 1,
              ownerId: reset.ownerId,
              damage: 0,
              duration,
              expiresAt: reset.completedAt! + Math.hypot(x - origin.x, z - origin.z) / speed + duration,
            });
        }),
      );
      this.sweep = {
        id: reset.id,
        cells,
        from: reset.completedAt,
        until: Math.max(...cells.map((cell) => cell.expiresAt), reset.completedAt),
      };
    }
    return this.sweep.cells;
  }
  private syncItems({ state, wallTime }: FrameView) {
    syncEntities(
      this.dynamic,
      state.items,
      this.items,
      (item) => this.models.item(item.kind),
      (mesh, item) => {
        mesh.position.set(
          world(item.x, state.size),
          Math.sin(wallTime * 2.5 + item.id) * 0.045 + 0.055,
          world(item.z, state.size),
        );
        mesh.rotation.y = wallTime * 0.6;
        if (ITEMS[item.kind].pool === "elite")
          mesh.getObjectByName("core-halo")?.scale.setScalar(1 + 0.11 * Math.sin(3.4 * wallTime));
      },
    );
  }
  /**
   * Startup load: everything any match or lobby choice can need (all skins, finishes, pickups,
   * zombies, obstacles and map backdrops), so later screens only rebuild geometry.
   */
  async prepareAll(state: Readonly<GameSnapshot>, maps: readonly MapDefinition[], progress: LoadProgress) {
    const stop = this.assets.watch(progress);
    try {
      for (const map of maps) this.preview?.backdrop.preload(map);
      await Promise.all([this.models.preload(state.players, true), this.models.preloadCatalog()]);
      if (this.seed !== state.seed || this.mapId !== state.mapId) this.rebuild(state);
      this.groundFire.warm(this.renderer);
      await this.assets.ready();
      await this.warmUp(state);
    } finally {
      stop();
    }
  }
  async prepare(state: Readonly<GameSnapshot>, includeDrops: boolean, progress: LoadProgress) {
    const stop = this.assets.watch(progress);
    try {
      await this.models.preload(state.players, includeDrops);
      if (this.seed !== state.seed || this.mapId !== state.mapId) this.rebuild(state);
      await this.assets.ready();
      await this.warmUp(state);
    } finally {
      stop();
    }
  }
  /**
   * Pays for shader compilation and texture upload behind the loading screen. Anything that
   * first appears mid-match (zombies, pickups, charges, effects) is added once as a stand-in,
   * compiled without blocking, drawn for real into a small buffer and then left hidden in the
   * scene, where it keeps those programs from being freed between uses.
   */
  private async warmUp(state: Readonly<GameSnapshot>) {
    const { renderer, scene } = this;
    const camera = this.rig.camera;
    const group = new THREE.Group();
    group.name = "stand-ins";
    group.add(
      ...this.models.warmObjects(state.players),
      ...this.overlays.warmObjects(),
      ...this.zoneWalls.warmObjects(),
      ...this.blastEffect.warmObjects(),
      ...this.strikes.warmObjects(),
      ...this.shields.warmObjects(),
      ...this.ashes.warmObjects(),
      ...this.summons.warmObjects(),
      ...this.placements.warmObjects(),
    );
    // Models and skins attach from promises that have already settled; let those run.
    await new Promise((resolve) => setTimeout(resolve));
    if (this.disposed) return disposeStandIns(group);
    group.traverse((object) => {
      object.frustumCulled = false;
    });
    // Hidden objects are still compiled; they only have to show for the one draw below.
    group.visible = false;
    scene.add(group);
    const retired = this.standIns;
    this.standIns = group;

    // Program variants depend on where the frame goes: bind what the post pipeline binds.
    const offscreen = <T>(work: () => T): T => {
      const toneMapping = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(this.warmTarget);
      try {
        return work();
      } finally {
        renderer.setRenderTarget(null);
        renderer.toneMapping = toneMapping;
      }
    };
    try {
      // Never let a driver that fails to report a program as linked hold the loading screen.
      await Promise.race([
        offscreen(() => renderer.compileAsync(scene, camera)),
        new Promise((resolve) => setTimeout(resolve, 15_000)),
      ]);
    } catch (error) {
      console.warn("Shader warm-up failed", error);
    }
    if (this.disposed) return;
    // One real draw: uploads geometry and textures, and compiles the shadow-pass variants.
    group.visible = true;
    offscreen(() => {
      renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
      renderer.clear();
      renderer.render(scene, camera);
    });
    group.visible = false;
    uploadTextures(renderer, texturesUnder(scene));
    if (retired) disposeStandIns(retired);
    // The stand-ins are in the shadow map now; redraw it without them on the next frame.
    this.shadowSignature = NaN;
    this.nextShadow = 0;
    renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
    // These draw straight to the canvas after the post pipeline, from scenes of their own.
    this.nightVision.warm(renderer, camera);
    this.offerFire.warm(renderer);
    this.upgradeFx.warm(renderer);
  }
  attachPreview(surface: HTMLElement) {
    this.preview = new LobbyPreview(this.models, surface, this.assets.manager);
  }
  selectLobbyMap(map: MapDefinition) {
    this.preview?.backdrop.select(map);
  }
  dressPreview(appearance: Appearance) {
    this.preview?.dress(appearance).catch(console.error);
  }
  renderPreview(time: number) {
    this.preview?.render(this.renderer, time);
  }
  promotion(time: number, banner: HTMLElement, cards: HTMLElement[]) {
    this.upgradeFx.start(time, banner, cards);
  }
  drawRewardEffects(time: number, fireStrength: number, rewardGold: boolean) {
    if (fireStrength > 0)
      this.offerFire.draw(this.renderer, time, this.quality.scale, fireStrength, rewardGold);
    this.upgradeFx.draw(this.renderer, time);
  }
  async drawPortrait(canvas: HTMLElement, skin: string, seat: number) {
    const look = await this.models.localSkin(skin);
    if (this.disposed || !canvas.isConnected || canvas.dataset.skin !== skin) return;
    this.portraits ??= new PlayerPortraits(this.renderer.getPixelRatio());
    this.portraits.set(canvas, look, seat);
  }
  renderRoom(time: number) {
    const start = performance.now();
    const renderer = this.portraits?.draw(time);
    if (renderer) {
      const now = performance.now();
      this.performance.sample(now, now - start, renderer);
    }
  }
  previewSkin(preset: Player["skin"]) {
    return this.models.previewSkin(preset);
  }
  importSkin(file: File | undefined, model: SkinModel) {
    return this.models.importSkin(file, model);
  }
  setAnimationLoop(callback: (time: number) => void) {
    this.renderer.setAnimationLoop(callback);
  }
  dispose() {
    this.disposed = true;
    this.feel.dispose();
    this.portraits?.dispose();
    this.summons.dispose();
    this.nightVision.dispose();
    this.upgradeFx.dispose();
    this.offerFire.dispose();
    this.preview?.dispose();
    this.performance.dispose();
    this.observer.disconnect();
    this.renderer.setAnimationLoop(null);
    this.arena?.dispose();
    this.weather.dispose();
    this.wading.dispose();
    this.environment.dispose();
    for (const zombie of this.zombies.values()) (zombie as MinecraftAvatar).dispose();
    this.vapor.dispose();
    this.groundFire.dispose();
    this.blastEffect.dispose();
    this.strikes.dispose();
    this.target.geometry.dispose();
    this.throwGuide.dispose();
    this.placements.dispose();
    this.shields.dispose();
    this.ashes.dispose();
    this.target.material.dispose();
    this.models.dispose();
    this.overlays.dispose();
    this.zoneWalls.dispose();
    if (this.standIns) disposeStandIns(this.standIns);
    this.warmTarget.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}
