import * as THREE from "three";
import { powerTier } from "../core/combat";
import { OWN_CHARGE_COLOR } from "../core/bomb-warning";
import { BOMB_STYLES, DEFAULT_FINISH, type BombStyle } from "../core/room";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MinecraftAvatar } from "./minecraft-avatar";
import { MinecraftSkins, type SkinModel } from "./minecraft-skins";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ItemId, Player } from "../core/types";
import { ITEMS } from "../core/content";
import { MaterialLibrary } from "./materials";
import { ChargeFinishes } from "./charge-finishes";
import { CoverModels } from "./cover-models";
import type { MapCover } from "../core/pack-api";

export class Models {
  private avatars = new Map<string, MinecraftAvatar>();
  private healthBars = new Map<string, { sprite: THREE.Sprite; texture: THREE.CanvasTexture; fraction: number }>();
  private skins: MinecraftSkins;
  readonly materials: MaterialLibrary;
  private chargeAsset: ReturnType<GLTFLoader["loadAsync"]>;
  private finishes: ChargeFinishes;
  private covers: CoverModels;
  constructor(private manager = THREE.DefaultLoadingManager) {
    this.skins = new MinecraftSkins(manager);
    this.materials = new MaterialLibrary(manager);
    this.chargeAsset = new GLTFLoader(manager).loadAsync("./assets/dynamite.glb");
    this.finishes = new ChargeFinishes(manager);
    this.covers = new CoverModels(manager);
  }
  async preload(players: readonly Player[], includeDrops: boolean) {
    for (const p of players) this.finishes.get("Wrap", BOMB_STYLES[p.bombStyle ?? "standard"] ?? DEFAULT_FINISH, 0, p.color);
    await Promise.all([
      this.chargeAsset,
      this.covers.ready,
      ...players.map(p => this.skins.get(p.id,p.skin)),
      ...(includeDrops ? Object.keys(ITEMS).map(id => this.pickupAsset(id)) : []),
    ]);
  }
  private hand?: MinecraftAvatar;
  equipAvatar(avatar:MinecraftAvatar, p:Player, signalColor:string) {
    if (avatar.userData.equipped === p.equipped && avatar.userData.power === p.attack &&
        avatar.userData.finish === p.bombStyle && avatar.userData.signalColor === signalColor) return;
    Object.assign(avatar.userData,{equipped:p.equipped,power:p.attack,finish:p.bombStyle,signalColor});
    if (p.equipped === "bomb") avatar.hold(this.explosive(p.color,p.attack,p.bombStyle,signalColor),"bomb");
    else avatar.hold(this.item(p.equipped,false),ITEMS[p.equipped]?.melee ? "melee" : "item");
  }
  swingAmount(player:Player,time:number) {
    const melee = ITEMS[player.equipped]?.melee;
    const until = player.cooldowns["equipment:"+player.equipped];
    if (!melee || !until || until <= time) return 0;
    const t = Math.max(0,1-(until-time)/melee.cooldown);
    const strike = .14;
    if (t < strike) return 1 - .83 * (1-t/strike)**2;
    const recovery = (t-strike)/(1-strike);
    return 1 - recovery*recovery*(3-2*recovery);
  }
  clearAnimations() {
    this.avatars.forEach((a) => a.dispose());
    this.avatars.clear();
    for (const {sprite, texture} of this.healthBars.values()) {
      sprite.material.dispose();
      texture.dispose();
    }
    this.healthBars.clear();
  }
  updateCharacter(player: Player, time: number, signalColor:string) {
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
      this.equipAvatar(avatar,player,signalColor);
      avatar.motion.update(avatar.rig,player.x,player.z,time,player.verticalSpeed);
      if (ITEMS[player.equipped]?.melee) {
        const swing = this.swingAmount(player,time);
        avatar.rig.skin.rightArm.rotation.set(-.72-.94*swing,.12+.42*swing,-.1-.22*swing);
      }
    }
  }
  localSkin(preset: Player["skin"]) { return this.skins.get("you",preset); }
  private previewRevision = 0;
  async previewSkin(preset: Player["skin"]) {
    const revision = ++this.previewRevision;
    const skin = await this.skins.get("you",preset);
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
  zombie() {
    const avatar = new MinecraftAvatar();
    this.skins.get("mint").then(skin => avatar.setSkin(skin));
    avatar.rig.skin.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const mat of Array.isArray(object.material) ? object.material : [object.material])
        if (mat.color) mat.color.set("#79af53");
    });
    return avatar;
  }
  firstPersonArm() {
    const avatar = new MinecraftAvatar();
    this.hand = avatar;
    const skin = avatar.rig.skin;
    for (const part of [
      skin.head,
      skin.body,
      skin.leftArm,
      skin.leftLeg,
      skin.rightLeg,
    ])
      part.visible = false;
    skin.rightArm.rotation.set(-1.04, .12, -.09);
    avatar.position.set(-.07, -1.68, -.46);

    return avatar;
  }
  private geometries = new Map<string, THREE.BufferGeometry>();
  box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    radius = 0.08,
  ) {
    const key = `box:${w}:${h}:${d}:${radius}`;
    if (!this.geometries.has(key))
      this.geometries.set(
        key,
        new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, 0.025)),
      );
    return this.mesh(this.geometries.get(key)!, material);
  }
  sphere(radius: number, material: THREE.Material) {
    const key = `sphere:${radius}`;
    if (!this.geometries.has(key))
      this.geometries.set(key, new THREE.SphereGeometry(radius, 24, 16));
    return this.mesh(this.geometries.get(key)!, material);
  }
  ring(radius: number, material: THREE.Material, thickness = 0.04) {
    const key = `ring:${radius}:${thickness}`;
    if (!this.geometries.has(key))
      this.geometries.set(
        key,
        new THREE.TorusGeometry(radius, thickness, 8, 40),
      );
    return this.mesh(this.geometries.get(key)!, material);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  fieldCover(entry: MapCover) {
    const kind = "kind" in entry ? entry.kind : JSON.stringify([entry.model,entry.height ?? 2]);
    if (kind === "crate" || kind === "pallet") return this.crate();
    if (kind !== "bags" && kind !== "low-bags" && kind !== "drum") return this.covers.instance(kind) ?? this.crate();
    const group = new THREE.Group();
    if (kind === "bags" || kind === "low-bags") {
      const canvas = this.materials.standard("sandbag", "#978a61", "wood");
      for (let row = 0; row < 3; row++) {
        for (const side of [-1, 1]) {
          const bag = this.box(1.02, .52, 1.95, canvas);
          bag.position.set(side * .5, .26 + row * .5, 0);
          if (row % 2) { bag.rotation.y = Math.PI / 2; bag.position.set(0, .26 + row * .5, side * .5); }
          group.add(bag);
        }
      }
    } else {
      const metal = this.materials.standard("drum", "#854637", "metal");
      const rim = this.materials.standard("drum-rim", "#4e504a", "metal");
      for (const [radius, height, y, material] of [[.91, 1.76, .88, metal], [.94,.07,.48,rim], [.94,.07,1.26,rim]] as const) {
        const key = `drum:${radius}:${height}`;
        if (!this.geometries.has(key)) this.geometries.set(key, new THREE.CylinderGeometry(radius,radius,height,16));
        const part = this.mesh(this.geometries.get(key)!, material);
        part.position.y = y;
        group.add(part);
      }
    }
    return group;
  }
  crate() {
    const g = new THREE.Group(),
      wood = this.materials.standard("maple", "#b5a58d", "wood"),
      edge = this.materials.standard("wood-edge", "#c7b99f", "wood");
    const body = this.box(2.04, 1.86, 2.04, wood);
    body.position.y = 0.94;
    g.add(body);
    for (const y of [0.18, 1.72]) {
      const rim = this.box(2.14, 0.16, 2.14, edge, 0.035);
      rim.position.y = y;
      g.add(rim);
    }
    for (const x of [-0.94, 0.94])
      for (const z of [-0.94, 0.94]) {
        const bar = this.box(0.15, 1.75, 0.15, edge, 0.03);
        bar.position.set(x, 0.95, z);
        g.add(bar);
        const bolt = this.sphere(
          0.07,
          this.materials.standard("bolts", "#6d6288", "metal"),
        );
        bolt.position.set(x, 1.77, z * 1.08);
        g.add(bolt);
      }
    const stamp = this.ring(
      0.27,
      this.materials.standard("crate-stamp", "#775e78"),
      0.035,
    );
    stamp.position.set(0, 1, 1.03);
    g.add(stamp);
    return g;
  }
  wall(midnight: boolean) {
    const g = new THREE.Group(),
      color = midnight ? "#a3a8a6" : "#bcb8ab";
    const body = this.box(
      2.28,
      2.38,
      2.28,
      this.materials.standard("enamel", color, "ceramic"),
      0.13,
    );
    body.position.y = 1.19;
    g.add(body);
    const cap = this.box(
      2.3,
      0.17,
      2.3,
      this.materials.standard(
        "wall-cap",
        midnight ? "#9b9e9b" : "#b4b0a5",
        "ceramic",
      ),
    );
    cap.position.y = 2.4;
    g.add(cap);
    const base = this.box(
      2.31,
      0.15,
      2.31,
      this.materials.standard("wall-base", "#444a48", "metal"),
    );
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
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, toneMapped: false, depthWrite: false }));
      sprite.position.y = 2.26;
      sprite.scale.set(1.02, .11, 1);
      avatar.add(sprite);
      this.healthBars.set(player.id, {sprite, texture, fraction: -1});
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
  explosive(color = "#f07066", power = 70, style: BombStyle = "standard", signalColor:string = OWN_CHARGE_COLOR) {
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
    lamp.position.set(.324, 1.167, 0);
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
      g.scale.setScalar(.74);
      g.add(base);
    }
    if (ITEMS[kind].pool === "elite") {
      const halo = this.ring(.61,this.materials.glow(ITEMS[kind].color),.014);
      halo.rotation.x = -Math.PI/2;
      halo.name = "core-halo";
      halo.position.y = .10;
      g.add(halo);
    }
    void this.pickupAsset(kind).then(model => g.add(model.clone())).catch(console.error);
    return g;
  }
  private pickupAsset(kind: ItemId) {
    let asset = this.pickupAssets.get(kind);
    if (!asset) {
      asset = new GLTFLoader(this.manager).loadAsync(ITEMS[kind].model ?? "./assets/pickups/capacity.glb").then(({scene}) => {
        const bounds = new THREE.Box3().setFromObject(scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 1.18 / Math.max(size.x,size.y,size.z);
        const holder = new THREE.Group();
        holder.add(scene);
        holder.scale.setScalar(scale);
        holder.position.set(-center.x*scale,.24-bounds.min.y*scale,-center.z*scale);
        scene.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          o.castShadow = true;
          o.receiveShadow = true;
        });
        return holder;
      });
      this.pickupAssets.set(kind,asset);
    }
    return asset;
  }
  dispose() {
    this.clearAnimations();
    for (const asset of this.pickupAssets.values())
      void asset.then(root => {
        const materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>();
        root.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        });
        for (const m of materials) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
          m.dispose();
        }
        textures.forEach(t=>t.dispose());
      }).catch(() => {});
    this.pickupAssets.clear();
    this.hand?.dispose();
    this.skins.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.finishes.dispose();
    this.covers.dispose();
    void this.chargeAsset.then(({scene}) => scene.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose(); }
    })).catch(() => {});
    this.materials.dispose();
  }
}
