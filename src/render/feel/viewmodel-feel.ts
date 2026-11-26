import * as THREE from "three";
import type { Cue } from "../../feel/cues";
import type { Player } from "../../core/types";
import type { MinecraftAvatar } from "../minecraft-avatar";
import { Spring } from "./camera-feel";

type ActionKind = "equip" | "plant" | "throw" | "pickup" | "activate" | "bandage";
const DURATION: Record<ActionKind, number> = {
  equip: 0.26,
  plant: 0.28,
  throw: 0.34,
  pickup: 0.22,
  activate: 0.42,
  bandage: 1.25,
};
/** Rest pose of the first-person arm, set by Models.firstPersonArm. */
const REST_ARM = [-1.04, 0.12, -0.09] as const;
const LOWERED_ARM = -0.25;
/** Both arms meet in front of the chest: the left forearm is presented, the right hand circles it. */
export const BANDAGE_POSE = {
  left: [-1.3, 0, -0.62],
  right: [-1.2, 0, 0.42],
  lift: 0.3,
  wraps: 3,
  orbit: 0.13,
};

const smooth = (edge0: number, edge1: number, x: number) => THREE.MathUtils.smoothstep(x, edge0, edge1);
const arc = (u: number) => Math.sin(Math.PI * u);

/**
 * Motion of the held item and first-person arms: look sway, walk bob, flinch, and one-shot actions
 * such as raising new equipment, planting, throwing and wrapping a bandage.
 */
export class ViewmodelFeel {
  private swayX = new Spring(130, 19);
  private swayY = new Spring(130, 19);
  private flinch = new Spring(230, 16);
  private drop = new Spring(190, 18);
  private stride = 0;
  private lookYaw = Number.NaN;
  private lookPitch = 0;
  private action?: { kind: ActionKind; start: number; item?: string };
  private proxy?: Player;
  private clock = 0;

  reset() {
    for (const spring of [this.swayX, this.swayY, this.flinch, this.drop]) spring.reset();
    this.action = undefined;
    this.lookYaw = Number.NaN;
    this.stride = 0;
  }

  private play(kind: ActionKind, item?: string) {
    this.action = { kind, start: this.clock, item };
  }
  private progress() {
    return this.action ? (this.clock - this.action.start) / DURATION[this.action.kind] : 1;
  }

  /**
   * The bandage stays in hand until the wrap finishes, even though the simulation has already
   * consumed it and may have switched the player back to charges.
   */
  heldPlayer(you: Player): Player {
    const action = this.action;
    if (action?.kind !== "bandage" || !action.item || action.item === you.equipped) return you;
    this.proxy = Object.assign(this.proxy ?? {}, you, { equipped: action.item });
    return this.proxy;
  }

  update(
    cues: readonly Cue[],
    you: Readonly<Player>,
    lookYaw: number,
    lookPitch: number,
    moving: boolean,
    dt: number,
    wallTime: number,
  ) {
    this.clock = wallTime;
    const wrapping = () => this.action?.kind === "bandage";
    for (const cue of cues)
      switch (cue.type) {
        case "consume":
          this.play(cue.heals ? "bandage" : "activate", cue.item);
          break;
        case "plant":
          this.play("plant");
          break;
        case "throw":
          this.play("throw");
          break;
        case "swing":
          // The swing itself is driven by the melee cooldown; it only interrupts other actions.
          this.action = undefined;
          break;
        case "equip":
          if (!wrapping()) this.play("equip");
          break;
        case "pickup":
          if (!this.action) this.play("pickup");
          break;
        case "damage":
          this.flinch.impulse(-2.2);
          break;
        case "strike":
          // A landed hit pushes back through the arm.
          this.flinch.impulse(0.7);
          break;
        case "land":
          this.drop.impulse(-Math.min(1.5, cue.speed * 0.12));
          break;
      }
    if (this.action && this.progress() >= 1) {
      const finished = this.action;
      this.action = undefined;
      // The real equipment comes back up once the bandage is used.
      if (finished.kind === "bandage" && finished.item !== you.equipped) this.play("equip");
    }

    if (Number.isNaN(this.lookYaw)) {
      this.lookYaw = lookYaw;
      this.lookPitch = lookPitch;
    }
    const rate = dt > 0 ? 1 / dt : 0;
    const yawRate = Math.atan2(Math.sin(lookYaw - this.lookYaw), Math.cos(lookYaw - this.lookYaw)) * rate;
    const pitchRate = (lookPitch - this.lookPitch) * rate;
    this.lookYaw = lookYaw;
    this.lookPitch = lookPitch;
    // The item trails the view: turning left leaves it to the right for a moment.
    this.swayX.step(dt, THREE.MathUtils.clamp(yawRate * 0.011, -0.05, 0.05));
    this.swayY.step(dt, THREE.MathUtils.clamp(-pitchRate * 0.011, -0.04, 0.04));
    this.flinch.step(dt);
    this.drop.step(dt);
    const grounded = you.verticalSpeed === 0;
    const pace = moving && grounded ? (you.sprinting ? 1.6 : 1) : 0;
    this.stride += (pace - this.stride) * (1 - Math.exp(-dt * 9));
  }

  /**
   * Writes the final transform. `swing` is the melee amount from Models.swingAmount and `travel`
   * is the distance walked, which keeps the bob in step with the camera.
   */
  pose(
    held: THREE.Object3D,
    hand: MinecraftAvatar,
    aspect: number,
    swing: number,
    travel: number,
    scale: number,
  ) {
    const phase = travel * 2.75;
    const bobX = Math.sin(phase) * 0.011 * this.stride * scale;
    const bobY = (Math.sin(phase * 2) * 0.006 * this.stride + Math.sin(this.clock * 1.7) * 0.002) * scale;
    const swayX = this.swayX.value * scale,
      swayY = this.swayY.value * scale;
    const jolt = (this.flinch.value + this.drop.value) * scale;

    const x = Math.min(0, (aspect - 1) * 0.34) + swayX + bobX - swing * 0.21;
    let y = swayY + bobY + jolt * 0.05 + swing * 0.06;
    let z = -swing * 0.13;
    let pitch = -swayY * 1.4 + this.flinch.value * scale * 0.06;
    const yaw = swayX * 1.3;
    let roll = -swayX * 1.1 + bobX * 0.6 - swing * 0.47;

    const { leftArm, rightArm } = hand.rig.skin;
    let wrap = 0;
    const action = this.action;
    if (action) {
      const u = THREE.MathUtils.clamp(this.progress(), 0, 1);
      switch (action.kind) {
        case "equip": {
          const lowered = (1 - u) ** 3;
          y -= 0.36 * lowered;
          pitch -= 0.55 * lowered;
          break;
        }
        case "plant":
          y -= 0.07 * arc(u);
          z -= 0.11 * arc(u);
          pitch -= 0.26 * arc(u);
          break;
        case "throw": {
          const whip = arc(u ** 0.6);
          y += 0.05 * whip;
          z -= 0.13 * whip;
          pitch -= 0.62 * whip;
          break;
        }
        case "pickup":
          y -= 0.035 * arc(u);
          pitch -= 0.08 * arc(u);
          break;
        case "activate":
          y += 0.07 * arc(u);
          roll += 0.22 * arc(u);
          break;
        case "bandage": {
          wrap = smooth(0, 0.16, u) * (1 - smooth(0.86, 1, u));
          const turn = smooth(0.14, 0.88, u) * BANDAGE_POSE.wraps * Math.PI * 2;
          y += BANDAGE_POSE.lift * wrap;
          const [lx, ly, lz] = BANDAGE_POSE.left,
            [rx, ry, rz] = BANDAGE_POSE.right;
          // The supporting arm swings up from below the frame and sinks back afterwards.
          leftArm.rotation.set(THREE.MathUtils.lerp(LOWERED_ARM, lx, wrap), ly, lz);
          rightArm.rotation.set(
            THREE.MathUtils.lerp(REST_ARM[0], rx + Math.sin(turn) * BANDAGE_POSE.orbit, wrap),
            THREE.MathUtils.lerp(REST_ARM[1], ry, wrap),
            THREE.MathUtils.lerp(REST_ARM[2], rz + Math.cos(turn) * BANDAGE_POSE.orbit, wrap),
          );
          break;
        }
      }
    }
    if (leftArm.visible !== wrap > 0) leftArm.visible = wrap > 0;
    if (!wrap) rightArm.rotation.set(...REST_ARM);
    held.position.set(x, y, z);
    held.rotation.set(pitch, yaw, roll);
  }
}
