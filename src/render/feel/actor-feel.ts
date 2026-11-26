import * as THREE from "three";
import type { MinecraftAvatar } from "../minecraft-avatar";

/** How long a hit shows on a body, in seconds. */
export const HURT_TIME = 0.45;
const HURT_LEAN = 0.3;
const HURT_HOP = 0.13;
const HURT_HOP_TIME = 0.26;

/** Strength of the red wash: solid at first, then fading out. */
export const hurtTint = (age: number) =>
  age < 0 || age >= HURT_TIME ? 0 : 1 - THREE.MathUtils.smoothstep(age, 0.2, HURT_TIME);
/** Stagger amount: snaps to its peak in about 0.1 s and eases back to rest. */
export const hurtKick = (age: number) =>
  age <= 0 || age >= HURT_TIME ? 0 : Math.sin(Math.PI * (age / HURT_TIME) ** 0.45);
/** Height of the small hop a struck body makes. */
export const hurtHop = (age: number) =>
  age <= 0 || age >= HURT_HOP_TIME ? 0 : HURT_HOP * Math.sin((Math.PI * age) / HURT_HOP_TIME);

/**
 * Tips an avatar away from a hit, pivoting at its feet. `bearing` is where the hit came from
 * relative to the avatar's facing (0 ahead, positive to its right). Call after the yaw is set.
 */
export function leanAvatar(avatar: MinecraftAvatar, kick: number, bearing: number) {
  // Yaw first, so that x and z tilt in the avatar's own frame.
  avatar.rotation.order = "YXZ";
  avatar.rotation.x = HURT_LEAN * kick * Math.cos(bearing);
  avatar.rotation.z = HURT_LEAN * kick * Math.sin(bearing);
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
