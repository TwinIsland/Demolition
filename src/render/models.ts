import * as THREE from "three";
import { powerTier } from "../core/combat";
import { OWN_BOMB_COLOR } from "../core/bomb-warning";
import { BOMB_STYLES, DEFAULT_FINISH, SKINS, type BombStyle } from "../core/room";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MinecraftAvatar } from "./minecraft-avatar";
import { MinecraftSkins, type SkinModel } from "./minecraft-skins";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ItemId, Player } from "../core/types";
import { ITEMS } from "../core/content";
import { KNIFE_STYLES } from "../core/knife-styles";
import { MaterialLibrary } from "./materials";
import { BombFinishes } from "./bomb-finishes";
import { CoverModels, type SceneryId } from "./cover-models";
import type { BombFinish, MapDefinition } from "../core/pack-api";
import type { Obstacle } from "../core/obstacles";
import { TILE_SIZE } from "../core/geometry";
import { crownGeometry, palmFronds, palmTrunk, ruinWall, trunkGeometry } from "./jungle-flora";

/** Longest side of a modelled bomb finish, matching the height of the standard charge. */
/** A modelled finish stands a little taller and wider than the body of the standard charge, at most. */
const CHARGE_HEIGHT = 1.15;
const CHARGE_WIDTH = 0.72;
/** Pack models are replaced in place, so their URL carries the build stamp past the browser cache. */
const fresh = (url: string) =>
  /^(data|blob):/.test(url) ? url : url + (url.includes("?") ? "&" : "?") + "v=" + __ASSET_STAMP__;
/** Height of the ceiling of a tiled hall above the deck. */
export const POOL_CEILING = 5.7;
/** Height of the suspended ceiling of an office floor. Its walls reach it. */
export const BACKROOMS_CEILING = 2.9;

export class Models {
  private avatars = new Map<string, MinecraftAvatar>();
  private healthBars = new Map<
    string,
    { sprite: THREE.Sprite; texture: THREE.CanvasTexture; fraction: number }
  >();
  private skins: MinecraftSkins;
  readonly materials: MaterialLibrary;
  private chargeAsset: ReturnType<GLTFLoader["loadAsync"]>;
  private finishes: BombFinishes;
  private covers: CoverModels;
  constructor(private manager = THREE.DefaultLoadingManager) {
    this.skins = new MinecraftSkins(manager);
    this.materials = new MaterialLibrary(manager);
    this.chargeAsset = new GLTFLoader(manager).loadAsync("./assets/dynamite.glb");
    this.finishes = new BombFinishes(manager);
    this.covers = new CoverModels(manager, this.materials);
    // Request the rainforest's own surfaces now, so they load with everything else at startup.
    this.wall("rainforest");
    this.jungleTree(0, "far", true);
    this.jungleTree(0, "near", false);
    this.palm();
    this.slab("rainforest", 0);
    this.materials.grass();
    this.materials.soil(new THREE.DataTexture(new Uint8Array(4), 1, 1), [0, 0, 1, 1]);
    // The same for the tiled hall.
    this.wall("poolrooms", "pillar");
    this.poolSlab();
    this.materials.standard("pool-floor", "#a9c3c8", "ceramic", "pool-mosaic");
  }
  async preload(players: readonly Player[], includeDrops: boolean) {
    for (const p of players)
      this.finishes.get("Wrap", BOMB_STYLES[p.bombStyle ?? "standard"] ?? DEFAULT_FINISH, 0, p.color);
    await Promise.all([
      this.chargeAsset,
      ...players.map((p) => this.finishModel(BOMB_STYLES[p.bombStyle ?? ""])),
      ...players.map((p) => this.pickupAsset("knife", p.knifeStyle)),
      this.covers.ready,
      ...players.map((p) => this.skins.get(p.id, p.skin)),
      // Zombie skins and crate emblems appear mid-match, so they load up front as well.
      ...[1, 2, 3].map((tier) => this.skins.zombie(tier)),
      ...players.map((p) => (this.emblemOf(p), this.materials.emblemsReady())),
      ...(includeDrops ? Object.keys(ITEMS).map((id) => this.pickupAsset(id)) : []),
    ]);
  }
  /** Loads every selectable skin and bomb finish, so changing loadout in the lobby never fetches. */
  async preloadCatalog() {
    for (const finish of Object.values(BOMB_STYLES))
      for (const tier of [0, 1, 2]) this.finishes.get("Wrap", finish, tier, "#ffffff");
    await Promise.all([
      ...Object.keys(SKINS).map((id) => this.skins.get("", id)),
      ...Object.values(BOMB_STYLES).map((finish) => this.finishModel(finish)),
      ...Object.keys(KNIFE_STYLES).map((id) => this.pickupAsset("knife", id)),
    ]);
  }
  private hand?: MinecraftAvatar;
  equipAvatar(avatar: MinecraftAvatar, p: Player, signalColor: string) {
    if (
      avatar.userData.equipped === p.equipped &&
      avatar.userData.power === p.attack &&
      avatar.userData.finish === p.bombStyle &&
      avatar.userData.knife === p.knifeStyle &&
      avatar.userData.signalColor === signalColor
    )
      return;
    Object.assign(avatar.userData, {
      equipped: p.equipped,
      power: p.attack,
      finish: p.bombStyle,
      knife: p.knifeStyle,
      signalColor,
    });
    if (p.equipped === "bomb")
      avatar.hold(this.explosive(p.color, p.attack, p.bombStyle, signalColor, true), "bomb");
    else avatar.hold(this.item(p.equipped, false, p.knifeStyle), ITEMS[p.equipped]?.melee ? "melee" : "item");
  }
  swingAmount(player: Player, time: number) {
    const melee = ITEMS[player.equipped]?.melee;
    const until = player.cooldowns["equipment:" + player.equipped];
    if (!melee || !until || until <= time) return 0;
    const t = Math.max(0, 1 - (until - time) / melee.cooldown);
    const strike = 0.14;
    if (t < strike) return 1 - 0.83 * (1 - t / strike) ** 2;
    const recovery = (t - strike) / (1 - strike);
    return 1 - recovery * recovery * (3 - 2 * recovery);
  }
  clearAnimations() {
    this.avatars.forEach((a) => a.dispose());
    this.avatars.clear();
    for (const { sprite, texture } of this.healthBars.values()) {
      sprite.material.dispose();
      texture.dispose();
    }
    this.healthBars.clear();
  }
  updateCharacter(player: Player, time: number, signalColor: string) {
    const bar = this.healthBars.get(player.id);
    const fraction = player.hp / player.maxHp;
    if (bar && bar.fraction !== fraction) {
      const ctx = (bar.texture.image as HTMLCanvasElement).getContext("2d")!;
      ctx.fillStyle = "#17201d";
      ctx.fillRect(0, 0, 96, 10);
      ctx.fillStyle = player.color;
      ctx.fillRect(2, 2, 92 * fraction, 6);
      bar.texture.needsUpdate = true;
      bar.fraction = fraction;
    }
    const avatar = this.avatars.get(player.id);
    if (avatar) {
      this.equipAvatar(avatar, player, signalColor);
      avatar.motion.update(avatar.rig, player.x, player.z, time, player.verticalSpeed);
      if (ITEMS[player.equipped]?.melee) {
        const swing = this.swingAmount(player, time);
        avatar.rig.skin.rightArm.rotation.set(-0.72 - 0.94 * swing, 0.12 + 0.42 * swing, -0.1 - 0.22 * swing);
      }
    }
  }
  localSkin(preset: Player["skin"]) {
    return this.skins.get("you", preset);
  }
  private previewRevision = 0;
  async previewSkin(preset: Player["skin"]) {
    const revision = ++this.previewRevision;
    const skin = await this.skins.get("you", preset);
    if (revision === this.previewRevision) {
      this.avatars.get("you")?.setSkin(skin);
      this.hand?.setSkin(skin);
    }
  }
  async importSkin(file: File | undefined, model: SkinModel) {
    if (await this.skins.import(file, model)) {
      const skin = await this.skins.get("you");
      this.avatars.get("you")?.setSkin(skin);
      this.hand?.setSkin(skin);
    }
  }
  /**
   * A zombie of the given level. All levels share one family of skins; level 2
   * straps on a shoulder plate and level 3 adds spiked plates and back spines.
   */
  zombie(level = 1) {
    const avatar = new MinecraftAvatar();
    const tier = Math.min(3, Math.max(1, Math.round(level)));
    void this.skins
      .zombie(tier)
      .then(([skin, glow]) => {
        avatar.setSkin(skin);
        avatar.setGlow(glow, [1.8, 2.2, 3][tier - 1]);
      })
      .catch((error) => console.error("Zombie skin failed to load", error));
    if (tier === 1) return avatar;
    // Sizes are in skin pixels: an arm is 4 wide and hangs from y = 2 at the shoulder.
    const plate = this.materials.palette("df:steel-dark")!;
    const rusty = this.materials.palette("df:steel")!;
    const geometry = (key: string, create: () => THREE.BufferGeometry) => {
      if (!this.geometries.has(key)) this.geometries.set(key, create());
      return this.geometries.get(key)!;
    };
    const pauldron = geometry("zombie-pauldron", () => new RoundedBoxGeometry(5.2, 2.6, 5.2, 1, 0.5));
    const spike = geometry("zombie-spike", () => new THREE.ConeGeometry(0.75, 3, 5));
    const attach = (shape: THREE.BufferGeometry, material: THREE.Material) => {
      const part = this.mesh(shape, material);
      part.userData.shared = true;
      return part;
    };
    const skin = avatar.rig.skin;
    for (const [arm, side] of [
      [skin.leftArm, 1],
      [skin.rightArm, -1],
    ] as const) {
      if (tier === 2 && side === -1) continue;
      const shoulder = attach(pauldron, tier === 3 ? plate : rusty);
      shoulder.position.set(side, 1.1, 0);
      arm.add(shoulder);
      if (tier < 3) continue;
      for (const z of [-1.5, 1.5]) {
        const point = attach(spike, rusty);
        point.position.set(side * 1.6, 3.5, z);
        point.rotation.z = -side * 0.35;
        arm.add(point);
      }
    }
    if (tier === 3)
      for (const [y, length] of [
        [4.4, 1.2],
        [1.2, 1],
        [-2, 0.8],
      ] as const) {
        const spine = attach(spike, rusty);
        spine.position.set(0, y, -2.4 - length);
        spine.rotation.x = -Math.PI / 2 - 0.35;
        spine.scale.setScalar(length);
        skin.body.add(spine);
      }
    return avatar;
  }
  /**
   * One of everything that first appears mid-match: each zombie level, every pickup, and each
   * player's charges and crate. See `gpu-warmup.ts` for why these stay in the scene, hidden.
   */
  warmObjects(players: readonly Player[]): THREE.Object3D[] {
    const zombies = [1, 2, 3].map((level) => {
      const zombie = this.zombie(level);
      zombie.userData.disposeStandIn = () => zombie.dispose();
      return zombie;
    });
    const charges = players.flatMap((p) =>
      [70, 85, 130].map((power) => this.explosive(p.color, power, p.bombStyle)),
    );
    return [
      ...zombies,
      ...Object.keys(ITEMS).map((kind) => this.item(kind)),
      ...charges,
      ...players.map((p) => this.builtCrate(p)),
    ];
  }
  firstPersonArm() {
    const avatar = new MinecraftAvatar();
    this.hand = avatar;
    const skin = avatar.rig.skin;
    for (const part of [skin.head, skin.body, skin.leftArm, skin.leftLeg, skin.rightLeg])
      part.visible = false;
    skin.rightArm.rotation.set(-1.04, 0.12, -0.09);
    avatar.position.set(-0.07, -1.68, -0.46);

    return avatar;
  }
  private geometries = new Map<string, THREE.BufferGeometry>();
  box(w: number, h: number, d: number, material: THREE.Material, radius = 0.08) {
    const key = `box:${w}:${h}:${d}:${radius}`;
    if (!this.geometries.has(key))
      this.geometries.set(key, new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, 0.025)));
    return this.mesh(this.geometries.get(key)!, material);
  }
  sphere(radius: number, material: THREE.Material) {
    const key = `sphere:${radius}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new THREE.SphereGeometry(radius, 24, 16));
    return this.mesh(this.geometries.get(key)!, material);
  }
  ring(radius: number, material: THREE.Material, thickness = 0.04) {
    const key = `ring:${radius}:${thickness}`;
    if (!this.geometries.has(key))
      this.geometries.set(key, new THREE.TorusGeometry(radius, thickness, 8, 40));
    return this.mesh(this.geometries.get(key)!, material);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  /** A destructible obstacle; an empty group stands in when its model failed to load. */
  obstacle(obstacle: Obstacle) {
    return this.covers.instance(obstacle) ?? new THREE.Group();
  }
  /** The emblem material for a player: their character's mark inside a ring of their colour. */
  private emblemOf(owner: Pick<Player, "skin" | "color"> | undefined) {
    const skin = owner?.skin && owner.skin !== "custom" ? SKINS[owner.skin] : undefined;
    return this.materials.emblem(skin?.emblem ?? "./assets/emblems/default.svg", owner?.color ?? "#ece6d4");
  }
  /**
   * A crate built by `owner`, marked on four sides and the lid with the emblem
   * of the owner's character. Panel positions match the `built-crate` model.
   */
  builtCrate(owner: Pick<Player, "skin" | "color"> | undefined) {
    const crate = this.obstacle(this.covers.builtCrate);
    const scale = crate.children[0]?.scale.x ?? 1;
    const material = this.emblemOf(owner);
    if (!this.geometries.has("emblem")) this.geometries.set("emblem", new THREE.PlaneGeometry(1, 1));
    const geometry = this.geometries.get("emblem")!;
    for (let side = 0; side < 5; side++) {
      const decal = new THREE.Mesh(geometry, material);
      decal.receiveShadow = true;
      decal.renderOrder = 1;
      if (side === 4) {
        decal.scale.setScalar(0.8 * scale);
        decal.rotation.x = -Math.PI / 2;
        decal.position.y = 1.808 * scale;
      } else {
        const angle = (side * Math.PI) / 2;
        decal.scale.setScalar(0.98 * scale);
        decal.rotation.y = angle;
        decal.position.set(Math.sin(angle) * 0.968 * scale, 0.91 * scale, Math.cos(angle) * 0.968 * scale);
      }
      crate.add(decal);
    }
    return crate;
  }
  /** Scenery placed by a map theme: wall variants and what stands outside the grid. */
  scenery(id: SceneryId) {
    return this.covers.scenery(id);
  }
  /** One floor slab. Natural maps only pave where the map asks for stone. */
  slab(theme: MapDefinition["theme"], shade: number) {
    const material =
      theme === "rainforest"
        ? this.materials.standard("floor", shade ? "#d6cdb3" : "#e6dcc0", "ceramic", "ruin-stone")
        : this.materials.standard("floor", shade ? "#b1b3ae" : "#bdbdb5", "ceramic");
    return this.box(2.37, 0.18, 2.37, material, 0.03);
  }
  /** White glazed tile, or the same tile in the hall's accent colour. */
  poolTile(accent = false) {
    return this.materials.standard("pool-tile", accent ? "#3fa9b0" : "#b4c1c2", "ceramic", "pool-tile");
  }
  /** The deck of one cell of a tiled hall. Cells without one show the pool lining and its water. */
  poolSlab() {
    // Full cell width and square edges: the tiling carries on across cells without a joint.
    return this.box(
      TILE_SIZE,
      0.18,
      TILE_SIZE,
      this.materials.standard("pool-deck", "#7f9195", "ceramic", "pool-tile"),
      0.003,
    );
  }
  /** Worn loop-pile carpet, laid as one sheet under the whole floor. */
  backroomsCarpet() {
    return this.materials.standard("backrooms-carpet", "#ffffff", "ceramic", "backrooms-carpet");
  }
  /** Mineral-fibre tiles in a metal grid. */
  backroomsCeiling() {
    return this.materials.standard("backrooms-ceiling", "#d9d2bb", "ceramic", "backrooms-ceiling");
  }
  /**
   * A permanent wall. The rainforest also has `tree` and `rock` variants; its plain block is
   * ruined masonry, which is what the closing zone raises. A tiled hall has `pillar`, a column
   * that carries the ceiling.
   */
  wall(
    theme: MapDefinition["theme"],
    variant: "block" | "broken" | "tree" | "rock" | "pillar" = "block",
    /** Picks one of a variant's looks. The same seed always gives the same wall. */
    seed = 0,
  ) {
    if (theme === "poolrooms") {
      const g = new THREE.Group(),
        height = variant === "pillar" ? POOL_CEILING : 2.5;
      // The body starts below the deck, so a wall standing in a pool reaches the lining.
      const body = this.box(TILE_SIZE, height + 0.2, TILE_SIZE, this.poolTile(), 0.003);
      body.position.y = height / 2 - 0.1;
      // One course of coloured tile at head height, standing a finger proud of the wall.
      const band = this.box(TILE_SIZE + 0.03, 0.3, TILE_SIZE + 0.03, this.poolTile(true), 0.003);
      band.position.y = 1.95;
      // White walls on a white deck are hard to tell apart from overhead, so the top is coloured.
      const cap = this.box(TILE_SIZE, 0.04, TILE_SIZE, this.poolTile(true), 0.003);
      cap.position.y = height + 0.02;
      g.add(body, band, cap);
      return g;
    }
    if (theme === "backrooms") {
      const g = new THREE.Group(),
        height = BACKROOMS_CEILING;
      // Papered from the carpet to the ceiling; the pattern runs on across neighbouring blocks.
      const body = this.box(
        TILE_SIZE,
        height + 0.1,
        TILE_SIZE,
        this.materials.standard("backrooms-wall", "#ffffff", "ceramic", "backrooms-wall"),
        0.003,
      );
      body.position.y = height / 2 - 0.05;
      const skirting = this.box(
        TILE_SIZE + 0.03,
        0.13,
        TILE_SIZE + 0.03,
        this.materials.standard("backrooms-trim", "#4b3a20"),
        0.003,
      );
      skirting.position.y = 0.065;
      // Seen from overhead a wall is only its top, so that is pale against the dark carpet.
      const cap = this.box(
        TILE_SIZE,
        0.04,
        TILE_SIZE,
        this.materials.standard("backrooms-cap", "#cfc49a"),
        0.003,
      );
      cap.position.y = height + 0.02;
      g.add(body, skirting, cap);
      return g;
    }
    if (theme === "rainforest") return this.jungleWall(variant, seed);
    const midnight = theme === "midnight";
    const g = new THREE.Group(),
      color = midnight ? "#a3a8a6" : "#bcb8ab";
    const body = this.box(2.28, 2.38, 2.28, this.materials.standard("enamel", color, "ceramic"), 0.13);
    body.position.y = 1.19;
    g.add(body);
    const cap = this.box(
      2.3,
      0.17,
      2.3,
      this.materials.standard("wall-cap", midnight ? "#9b9e9b" : "#b4b0a5", "ceramic"),
    );
    cap.position.y = 2.4;
    g.add(cap);
    const base = this.box(2.31, 0.15, 2.31, this.materials.standard("wall-base", "#444a48", "metal"));
    base.position.y = 0.12;
    g.add(base);
    return g;
  }
  /** A plant or rock from the scans, stood at `x`, `z` of its parent. */
  private flora(id: SceneryId, x: number, y: number, z: number, scale: number, turn: number) {
    const model = this.scenery(id);
    model.position.set(x, y, z);
    model.rotation.y = turn;
    model.scale.setScalar(scale);
    return model;
  }
  /** Plain geometry with a shared material, without the cache key `box` and its kin need. */
  private part(geometry: THREE.BufferGeometry, material: THREE.Material, shadows = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = shadows;
    return mesh;
  }
  /**
   * A rainforest tree: trunk, limbs and lianas, and a crown of leaf cards starting at `height`.
   * `overhead` trees keep their crown in the overhead views; they belong outside the grid.
   * The others lose it there and are cut off at wall height, so the board stays in sight.
   */
  jungleTree(variant: number, detail: "near" | "far", overhead: boolean) {
    const g = new THREE.Group(),
      height = [9.2, 10.6, 8.4][variant % 3],
      girth = [0.4, 0.46, 0.36][variant % 3],
      spread = [6, 6.8, 5.4][variant % 3];
    g.add(
      this.part(trunkGeometry(variant, height, girth, detail), this.materials.palette("df:jungle-trunk")!),
    );
    const crown = this.part(
      crownGeometry(variant, height, spread, detail === "near" ? 72 : 26),
      this.materials.palette(overhead ? "df:jungle-crown" : "df:jungle-canopy")!,
    );
    // The crown shades the ground but not itself: lit from every side, it reads as translucent.
    crown.receiveShadow = false;
    g.add(crown);
    return g;
  }
  palm() {
    const g = new THREE.Group(),
      height = 6.4;
    g.add(this.part(palmTrunk(height), this.materials.palette("df:jungle-trunk")!, false));
    const fronds = this.part(palmFronds(height), this.materials.palette("df:fern")!, false);
    fronds.position.set(0.9, 0, 0.2);
    g.add(fronds);
    return g;
  }
  /** A work lamp on a short post: the head glows and blooms; the light it throws is painted. */
  workLamp() {
    const g = new THREE.Group(),
      dark = this.materials.palette("df:paint-graphite")!;
    const post = this.box(0.06, 0.4, 0.06, dark, 0.01);
    post.position.y = 0.2;
    const head = this.box(0.42, 0.26, 0.12, dark, 0.02);
    head.position.set(0, 0.5, 0);
    const lens = this.box(0.36, 0.2, 0.02, this.materials.lamp("#ffc98a", 3.2), 0.004);
    lens.position.set(0, 0.5, 0.07);
    lens.castShadow = false;
    g.add(post, head, lens);
    return g;
  }
  /**
   * A permanent wall of the rainforest. Trees and rocks fill their cell at the foot; the plain
   * block is ruined masonry, which is also what the closing zone raises.
   */
  private jungleWall(variant: "block" | "broken" | "tree" | "rock" | "pillar", seed: number) {
    const g = new THREE.Group(),
      pick = (salt: number) => ((Math.imul(seed + salt * 7919, 2654435761) >>> 0) % 1000) / 1000;
    if (variant === "tree") {
      g.add(this.jungleTree(seed % 3, "near", false));
      // Undergrowth between the buttress roots.
      const plants = ["fern-a", "fern-b", "calathea-a", "anthurium-b"] as const;
      for (let i = 0; i < 2; i++) {
        const angle = pick(i) * 6.28,
          reach = 0.75 + pick(i + 10) * 0.3;
        g.add(
          this.flora(
            plants[Math.floor(pick(i + 20) * plants.length)],
            Math.cos(angle) * reach,
            0,
            Math.sin(angle) * reach,
            1.3 + pick(i + 30) * 0.8,
            pick(i + 40) * 6.28,
          ),
        );
      }
      return g;
    }
    if (variant === "rock") {
      // One big scanned rock stretched to wall height, with a smaller one leaning on it.
      const rocks = ["rock-a", "rock-b", "rock-c", "rock-d"] as const;
      const main = this.scenery(rocks[seed % 4]);
      const bounds = new THREE.Box3().setFromObject(main),
        size = bounds.getSize(new THREE.Vector3());
      main.scale.set((TILE_SIZE * 0.98) / size.x, 2.5 / size.y, (TILE_SIZE * 0.98) / size.z);
      g.add(main);
      g.add(this.flora(rocks[(seed + 1) % 4], 0.55, 2.0, -0.2, 0.42, pick(1) * 6.28));
      g.add(this.flora("fern-a", -0.3, 2.35, 0.3, 1.5, pick(2) * 6.28));
      g.add(this.flora("fern-c", 0.9, 0, 0.95, 1.8, pick(3) * 6.28));
      return g;
    }
    const { stone, moss } = ruinWall(seed % 3, variant === "broken");
    g.add(
      this.part(stone, this.materials.standard("enamel", "#e4dfd0", "ceramic", "ruin-stone")),
      this.part(moss, this.materials.palette("df:moss")!),
    );
    // Something has taken root on most of them.
    if (seed > 0 && pick(1) < 0.6)
      g.add(
        this.flora(
          pick(2) < 0.5 ? "fern-b" : "shrub-a",
          (pick(3) - 0.5) * 1.2,
          variant === "broken" ? 0.84 : 2.46,
          (pick(4) - 0.5) * 1.2,
          pick(2) < 0.5 ? 1.3 : 2.6,
          pick(5) * 6.28,
        ),
      );
    return g;
  }
  character(player: Player) {
    const avatar = new MinecraftAvatar();
    this.avatars.set(player.id, avatar);
    if (player.bot) {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 10;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          toneMapped: false,
          depthWrite: false,
        }),
      );
      sprite.position.y = 2.26;
      sprite.scale.set(1.02, 0.11, 1);
      avatar.add(sprite);
      this.healthBars.set(player.id, { sprite, texture, fraction: -1 });
    }
    this.skins
      .get(player.id, player.skin)
      .then((skin) => {
        if (this.avatars.get(player.id) === avatar) {
          avatar.setSkin(skin);
          if (!player.bot) this.hand?.setSkin(skin);
        }
      })
      .catch((error) => console.error("Skin loading failed", error));
    return avatar;
  }
  explosive(
    color = "#f07066",
    power = 70,
    style: BombStyle = "standard",
    signalColor: string = OWN_BOMB_COLOR,
    /** In a hand rather than on the floor: a modelled finish hides its warning lamp. */
    held = false,
  ) {
    const tier = powerTier(power);
    const group = new THREE.Group();
    const finish = BOMB_STYLES[style] ?? DEFAULT_FINISH;
    const lamp = this.sphere(0.037, this.materials.glow(signalColor));
    lamp.position.set(0.324, 1.167, 0);
    lamp.name = "warning-lamp";
    group.add(lamp);
    group.scale.setScalar(1 + tier * 0.07);
    const custom = this.finishModel(finish);
    if (custom) {
      lamp.visible = !held;
      custom
        .then((asset) => {
          const model = asset.clone();
          const { length, height, depth } = asset.userData as Record<"length" | "height" | "depth", number>;
          // The GLB lies along X. Stand it on end, like the standard charge, centred on its cell.
          model.rotation.z = Math.PI / 2;
          model.position.set(height / 2, length / 2, 0);
          // The standard charge sits to one side of its origin, outside the fist. A held model follows it.
          if (held) model.position.set(-0.22, length / 2, depth * 0.3);
          lamp.position.set(0, length + 0.05, 0);
          group.add(model);
        })
        .catch((error) => console.error("Cannot load bomb finish model", error));
      return group;
    }
    this.chargeAsset
      .then((gltf) => {
        const model = gltf.scene.clone(true);
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.material = this.finishes.get(o.material.name, finish, tier, color);
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        group.add(model);
      })
      .catch((error) => console.error("Cannot load explosive model", error));
    return group;
  }
  private finishModels = new Map<string, Promise<THREE.Group>>();
  /** The GLB of a modelled bomb finish, scaled to the standard charge's body. */
  private finishModel(finish: BombFinish | undefined) {
    if (!finish?.model) return undefined;
    let asset = this.finishModels.get(finish.id);
    if (!asset) {
      asset = new GLTFLoader(this.manager).loadAsync(fresh(finish.model)).then(({ scene }) => {
        const bounds = new THREE.Box3().setFromObject(scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = Math.min(CHARGE_HEIGHT / size.x, CHARGE_WIDTH / Math.max(size.y, size.z));
        const holder = new THREE.Group();
        holder.add(scene);
        holder.scale.setScalar(scale);
        holder.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          o.castShadow = true;
          o.receiveShadow = true;
          if (finish.glow && o.material instanceof THREE.MeshStandardMaterial) {
            o.material.emissive.set(finish.glow.color);
            o.material.emissiveMap = o.material.map;
            o.material.emissiveIntensity = finish.glow.intensity;
          }
        });
        // One more level, so that a clone can be turned without losing the centring above.
        const root = new THREE.Group();
        root.add(holder);
        root.userData = { length: size.x * scale, height: size.y * scale, depth: size.z * scale };
        return root;
      });
      this.finishModels.set(finish.id, asset);
    }
    return asset;
  }
  private pickupAssets = new Map<string, Promise<THREE.Group>>();
  /** `style` picks a cosmetic model for a melee weapon; other items ignore it. */
  item(kind: ItemId, ground = true, style?: string) {
    const g = new THREE.Group();
    const base = this.ring(0.55, this.materials.glow(ITEMS[kind].color), 0.025);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.06;
    if (ground) {
      g.scale.setScalar(0.74);
      g.add(base);
    }
    if (ITEMS[kind].pool === "elite") {
      const halo = this.ring(0.61, this.materials.glow(ITEMS[kind].color), 0.014);
      halo.rotation.x = -Math.PI / 2;
      halo.name = "core-halo";
      halo.position.y = 0.1;
      g.add(halo);
    }
    void this.pickupAsset(kind, style)
      .then((model) => g.add(model.clone()))
      .catch(console.error);
    return g;
  }
  private pickupAsset(kind: ItemId, style?: string) {
    const cosmetic = ITEMS[kind]?.melee ? KNIFE_STYLES[style ?? ""] : undefined;
    const key = cosmetic?.model ? `${kind}:${cosmetic.id}` : kind;
    let asset = this.pickupAssets.get(key);
    if (!asset) {
      asset = new GLTFLoader(this.manager)
        .loadAsync(fresh(cosmetic?.model ?? ITEMS[kind].model ?? "./assets/pickups/capacity.glb"))
        .then(({ scene }) => {
          const bounds = new THREE.Box3().setFromObject(scene);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          // Longest side in world units. A model may carry its own size as the glTF scene extra `displaySize`.
          const scale =
            (typeof scene.userData.displaySize === "number" ? scene.userData.displaySize : 1.18) /
            Math.max(size.x, size.y, size.z);
          const holder = new THREE.Group();
          holder.add(scene);
          holder.scale.setScalar(scale);
          holder.position.set(-center.x * scale, 0.24 - bounds.min.y * scale, -center.z * scale);
          this.materials.applyPalette(scene);
          scene.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            o.castShadow = true;
            o.receiveShadow = true;
            // The lit parts of the texture glow: the map doubles as the emissive mask.
            if (cosmetic?.glow && o.material instanceof THREE.MeshStandardMaterial) {
              o.material.emissive.set(cosmetic.glow);
              o.material.emissiveMap = o.material.map;
              o.material.emissiveIntensity = 0.55;
            }
          });
          return holder;
        });
      this.pickupAssets.set(key, asset);
    }
    return asset;
  }
  dispose() {
    this.clearAnimations();
    for (const asset of [...this.pickupAssets.values(), ...this.finishModels.values()])
      void asset
        .then((root) => {
          const materials = new Set<THREE.Material>();
          const textures = new Set<THREE.Texture>();
          root.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            o.geometry.dispose();
            for (const m of Array.isArray(o.material) ? o.material : [o.material])
              if (!this.materials.palette(m.name)) materials.add(m);
          });
          for (const m of materials) {
            for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
            m.dispose();
          }
          textures.forEach((t) => t.dispose());
        })
        .catch(() => {});
    this.pickupAssets.clear();
    this.finishModels.clear();
    this.hand?.dispose();
    this.skins.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.finishes.dispose();
    this.covers.dispose();
    void this.chargeAsset
      .then(({ scene }) =>
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        }),
      )
      .catch(() => {});
    this.materials.dispose();
  }
}
