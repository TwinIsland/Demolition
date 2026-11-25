import * as THREE from "three";
import type { MinecraftAvatar } from "../minecraft-avatar";

const white = new THREE.Color("#ffffff");
const scratch = new THREE.Color();

/** Brief emissive flash on an articulated avatar. Each avatar owns its materials, so no cloning is needed. */
export function flashAvatar(avatar: MinecraftAvatar, amount: number, tint: THREE.Color = white) {
  const data = avatar.userData as { flashMaterials?: THREE.MeshStandardMaterial[]; flash?: number };
  if (!amount && !data.flash) return;
  if (!data.flashMaterials) {
    const materials = new Set<THREE.MeshStandardMaterial>();
    avatar.rig.skin.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m instanceof THREE.MeshStandardMaterial) materials.add(m);
    });
    data.flashMaterials = [...materials];
  }
  data.flash = amount;
  scratch.copy(tint).multiplyScalar(amount * 0.85);
  for (const material of data.flashMaterials) material.emissive.copy(scratch);
}

export const BANDAGE_TIME = 1.25;
/** Third-person counterpart of the first-person wrap: both hands meet at the chest and the right one circles. */
export function poseBandaging(avatar: MinecraftAvatar, age: number) {
  const u = age / BANDAGE_TIME;
  if (u < 0 || u >= 1) return;
  const blend = THREE.MathUtils.smoothstep(u, 0, 0.16) * (1 - THREE.MathUtils.smoothstep(u, 0.86, 1));
  const turn = THREE.MathUtils.smoothstep(u, 0.14, 0.88) * Math.PI * 6;
  const { leftArm, rightArm, head } = avatar.rig.skin;
  const mix = THREE.MathUtils.lerp;
  leftArm.rotation.set(
    mix(leftArm.rotation.x, -1.05, blend),
    mix(leftArm.rotation.y, 0, blend),
    mix(leftArm.rotation.z, 0.5, blend),
  );
  rightArm.rotation.set(
    mix(rightArm.rotation.x, -1.15 + Math.sin(turn) * 0.16, blend),
    mix(rightArm.rotation.y, 0, blend),
    mix(rightArm.rotation.z, -0.55 + Math.cos(turn) * 0.12, blend),
  );
  head.rotation.x = mix(head.rotation.x, 0.32, blend);
}
