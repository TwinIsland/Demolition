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
import { MaterialLibrary } from "./materials";
import { BombFinishes } from "./bomb-finishes";
import { CoverModels } from "./cover-models";
import type { Obstacle } from "../core/obstacles";

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
  }
  async preload(players: readonly Player[], includeDrops: boolean) {
    for (const p of players)
      this.finishes.get("Wrap", BOMB_STYLES[p.bombStyle ?? "standard"] ?? DEFAULT_FINISH, 0, p.color);
    await Promise.all([
      this.chargeAsset,
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
    await Promise.all(Object.keys(SKINS).map((id) => this.skins.get("", id)));
  }
  private hand?: MinecraftAvatar;
  equipAvatar(avatar: MinecraftAvatar, p: Player, signalColor: string) {
    if (
      avatar.userData.equipped === p.equipped &&
      avatar.userData.power === p.attack &&
      avatar.userData.finish === p.bombStyle &&
      avatar.userData.signalColor === signalColor
    )
      return;
    Object.assign(avatar.userData, {
      equipped: p.equipped,
      power: p.attack,
      finish: p.bombStyle,
      signalColor,
    });
    if (p.equipped === "bomb")
      avatar.hold(this.explosive(p.color, p.attack, p.bombStyle, signalColor), "bomb");
    else avatar.hold(this.item(p.equipped, false), ITEMS[p.equipped]?.melee ? "melee" : "item");
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
  wall(midnight: boolean) {
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
  ) {
    const tier = powerTier(power);
    const group = new THREE.Group();
    const finish = BOMB_STYLES[style] ?? DEFAULT_FINISH;
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
    const lamp = this.sphere(0.037, this.materials.glow(signalColor));
    lamp.position.set(0.324, 1.167, 0);
    lamp.name = "warning-lamp";
    group.add(lamp);
    group.scale.setScalar(1 + tier * 0.07);
    return group;
  }
  private pickupAssets = new Map<ItemId, Promise<THREE.Group>>();
  item(kind: ItemId, ground = true) {
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
    void this.pickupAsset(kind)
      .then((model) => g.add(model.clone()))
      .catch(console.error);
    return g;
  }
  private pickupAsset(kind: ItemId) {
    let asset = this.pickupAssets.get(kind);
    if (!asset) {
      asset = new GLTFLoader(this.manager)
        .loadAsync(ITEMS[kind].model ?? "./assets/pickups/capacity.glb")
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
          });
          return holder;
        });
      this.pickupAssets.set(kind, asset);
    }
    return asset;
  }
  dispose() {
    this.clearAnimations();
    for (const asset of this.pickupAssets.values())
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
