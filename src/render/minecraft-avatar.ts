import * as THREE from "three";
import { PlayerObject } from "skinview3d";
import { AvatarMotion } from "./avatar-motion";
import type { MinecraftSkin } from "./minecraft-skins";

/** Minecraft's six rigid body parts retain their original UVs and joint pivots. */
export class MinecraftAvatar extends THREE.Group {
  readonly rig = new PlayerObject();
  readonly motion = new AvatarMotion();
  private readonly grip = new THREE.Group();
  constructor() {
    super();
    this.rig.scale.setScalar(1.8 / 32);
    this.rig.position.y = 0.9;
    this.rig.rotation.y = Math.PI;
    this.rig.cape.visible = false;
    this.rig.elytra.visible = false;
    this.rig.ears.visible = false;
    this.rig.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.grip.rotation.set(0.77, 0.22, 0.24);
    this.grip.scale.setScalar(8);
    this.rig.skin.rightArm.add(this.grip);
    this.add(this.rig);
  }
  hold(model: THREE.Object3D, kind: "bomb" | "item" | "melee") {
    this.grip.clear();
    // The bomb mesh starts at its base. Seat that end inside the palm.
    if (kind === "bomb") this.grip.position.set(-0.65, -9.25, 1.15);
    else if (kind === "melee") {
      this.grip.position.set(-0.75, -9.3, 1.3);
      model.position.y -= 0.45;
      model.rotation.y = 0.7;
      model.rotation.x = -0.28;
    } else this.grip.position.set(-1.9, -9.1, 3.65);
    this.grip.add(model);
  }
  /** Light the texels marked in `glow`, such as eyes, independently of scene lighting. */
  setGlow(glow: MinecraftSkin, intensity: number) {
    this.rig.skin.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.emissive.set("#ffffff");
        material.emissiveMap = glow.texture;
        material.emissiveIntensity = intensity;
        material.needsUpdate = true;
      }
    });
  }
  setSkin(skin: MinecraftSkin) {
    this.rig.skin.modelType = skin.model;
    this.rig.skin.map = skin.texture;
  }
  dispose() {
    this.grip.clear();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.rig.traverse((o) => {
      // Attachments marked as shared belong to the model library.
      if (o instanceof THREE.Mesh && !o.userData.shared) {
        geometries.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
