import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import type { GameSnapshot } from "../../core/types";
import type { StagedShot } from "../../render/game-renderer";
import type { StagedView } from "../../render/camera-rig";

/** How far out the camera circles him, in world units, where there is room for it. */
const REACH = 4.2;
/** The least it keeps, with a wall at his back. */
const CLOSE = 1.5;
/** Radians a second: one full turn in about the time the jump is made to last. */
const TURN = 1.08;
/** The camera sits below him and looks up, so that what stands behind him is the sky. */
const TILT = 0.24;
/** The world's pace at the top of the jump, and on the way up and down. */
const HANG = 0.04,
  DRIFT = 0.15;
const FOV = 67,
  LONG = 50;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (from: number, to: number, time: number) => clamp01((time - from) / (to - from));
const ease = (u: number) => u * u * (3 - 2 * u);
const glide = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * His first jump, held: 0.4 seconds made to last about six. The camera leaves his eyes as he
 * leaves the ground, goes once round him from below while he hangs against the sky, and is back
 * behind his eyes as his feet come down. One turn, so nothing has to be cut.
 *
 * The owner calls `advance` once a frame with the seconds that really passed and sets the
 * match's pace to `rate`.
 */
export class JumpShot implements StagedShot {
  /** Seconds of real time since he left the ground. */
  private time = 0;
  private turned = 0;
  /** Set once he is nearly down: the time the way back began, how far round it was, how long it takes. */
  private leaving?: { at: number; turned: number; length: number };
  private speed = 0;
  private room = REACH;
  private focus = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, "YXZ");

  /** @param look Where his own eyes look; the shot starts and ends there. */
  constructor(private look: { yaw: number; pitch: number }) {}

  /** 0..1: out of his eyes and round him. */
  private get away() {
    const out = this.leaving ? glide(span(0, this.leaving.length, this.time - this.leaving.at)) : 0;
    return ease(span(0, 0.9, this.time)) * (1 - out);
  }

  private get heading() {
    const { leaving } = this;
    if (!leaving) return this.turned;
    return mix(leaving.turned, Math.PI * 2, glide(span(0, leaving.length, this.time - leaving.at)));
  }

  get done() {
    return !!this.leaving && this.time >= this.leaving.at + this.leaving.length;
  }

  /** The pace of the world this frame: nearly still at the top, and the game's own by the end. */
  get rate() {
    const slow = mix(HANG, DRIFT, ease(clamp01((Math.abs(this.speed) - 1) / 6)));
    const into = mix(1, slow, ease(span(0, 0.3, this.time)));
    return this.leaving ? mix(into, 1, ease(span(0, 0.45, this.time - this.leaving.at))) : into;
  }

  get showSelf() {
    return this.away * this.room > 0.9;
  }

  get lens() {
    return { grade: 0.8 * this.away, focus: Math.max(1, this.away * this.room) };
  }

  advance(real: number, state: Readonly<GameSnapshot>) {
    const you = state.players[0];
    this.time += real;
    this.speed = you.verticalSpeed;
    if (!this.leaving) {
      this.turned += TURN * real * ease(span(0, 0.9, this.time));
      const down = you.verticalSpeed < 0 && you.elevation < 0.4;
      // Landed already, or a jump that never came: the camera goes home all the same.
      if (down || (this.time > 0.3 && you.elevation === 0) || this.time > 9) {
        const left = Math.PI * 2 - this.turned;
        this.leaving = {
          at: this.time,
          turned: this.turned,
          length: THREE.MathUtils.clamp(left / 2.6, 1.1, 2.4),
        };
      }
    }
    // Keep the camera on open ground: walk outwards from him and stop short of the first wall.
    const heading = this.look.yaw + this.heading,
      dx = Math.sin(heading),
      dz = Math.cos(heading);
    let room = REACH;
    for (let reach = 0.4; reach <= REACH + 0.4; reach += 0.3) {
      const x = Math.round(you.x + (dx * reach) / TILE_SIZE),
        z = Math.round(you.z + (dz * reach) / TILE_SIZE);
      if (state.tiles[z]?.[x] === 0) continue;
      room = Math.max(CLOSE, reach - 0.7);
      break;
    }
    this.room += (room - this.room) * (1 - Math.exp(-real * 5));
  }

  pose(camera: THREE.PerspectiveCamera, { eye }: StagedView) {
    const away = this.away;
    // Round his chest rather than his eyes, so the whole of him is in the picture.
    this.focus.copy(eye);
    this.focus.y -= 0.55 * away;
    this.euler.set(mix(this.look.pitch, TILT, away), this.look.yaw + this.heading, 0);
    camera.quaternion.setFromEuler(this.euler);
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.position.copy(this.focus).addScaledVector(this.forward, -away * this.room);
    camera.position.y = Math.max(camera.position.y, mix(0.05, 0.3, away));
    camera.fov = mix(FOV, LONG, away);
    camera.updateProjectionMatrix();
    return true;
  }
}
