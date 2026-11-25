import { t } from "../i18n";
import { SceneAssets, type LoadProgress } from "./scene-assets";
import { BlastEffect } from "./blast-effect";
import { LobbyPreview } from "./lobby-preview";
import { OperatorPortraits } from "./operator-portraits";
import { SUMMON_TIME } from "../core/zombies";
import { poseZombie } from "./zombie-motion";
import { SummonEffects } from "./summon-effect";
import { NightVision } from "./night-vision";
import { UpgradeEffects } from "./upgrade-effects";
import { OfferFire } from "./offer-fire";
import type { Appearance } from "../core/room";
import type { MapDefinition } from "../core/pack-api";
import * as THREE from "three";
import { ExplosiveLights } from "./explosive-lights";
import { PerformancePanel } from "./performance-panel";
import { readGraphics, type GraphicsSettings } from "./graphics-settings";
import { DangerOverlays } from "./danger-overlays";
import { DEFAULT_SMOKE } from "../core/equipment";
import { aimCell, canLob, canPlace } from "../core/placement";
import { throwPoint } from "../core/throw-path";
import { ThrowGuide } from "./throw-guide";
import { PlacementTiles } from "./placement-tiles";
import { ShieldField } from "./shield-field";
import { ZombieAsh, ZOMBIE_FALL_DURATION } from "./zombie-ash";
import { MinecraftAvatar } from "./minecraft-avatar";
import { bombGuideColor, bombWarning, OWN_CHARGE_COLOR } from "../core/bomb-warning";
import { SLIDE_STEP } from "../core/geometry";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FilmShader } from "three/addons/shaders/FilmShader.js";
import { OutdoorLighting } from "./outdoor-lighting";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ITEMS, RULES } from "../core/content";
import type { GameSnapshot } from "../core/types";
import { inTacticalView } from "../core/types";
import { Arena, TILE_SIZE, world } from "./arena";
import { Models } from "./models";
import type { SkinModel } from "./minecraft-skins";

export type CameraMode = "lobby" | "first-person" | "spectator";
export class GameRenderer {
  landingPreview?: {x:number; z:number; valid:boolean};
  private preview?: LobbyPreview;
  private portraits?: OperatorPortraits;
  private disposed = false;
  private performance: PerformancePanel;
  private submitStarted = 0;
  private explosiveLights: ExplosiveLights;
  private nextShadow = 0;
  private overlays!: DangerOverlays;
  private composer!: EffectComposer;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(67, 1, 0.04, 220);
  private boardCamera = new THREE.OrthographicCamera(-1,1,1,-1,.04,220);
  private assets = new SceneAssets();
  private models = new Models(this.assets.manager);
  private arena?: Arena;
  private actors = new Map<string, THREE.Group>();
  private zombies = new Map<number, THREE.Group>();
  private summons = new SummonEffects();
  private upgradeFx = new UpgradeEffects();
  private throwGuide = new ThrowGuide();
  private placements = new PlacementTiles();
  private shields = new ShieldField(this.assets.manager);
  private ashes = new ZombieAsh();
  private target = new THREE.Mesh(new THREE.RingGeometry(.76,.84,4,1,Math.PI/4),
    new THREE.MeshBasicMaterial({color: OWN_CHARGE_COLOR, transparent: true, opacity: .92, depthWrite: false}));
  private nightVision = new NightVision(this.assets.manager);
  private bombs = new Map<number, THREE.Group>();
  private items = new Map<number, THREE.Group>();
  private blastEffect = new BlastEffect(this.assets.manager);
  private dynamic = new THREE.Group();
  private held = new THREE.Group();
  private hand: MinecraftAvatar;
  private flights = new Map<number,THREE.Group>();
  private clouds = new Map<number,THREE.Group>();
  private smokeMaterial = new THREE.SpriteMaterial({
    map:new THREE.TextureLoader(this.assets.manager).load("./assets/smoke-cloud.png"),
    color:0x929899,depthWrite:false,transparent:true,opacity:.84
  });
  private offerFire = new OfferFire(this.smokeMaterial.map!);
  private seed = -1;
  private mapId = "";
  private observer: ResizeObserver;
  private environment: OutdoorLighting;
  private ambientOcclusion!: SSAOPass;
  private film = new ShaderPass(FilmShader);
  private quality = readGraphics();
  private previousPlayer = new THREE.Vector2();
  private travel = 0;
  private hitUntil = 0;
  private dimensionBlend = 0;
  private lastCameraTime = 0;
  private lastEvent = 0;
  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.info.autoReset = false;
    this.performance = new PerformancePanel(this.renderer, container);
    this.canvas = this.renderer.domElement;
    this.canvas.id = "world";
    this.canvas.setAttribute("aria-label", t("3D 爆破战场"));
    this.canvas.tabIndex = 0;
    container.prepend(this.canvas);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75) * this.quality.scale);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.overlays = new DangerOverlays(this.dynamic,this.assets.manager);
    this.explosiveLights = new ExplosiveLights(this.scene);
    this.environment = new OutdoorLighting(this.renderer, this.scene,this.assets.manager);
    this.scene.add(this.dynamic, this.camera, this.target, this.throwGuide.root, this.blastEffect.root);
    this.scene.add(this.placements.root,this.shields.root,this.ashes.root);
    this.target.rotation.x = -Math.PI/2;
    this.target.renderOrder = 5;
    this.camera.add(this.held);
    this.hand = this.models.firstPersonArm();
    this.hand.hold(this.models.explosive(), "bomb");
    this.held.add(this.hand);
    this.composer = new EffectComposer(this.renderer);
    // SSAOPass blends occlusion into the color buffer produced by RenderPass.
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ambientOcclusion = new SSAOPass(this.scene, this.camera, 512, 512, 8);
    this.ambientOcclusion.kernelRadius = 0.7;
    this.ambientOcclusion.minDistance = 0.002;
    this.ambientOcclusion.maxDistance = 0.08;
    this.composer.addPass(this.ambientOcclusion);
    this.film.uniforms.intensity.value = 0.035;
    this.composer.addPass(this.film);
    this.composer.addPass(new OutputPass());
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.setGraphics(this.quality);
    this.resize();
  }
  get graphics() { return {...this.quality}; }
  setGraphics(settings: GraphicsSettings) {
    this.quality = {...settings};
    const ratio = Math.min(devicePixelRatio,1.75) * settings.scale;
    if (ratio !== this.renderer.getPixelRatio()) {
      this.renderer.setPixelRatio(ratio);
      this.composer.setPixelRatio(ratio);
    }
    this.environment.shadowResolution(settings.shadows === "high" ? 2048 : settings.shadows === "medium" ? 1024 : 0);
    this.renderer.shadowMap.enabled = settings.shadows !== "off";
    this.renderer.shadowMap.needsUpdate = true;
    this.nextShadow = 0;
    this.film.enabled = settings.grain;
    this.portraits?.setResolution(ratio);
  }
  private resize() {
    const w = this.canvas.parentElement!.clientWidth,
      h = this.canvas.parentElement!.clientHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private rebuild(state: Readonly<GameSnapshot>, terrainOnly = false) {
    if (this.arena) {
      this.scene.remove(this.arena.root);
      this.arena.dispose();
    }
    this.nextShadow = 0;
    this.overlays.clear();
    this.ashes.clear();
    this.blastEffect.clear();
    this.arena = new Arena(this.models, state);
    this.scene.add(this.arena.root);
    this.seed = state.seed;
    this.mapId = state.mapId;
    this.travel = 0;
    if (terrainOnly) return;
    this.models.clearAnimations();
    for (const zombie of this.zombies.values()) (zombie as MinecraftAvatar).dispose();
    this.zombies.clear();
    this.dynamic.clear();

    this.actors.clear();
    this.bombs.clear();
    this.flights.clear();
    this.clouds.clear();
    this.items.clear();
    for (const p of state.players) {
      const actor = this.models.character(p);
      this.actors.set(p.id, actor);
      this.dynamic.add(actor);
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
    aiming = false,
  ) {
    if (showBackdrop && this.preview) {
      this.renderer.info.reset();
      this.submitStarted = performance.now();
      if (this.preview.backdrop.draw(this.renderer,wallTime,menuBeat)) return;
    }
    if (this.seed !== state.seed || this.mapId !== state.mapId)
      this.rebuild(state,this.mapId === state.mapId && state.mode === "practice" && state.phase === "playing");
    const mapChanged = this.arena!.sync(state);
    this.overlays.sync(state, mapChanged, localId);
    const you = state.players.find(p => p.id === localId)!;
    const topDown = mode === "first-person" && you.alive && inTacticalView(you,state.time);
    const scanning = mode === "first-person" && you.alive && you.scanUntil > state.time;
    this.shields.update(state);
    for (const e of state.events) if (e.id>this.lastEvent && e.zombieId!==undefined &&
        e.zombieOutcome!=="hurt" && state.time-e.at<ZOMBIE_FALL_DURATION) {
      const body=this.zombies.get(e.zombieId) as MinecraftAvatar | undefined;
      this.zombies.delete(e.zombieId);
      this.ashes.start(e.at,world(e.x,state.size),world(e.z,state.size),e.zombieLevel ?? 1,body);
    }
    this.ashes.update(state.time);
    this.syncEntities(state.zombies, this.zombies, enemy => {
      const zombie = this.models.zombie();
      zombie.scale.setScalar(1 + (enemy.level-1)*.12);
      for (let n=1; n<enemy.level; n++) {
        const band = this.models.ring(.30, this.models.materials.glow(enemy.level===3 ? "#bf85ff" : "#eeb449"));
        band.rotation.x = -Math.PI/2;
        band.position.y = 1.80 + .14*n;
        band.name = "zombie-rank";
        zombie.add(band);
      }
      return zombie;
    }, (group, enemy) => {
      const zombie = group as MinecraftAvatar;
      const t = enemy.spawnAt === undefined ? 1 : THREE.MathUtils.clamp((state.time-enemy.spawnAt)/SUMMON_TIME,0,1);
      const rise = THREE.MathUtils.smoothstep(t,.12,.96);
      zombie.position.set(world(enemy.x,state.size), 0, world(enemy.z,state.size));
      zombie.rig.visible = t > .12;
      zombie.rig.position.y = .9 - (1-rise)*1.87;
      this.summons.update(zombie,enemy,t);
      for (const part of zombie.children) if (part.name === "zombie-rank") part.visible = rise > .88;
      zombie.rotation.y = enemy.yaw;
      poseZombie(zombie,enemy,state.time,rise);
    });
    this.target.visible = !topDown && mode === "first-person" && you.alive && state.phase === "playing" &&
      (you.equipped === "bomb" || Boolean(ITEMS[you.equipped]?.throwable));
    this.throwGuide.root.visible = false;
    this.landingPreview = undefined;
    this.placements.update(state,you,this.target.visible && you.equipped==="bomb",mapChanged);
    if (topDown) {
      const cell = {x: Math.round(you.x), z: Math.round(you.z)};
      this.target.visible = canPlace(state,you,cell);
      this.target.position.set(world(cell.x,state.size), .04, world(cell.z,state.size));
    } else if (this.target.visible) {
      const lob = aiming && canLob(you.equipped);
      const throwMode = lob ? "lob" : "direct";
      const cell = aimCell(you, lookYaw ?? you.yaw, pitch,you.equipped,state.time,throwMode);
      const valid = canPlace(state,you,cell,you.equipped,throwMode);
      if (ITEMS[you.equipped]?.throwable) {
        this.throwGuide.root.visible = valid || lob;
        if (this.throwGuide.root.visible) {
          this.landingPreview = {...cell,valid};
          this.throwGuide.update(you,cell,state.size,valid,lob,state.time);
        }
        this.target.visible = false;
      } else {
        this.target.visible = valid;
        this.target.position.set(world(cell.x,state.size), .04, world(cell.z,state.size));
      }
    }
    for (const p of state.players) {
      this.models.updateCharacter(p, state.time,bombGuideColor(state.players,p.id,localId));
      const actor = this.actors.get(p.id)!;
      actor.visible = p.alive && !(mode === "first-person" && p.id === localId);
      actor.position.set(
        world(p.x, state.size),
        p.elevation + Math.sin(wallTime * 3 + p.id.length) * 0.025,
        world(p.z, state.size),
      );
      actor.rotation.y = p.yaw;
      if (p.invulnerableUntil > state.time && state.phase === "playing")
        actor.visible &&= Math.sin(wallTime * 30) > -0.25;
    }
    this.syncEntities(
      state.bombs,
      this.bombs,
      (bomb) => {
        const owner = state.players.find((p) => p.id === bomb.ownerId)!;
        return this.models.explosive(owner.color, bomb.power ?? 70, owner.bombStyle);
      },
      (mesh, bomb) => {
        const slide = bomb.slide;
        const remaining = slide ? THREE.MathUtils.clamp((slide.arrivedAt - state.time) / SLIDE_STEP, 0, 1) : 0;
        mesh.position.set(
          world(bomb.x - (slide?.x ?? 0) * remaining, state.size),
          0,
          world(bomb.z - (slide?.z ?? 0) * remaining, state.size),
        );
        const warning = bombWarning(bomb.detonateAt, state.time,!!slide);
        const lamp = mesh.getObjectByName("warning-lamp") as THREE.Mesh;
        lamp.material = this.models.materials.glow(bombGuideColor(state.players,bomb.ownerId,localId));
        lamp.visible = warning.lit;
        lamp.scale.setScalar(1 + .38 * warning.progress * (1 - warning.phase));
        if (!slide) {
          const settle = Math.max(0, 1 - (RULES.fuse - (bomb.detonateAt - state.time)) / .16);
          mesh.position.y = .18 * settle * settle;
          mesh.rotation.z = -.09 * settle;
        } else mesh.rotation.z = 0;
      },
    );
    this.syncEntities(state.thrown,this.flights,t=>this.models.item(t.kind,false),(mesh,t)=>{
      const flight = ITEMS[t.kind].throwable!;
      const progress=THREE.MathUtils.clamp(1-(t.landsAt-state.time)/flight.flight,0,1);
      const p = throwPoint(mesh.position,t.origin,t,progress,t.mode ?? flight.trajectory ?? "direct");
      mesh.position.set(world(p.x,state.size),p.y,world(p.z,state.size));
      mesh.scale.setScalar(.55);
      mesh.rotation.z=progress*Math.PI*2;
    });
    this.syncEntities(state.smoke,this.clouds,c=>{
      const group=new THREE.Group();
      for (let i=0;i<9;i++) {
        const puff=new THREE.Sprite(this.smokeMaterial);
        const angle=c.id+i*2.4, radius=Math.sqrt(i/8)*2.6;
        puff.position.set(Math.cos(angle)*radius,.8+i%3*.65,Math.sin(angle)*radius);
        puff.scale.set(5.2,4.2,1);
        group.add(puff);
      }
      return group;
    },(mesh,c)=>{
      const left=c.expiresAt-state.time;
      mesh.position.set(world(c.x,state.size),0,world(c.z,state.size));
      mesh.rotation.y=state.time*.16;
      mesh.scale.setScalar(Math.max(.02,Math.min(1,((c.duration ?? DEFAULT_SMOKE.duration)-left)*4,left*2)));
    });
    this.syncEntities(
      state.items,
      this.items,
      (item) => this.models.item(item.kind),
      (mesh, item) => {
        mesh.position.set(
          world(item.x, state.size),
          Math.sin(wallTime * 2.5 + item.id) * .045 + .055,
          world(item.z, state.size),
        );
        mesh.rotation.y = wallTime * 0.6;
        if (ITEMS[item.kind].pool === "elite")
          mesh.getObjectByName("core-halo")?.scale.setScalar(1+.11*Math.sin(3.4*wallTime));
      },
    );
    this.explosiveLights.update(state, you);
    this.models.equipAvatar(this.hand,you,OWN_CHARGE_COLOR);
    if (mode === "first-person") {
      const moved = this.previousPlayer.distanceTo(
        new THREE.Vector2(you.x, you.z),
      );
      this.travel += Math.min(moved, 0.1);
      this.previousPlayer.set(you.x, you.z);
      const bob = moved > 0.0001 && you.verticalSpeed === 0 ? Math.sin(this.travel * 5.5) * 0.006 : 0;
      this.camera.position.set(
        world(you.x, state.size),
        1.55 + you.elevation + bob,
        world(you.z, state.size),
      );
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.set(pitch, lookYaw ?? you.yaw, 0);
      this.held.visible = you.alive;
      const swing = this.models.swingAmount(you,state.time);
      this.held.position.set(Math.min(0,(this.camera.aspect-1)*.34)-swing*.21, bob*.5+swing*.06,-swing*.13);
      this.held.rotation.z = Math.sin(this.travel * 2.75) * .004 - swing*.47;
      for (const event of state.events)
        if (
          event.id > this.lastEvent &&
          event.type === "hurt" && !event.blocked &&
          event.playerId === localId
        )
          this.hitUntil = wallTime + 0.6;
      const trauma = Math.max(0, this.hitUntil - wallTime) / 0.6;
      this.camera.position.x += Math.sin(wallTime * 73) * trauma * 0.12;
      this.camera.position.y += Math.cos(wallTime * 91) * trauma * 0.075;
      this.camera.rotation.z = Math.sin(wallTime * 48) * trauma * 0.045;
      this.camera.fov = 67 + trauma * 5;
    } else {
      this.held.visible = false;
      const angle =
        mode === "lobby"
          ? 0.62 + Math.sin(wallTime * 0.035) * 0.1
          : wallTime * 0.035;
      const radius = state.size * (2.35 - menuBeat * .016);
      const offset = this.camera.aspect > 1.3 && mode === "lobby" ? -6 : 0;
      this.camera.position.set(
        Math.sin(angle) * radius + offset + Math.sin(wallTime*29)*menuBeat*.05,
        state.size * 2.0 + Math.cos(wallTime*24)*menuBeat*.035,
        Math.cos(angle) * radius,
      );
      this.camera.lookAt(offset, -0.6, 0);
      this.camera.fov = mode === "lobby" ? 53 : 58;
    }
    this.lastEvent = Math.max(this.lastEvent, ...state.events.map((e) => e.id));
    this.camera.updateProjectionMatrix();
    const delta = this.lastCameraTime
      ? Math.min(0.1, wallTime - this.lastCameraTime)
      : 0.016;
    this.lastCameraTime = wallTime;

    this.dimensionBlend +=
      ((topDown ? 1 : 0) - this.dimensionBlend) * (1 - Math.exp(-delta * 24));
    if (Math.abs(this.dimensionBlend - (topDown ? 1 : 0)) < 0.001)
      this.dimensionBlend = topDown ? 1 : 0;
    if (mode === "first-person" && this.dimensionBlend > 0) {
      const t = this.dimensionBlend;
      const board = this.boardCamera;
      const half = (state.size * TILE_SIZE / 2 + 2) / Math.min(1,this.camera.aspect);
      board.left = -half * this.camera.aspect;
      board.right = -board.left;
      board.top = half;
      board.bottom = -half;
      board.position.set(0, state.size * TILE_SIZE, state.size * TILE_SIZE * .31);
      board.lookAt(0,0,0);
      board.updateProjectionMatrix();
      this.camera.position.lerp(board.position,t);
      this.camera.quaternion.slerp(board.quaternion,t);
      // Match clip-space weights at board center during the perspective-to-ortho blend.
      const projectionBlend = t / (t + (1 - t) / board.position.length());
      for (let i = 0; i < 16; i++)
        this.camera.projectionMatrix.elements[i] +=
          (board.projectionMatrix.elements[i] -
            this.camera.projectionMatrix.elements[i]) *
          projectionBlend;
      this.camera.projectionMatrixInverse
        .copy(this.camera.projectionMatrix)
        .invert();
      this.actors.get(localId)!.visible = t > 0.35;
      this.held.visible = t < 0.2;
    }
    this.blastEffect.update(state, this.camera);
    this.renderer.info.reset();
    this.submitStarted = performance.now();
    this.ambientOcclusion.enabled = this.quality.occlusion && this.dimensionBlend < 0.02;
    if (this.renderer.shadowMap.enabled && (wallTime >= this.nextShadow || mapChanged)) {
      this.renderer.shadowMap.needsUpdate = true;
      this.nextShadow = wallTime + 1 / (this.quality.shadows === "high" ? 30 : 15);
    }
    this.composer.render();
    if (scanning) {
      const players = state.players.filter(p => p.id !== localId && p.alive).map(p => this.actors.get(p.id)!);
      this.nightVision.draw(this.renderer,this.camera,[...players,...this.zombies.values()],state.time);
    }
  }
  finishFrame() {
    const now = performance.now();
    this.performance.sample(now, now - this.submitStarted);
  }
  private syncEntities<T extends { id: number }>(
    entities: T[],
    cache: Map<number, THREE.Group>,
    create: (entity: T) => THREE.Group,
    update: (mesh: THREE.Group, entity: T) => void,
  ) {
    const ids = new Set(entities.map((e) => e.id));
    for (const [id, mesh] of cache)
      if (!ids.has(id)) {
        this.dynamic.remove(mesh);
        if (mesh instanceof MinecraftAvatar) mesh.dispose();
        cache.delete(id);
      }
    for (const entity of entities) {
      let mesh = cache.get(entity.id);
      if (!mesh) {
        mesh = create(entity);
        cache.set(entity.id, mesh);
        this.dynamic.add(mesh);
      }
      update(mesh, entity);
    }
  }
  async prepare(state: Readonly<GameSnapshot>, includeDrops: boolean, progress: LoadProgress) {
    const stop = this.assets.watch(progress);
    try {
      await this.models.preload(state.players,includeDrops);
      if (this.seed !== state.seed || this.mapId !== state.mapId) this.rebuild(state);
      await this.assets.ready();
    } finally {
      stop();
    }
  }
  attachPreview(surface:HTMLElement) { this.preview=new LobbyPreview(this.models,surface,this.assets.manager); }
  selectLobbyMap(map: MapDefinition) { this.preview?.backdrop.select(map); }
  dressPreview(appearance:Appearance) { this.preview?.dress(appearance).catch(console.error); }
  renderPreview(time:number) { this.preview?.render(this.renderer,time); }
  promotion(time: number, banner: HTMLElement, cards: HTMLElement[]) { this.upgradeFx.start(time,banner,cards); }
  drawRewardEffects(time: number, fireStrength: number, rewardGold:boolean) {
    if (fireStrength > 0) this.offerFire.draw(this.renderer,time,this.quality.scale,fireStrength,rewardGold);
    this.upgradeFx.draw(this.renderer,time);
  }
  async drawPortrait(canvas: HTMLElement, skin: string, seat: number) {
    const look = await this.models.localSkin(skin);
    if (this.disposed || !canvas.isConnected || canvas.dataset.skin !== skin) return;
    this.portraits ??= new OperatorPortraits(this.renderer.getPixelRatio());
    this.portraits.set(canvas, look, seat);
  }
  renderRoom(time: number) {
    const start = performance.now();
    const renderer = this.portraits?.draw(time);
    if (renderer) {
      const now = performance.now();
      this.performance.sample(now,now-start,renderer);
    }
  }
  previewSkin(preset: import("../core/types").Player["skin"]) { return this.models.previewSkin(preset); }
  importSkin(file: File | undefined, model: SkinModel) {
    return this.models.importSkin(file, model);
  }
  setAnimationLoop(callback: (time: number) => void) {
    this.renderer.setAnimationLoop(callback);
  }
  dispose() {
    this.disposed = true;
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
    this.environment.dispose();
    for (const zombie of this.zombies.values()) (zombie as MinecraftAvatar).dispose();
    this.smokeMaterial.map?.dispose();
    this.smokeMaterial.dispose();
    this.blastEffect.dispose();
    this.target.geometry.dispose();
    this.throwGuide.dispose();
    this.placements.dispose(); this.shields.dispose(); this.ashes.dispose();
    this.target.material.dispose();
    this.models.dispose();
    this.overlays.dispose();
    this.ambientOcclusion.dispose();
    this.film.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
