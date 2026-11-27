import * as THREE from "three";
import type { DimensionLook, StagedShot } from "../../render/game-renderer";
import type { StagedView } from "../../render/camera-rig";

/** Seconds from the hit's lead-in to the first-person view. */
export const ASCENSION_SECONDS = 9;
/** Seconds before that in which the overhead world breaks into blocks: the shot's clock starts at minus this. */
export const ASCENSION_LEAD = 0.8;
/** The front goes on running after the camera has landed, until the horizon stands too. */
export const ASCENSION_SPREAD = 10.4;
/** When the saxophone comes in: the world lets go of the page at this moment. */
export const ASCENSION_HIT = 1;

/** Side of one block of the flat world, in world units: eight to a cell. */
const BLOCK = 0.3;
const FOV = 67;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (from: number, to: number, time: number) => clamp01((time - from) / (to - from));
const ease = (u: number) => u * u * (3 - 2 * u);
/** Slow at both ends and quick in the middle, more so than `ease`. */
const glide = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * The turn from two dimensions to three, as one camera move and one spreading front.
 *
 * The camera is an orbit rig throughout: a point it looks at, a heading, a pitch and a distance.
 * It starts as the overhead board, looking down with north at the top of the screen. It comes
 * down in half a turn of a spiral, which is what lets the eye see heights at all, and levels out
 * behind the two of them looking south across the plaza. Then the distance runs out to nothing
 * and the rig is the hero's own eye, facing `yaw`.
 *
 * The front starts at the hero's feet and runs outwards faster and faster, so the plaza stands
 * up while the camera is still high, and the hills on the horizon rise as it levels out.
 */
export class AscensionShot implements StagedShot {
  /** Seconds on the shot's clock. The owner advances it, starting from `-ASCENSION_LEAD`. */
  time = -ASCENSION_LEAD;
  private focus = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private stand = new THREE.Vector3();

  /**
   * @param x World position of the hero, where the front starts.
   * @param z
   * @param yaw Heading of the first-person view the shot ends on.
   * @param companion World position of whoever stands beside him; the middle of the shot looks at the two.
   */
  constructor(
    private x: number,
    private z: number,
    private yaw: number,
    private companion: { x: number; z: number },
  ) {}

  get done() {
    return this.time >= ASCENSION_SECONDS;
  }

  /** The hero's own body is in the picture until the camera is about to enter his head. */
  get showSelf() {
    return this.distance(60) > 1.3;
  }

  /** 0..1 of a jolt at the hit, for whoever shakes the picture. */
  get jolt() {
    const since = this.time - ASCENSION_HIT;
    return since < 0 ? 0 : Math.exp(-since * 3.2);
  }

  /** The flat world this frame; undefined once all of it stands. */
  get look(): DimensionLook | undefined {
    const t = this.time;
    if (t >= ASCENSION_SPREAD) return undefined;
    return {
      x: this.x,
      z: this.z,
      front: t < 0.8 ? 0 : 0.9 * (Math.exp(0.72 * (t - 0.8)) - 1),
      block: BLOCK,
      // The blocks come in over the lead; the depth-free look goes out as the camera comes down.
      cover: ease(span(-ASCENSION_LEAD, -0.15, t)) * (1 - ease(span(3, 5, t))),
      glow: ease(span(0.3, 0.8, t)) * (1 - ease(span(7.5, 9.5, t))),
    };
  }

  private distance(start: number) {
    const t = this.time;
    const down = mix(start, 7.5, glide(span(ASCENSION_HIT, 5.4, t)));
    const near = mix(down, 4.6, ease(span(5.4, 7.2, t)));
    return mix(near, 0, glide(span(7.2, ASCENSION_SECONDS, t)));
  }

  pose(camera: THREE.PerspectiveCamera, { eye, board }: StagedView) {
    const t = this.time;
    const start = board.position.length(),
      boardPitch = -Math.atan2(board.position.y, board.position.z);
    const arrive = glide(span(7.2, ASCENSION_SECONDS, t));

    // What the rig looks at: the middle of the board, then the pair, then straight ahead.
    this.stand.set((this.x + this.companion.x) / 2, 1.25, (this.z + this.companion.z) / 2);
    this.focus
      .set(0, 0, 0)
      .lerp(this.stand, glide(span(ASCENSION_HIT, 4.6, t)))
      .lerp(eye, arrive);

    const heading = mix(this.yaw - Math.PI, this.yaw, glide(span(1.5, 6, t)));
    const settle = mix(boardPitch, -0.36, glide(span(ASCENSION_HIT, 5.9, t)));
    const pitch = mix(mix(settle, -0.1, ease(span(5.9, 7.2, t))), 0, arrive);
    this.euler.set(pitch, heading, 0);
    camera.quaternion.setFromEuler(this.euler);
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const distance = this.distance(start);
    camera.position.copy(this.focus).addScaledVector(this.forward, -distance);
    // Never under the lawn, however the easing curves cross.
    camera.position.y = Math.max(camera.position.y, 0.6);

    const jolt = this.jolt * 0.35;
    camera.position.x += Math.sin(t * 47) * jolt;
    camera.position.y += Math.sin(t * 61 + 1.3) * jolt;

    // A wider lens on the way down makes the heights lean; it is the game's own by the end.
    camera.fov = FOV + 14 * Math.sin(Math.PI * span(2, ASCENSION_SECONDS, t));
    camera.updateProjectionMatrix();

    // From the board's parallel projection to perspective, weighted as the tactical view does it.
    const flat = 1 - ease(span(ASCENSION_HIT, 3, t));
    if (flat <= 0) return true;
    const weight = flat / (flat + (1 - flat) / start);
    const from = camera.projectionMatrix.elements,
      to = board.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) from[i] += (to[i] - from[i]) * weight;
    return false;
  }
}
