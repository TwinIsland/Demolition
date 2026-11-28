import * as THREE from "three";
import type { GameSnapshot, Player } from "../core/types";
import type { ReplayShot } from "../replay/killcam";
import { TILE_SIZE, world } from "./arena";

export type CameraMode = "lobby" | "first-person" | "spectator" | "replay";

export interface CameraFrame {
  mode: CameraMode;
  pitch: number;
  yaw: number;
  wallTime: number;
  menuBeat: number;
  /** The local player is looking at the board from above this frame. */
  tactical: boolean;
  /** Melee swing progress in 0..1, applied to the held-item anchor. */
  swing: number;
  /** How far the local player stands below the deck, wading in a pool. */
  sink?: number;
  /** The killcam's camera; required in the replay mode. */
  shot?: ReplayShot;
  /** 0..1 scale for camera shake, from the player's motion setting. */
  motion?: number;
  /** A staged shot: it has the last word on the camera this frame, whatever the mode. */
  staged?: StagedShot;
  /**
   * Called once the first-person eye is placed. Poses the held-item anchor, may offset the camera
   * (shake, recoil) and returns a field-of-view offset in degrees.
   */
  feel(motion: HeldMotion): number;
}

/** What a staged shot is given to work from: where the camera would have been without it. */
export interface StagedView {
  /** The first-person eye of the local player. */
  eye: THREE.Vector3;
  /** The overhead camera of the tactical board, already fitted to the arena. */
  board: THREE.OrthographicCamera;
  /** Arena side in cells. */
  size: number;
}

/**
 * A camera move written by a cutscene. `pose` places the camera and may replace its projection
 * matrix; it returns false when the projection is no longer a plain perspective one, which the
 * renderer needs to know for effects that rebuild depth.
 */
export interface StagedShot {
  pose(camera: THREE.PerspectiveCamera, view: StagedView): boolean;
  /** Draw the local player's body, which a first-person frame leaves out. */
  showSelf?: boolean;
}

interface HeldMotion {
  moving: boolean;
  /** Distance walked since the arena was built, in cells. Drives the walk cycle. */
  travel: number;
  swing: number;
}

const EYE_HEIGHT = 1.55;
const BASE_FOV = 67;

/** First-person eye, lobby/spectator orbit and the blend into the top-down tactical board. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.04, 220);
  /** Anchor for the first-person arm; posed each frame by the feel layer. */
  readonly held = new THREE.Group();
  /** Distance to what the replay camera looks at, for its depth of field. */
  focusDistance = 5;
  /** 0 in the perspective view, 1 once the tactical board fills the screen. */
  tacticalBlend = 0;
  /** False while a staged shot has replaced the perspective projection. */
  perspective = true;
  private eye = new THREE.Vector3();
  private board = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.04, 220);
  private previous = new THREE.Vector2();
  private travel = 0;
  private lastTime = 0;

  constructor() {
    this.camera.add(this.held);
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Restarts the walk cycle when a new arena is built. */
  reset() {
    this.travel = 0;
  }

  update(state: Readonly<GameSnapshot>, you: Player, frame: CameraFrame) {
    const { camera, held } = this;
    const { mode, wallTime, menuBeat } = frame;
    if (mode === "first-person") {
      const moved = this.previous.distanceTo(new THREE.Vector2(you.x, you.z));
      this.travel += Math.min(moved, 0.1);
      this.previous.set(you.x, you.z);
      const bob = moved > 0.0001 && you.verticalSpeed === 0 ? Math.sin(this.travel * 5.5) * 0.006 : 0;
      camera.position.set(
        world(you.x, state.size),
        EYE_HEIGHT + you.elevation + bob - (frame.sink ?? 0),
        world(you.z, state.size),
      );
      camera.rotation.order = "YXZ";
      camera.rotation.set(frame.pitch, frame.yaw, 0);
      held.visible = you.alive;
      camera.fov = BASE_FOV + frame.feel({ moving: moved > 0.0001, travel: this.travel, swing: frame.swing });
    } else if (mode === "replay" && frame.shot) {
      held.visible = false;
      const { shot } = frame;
      const x = world(shot.focus.x, state.size),
        z = world(shot.focus.z, state.size);
      // Two detuned sines per axis: cheap, smooth, and never the same twice in a row.
      const shake = shot.shake * (frame.motion ?? 1) * 0.11;
      camera.position.set(
        x + Math.sin(shot.azimuth) * shot.distance + Math.sin(wallTime * 47) * shake,
        shot.height + Math.sin(wallTime * 61 + 1.3) * shake,
        z + Math.cos(shot.azimuth) * shot.distance + Math.sin(wallTime * 53 + 2.1) * shake,
      );
      camera.lookAt(x, shot.focusHeight, z);
      camera.rotateZ(shot.roll + Math.sin(wallTime * 39) * shake * 0.12);
      camera.fov = shot.fov;
      this.focusDistance = Math.hypot(shot.distance, shot.height - shot.focusHeight);
    } else {
      held.visible = false;
      const angle = mode === "lobby" ? 0.62 + Math.sin(wallTime * 0.035) * 0.1 : wallTime * 0.035;
      const radius = state.size * (2.35 - menuBeat * 0.016);
      const offset = camera.aspect > 1.3 && mode === "lobby" ? -6 : 0;
      camera.position.set(
        Math.sin(angle) * radius + offset + Math.sin(wallTime * 29) * menuBeat * 0.05,
        state.size * 2.0 + Math.cos(wallTime * 24) * menuBeat * 0.035,
        Math.cos(angle) * radius,
      );
      camera.lookAt(offset, -0.6, 0);
      camera.fov = mode === "lobby" ? 53 : 58;
    }
    camera.updateProjectionMatrix();
    const delta = this.lastTime ? Math.min(0.1, wallTime - this.lastTime) : 0.016;
    this.lastTime = wallTime;
    const goal = frame.tactical ? 1 : 0;
    this.tacticalBlend += (goal - this.tacticalBlend) * (1 - Math.exp(-delta * 24));
    if (Math.abs(this.tacticalBlend - goal) < 0.001) this.tacticalBlend = goal;
    if (mode === "first-person" && this.tacticalBlend > 0) this.blendToBoard(state.size);
    this.perspective = true;
    if (!frame.staged) return;
    held.visible = false;
    this.eye.set(
      world(you.x, state.size),
      EYE_HEIGHT + you.elevation - (frame.sink ?? 0),
      world(you.z, state.size),
    );
    this.fitBoard(state.size);
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
    this.perspective = frame.staged.pose(camera, { eye: this.eye, board: this.board, size: state.size });
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  /** Fits the overhead camera to an arena `size` cells across. */
  private fitBoard(size: number) {
    const { camera, board } = this;
    const half = ((size * TILE_SIZE) / 2 + 2) / Math.min(1, camera.aspect);
    board.left = -half * camera.aspect;
    board.right = -board.left;
    board.top = half;
    board.bottom = -half;
    board.position.set(0, size * TILE_SIZE, size * TILE_SIZE * 0.31);
    board.lookAt(0, 0, 0);
    board.updateProjectionMatrix();
  }

  private blendToBoard(size: number) {
    const { camera, board } = this;
    const t = this.tacticalBlend;
    this.fitBoard(size);
    camera.position.lerp(board.position, t);
    camera.quaternion.slerp(board.quaternion, t);
    // Match clip-space weights at board center during the perspective-to-ortho blend.
    const projectionBlend = t / (t + (1 - t) / board.position.length());
    for (let i = 0; i < 16; i++)
      camera.projectionMatrix.elements[i] +=
        (board.projectionMatrix.elements[i] - camera.projectionMatrix.elements[i]) * projectionBlend;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    this.held.visible = t < 0.2;
  }
}
