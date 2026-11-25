import type * as THREE from "three";
import { relativeBearing, type Cue } from "../../feel/cues";
import type { Player, Vec2 } from "../../core/types";

/** Damped spring integrated with fixed substeps so it stays stable at low frame rates. */
export class Spring {
  value = 0;
  velocity = 0;
  constructor(
    private stiffness: number,
    private damping: number,
  ) {}
  impulse(amount: number) {
    this.velocity += amount;
  }
  step(dt: number, target = 0) {
    for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      this.velocity += (-this.stiffness * (this.value - target) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  reset() {
    this.value = this.velocity = 0;
  }
}

/** Sum of incommensurate sines: smooth, cheap and free of the visible period a single sine has. */
const wobble = (t: number, seed: number) =>
  (Math.sin(t * 37.1 + seed) +
    0.6 * Math.sin(t * 59.3 + seed * 1.7) +
    0.3 * Math.sin(t * 83.7 + seed * 2.3)) /
  1.9;

const SHAKE = { roll: 0.055, pitch: 0.036, yaw: 0.036, shift: 0.03 } as const;
const BLAST_REACH = 9;

/**
 * First-person camera response: trauma shake, directional recoil, landing dip and sprint field of view.
 * It only offsets the camera after the renderer has placed it, so aim and simulation are untouched.
 */
export class CameraFeel {
  private trauma = 0;
  private pitch = new Spring(210, 17);
  private roll = new Spring(210, 17);
  private yaw = new Spring(210, 17);
  private dip = new Spring(190, 19);
  private sprint = 0;

  reset() {
    this.trauma = this.sprint = 0;
    for (const spring of [this.pitch, this.roll, this.yaw, this.dip]) spring.reset();
  }

  /** Adds shake without a direction, for example when the arena itself moves. */
  rumble(amount: number) {
    this.trauma += amount;
  }

  private recoil(you: Vec2, viewYaw: number, source: Vec2 | undefined, strength: number) {
    if (!source) {
      this.pitch.impulse(strength * 0.7);
      return;
    }
    const bearing = relativeBearing(you, source, viewYaw);
    // The head is driven away from the attacker: back for a frontal hit, sideways for a flank.
    this.pitch.impulse(Math.cos(bearing) * strength * 0.75);
    this.roll.impulse(Math.sin(bearing) * strength);
    this.yaw.impulse(Math.sin(bearing) * strength * 0.45);
  }

  update(cues: readonly Cue[], you: Readonly<Player>, viewYaw: number, moving: boolean, dt: number) {
    for (const cue of cues)
      switch (cue.type) {
        case "damage": {
          const weight = Math.min(1, cue.amount / Math.max(1, you.maxHp * 0.3));
          this.trauma += (cue.cause === "blast" ? 0.5 : 0.36) + 0.4 * weight;
          this.recoil(you, viewYaw, cue.source, 1.25 + 0.9 * weight);
          break;
        }
        case "blocked":
          this.trauma += 0.2;
          this.recoil(you, viewYaw, cue.source, 0.5);
          break;
        case "blast": {
          const near = Math.max(0, 1 - cue.distance / BLAST_REACH);
          this.trauma += 0.62 * near * near;
          if (cue.distance > 0.35) this.recoil(you, viewYaw, cue, 0.7 * near * near);
          break;
        }
        case "land":
          this.dip.impulse(-Math.min(1.7, cue.speed * 0.13));
          break;
        case "swing":
          this.yaw.impulse(-0.22);
          break;
        case "strike":
          this.trauma += 0.1;
          break;
      }
    this.trauma = Math.max(0, Math.min(1, this.trauma) - dt * 1.5);
    this.pitch.step(dt);
    this.roll.step(dt);
    this.yaw.step(dt);
    this.dip.step(dt);
    this.sprint += ((you.sprinting && moving ? 1 : 0) - this.sprint) * (1 - Math.exp(-dt * 7));
  }

  /** Adds the current offsets to a camera already posed from player state. Returns the field-of-view offset in degrees. */
  apply(camera: THREE.PerspectiveCamera, wallTime: number, scale: number) {
    if (scale <= 0) return 0;
    const shake = this.trauma * this.trauma * scale;
    camera.rotation.x += this.pitch.value * scale + wobble(wallTime, 1.3) * SHAKE.pitch * shake;
    camera.rotation.y += this.yaw.value * scale + wobble(wallTime, 4.1) * SHAKE.yaw * shake;
    camera.rotation.z += this.roll.value * scale + wobble(wallTime, 7.9) * SHAKE.roll * shake;
    camera.position.x += wobble(wallTime, 11.2) * SHAKE.shift * shake;
    camera.position.y += this.dip.value * scale + wobble(wallTime, 13.6) * SHAKE.shift * shake;
    return (this.sprint * 3.5 + shake * 4) * Math.min(1, scale * 2);
  }
}
