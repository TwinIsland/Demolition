import * as THREE from "three";
import { CueTracker, relativeBearing, type Cue } from "../../feel/cues";
import { motionScale } from "../../feel/settings";
import type { GameSnapshot, Player, Vec2, Zombie } from "../../core/types";
import type { MinecraftAvatar } from "../minecraft-avatar";
import {
  BANDAGE_TIME,
  HURT_TIME,
  hurtHop,
  hurtKick,
  hurtTint,
  leanAvatar,
  poseBandaging,
} from "./actor-feel";
import { CameraFeel } from "./camera-feel";
import { SelfMarker } from "./self-marker";
import { ViewmodelFeel } from "./viewmodel-feel";
import { WallTelegraph } from "./wall-telegraph";

/** World units a struck operator's body is shoved away from the hit before it settles back. */
const HURT_SHOVE = 0.14;

/**
 * Renderer-side game feel. The renderer calls `begin` once per frame, then the per-object hooks.
 * Everything here reads snapshots and writes only to scene objects.
 */
export class RenderFeel {
  private marker = new SelfMarker();
  private telegraph = new WallTelegraph();
  /** Add to the scene once. Holds world-space helpers such as the top-down self marker. */
  readonly root = new THREE.Group().add(this.marker.root, this.telegraph.mesh);
  private tracker = new CueTracker();
  private camera = new CameraFeel();
  private viewmodel = new ViewmodelFeel();
  private cues: readonly Cue[] = [];
  private bandaging = new Map<string, number>();
  private hurt = new Map<string, { at: number; source?: Vec2 }>();
  /** Seconds of wall time since the local player was last hurt; drives the first-person arm tint. */
  private ownHurtAge = Infinity;
  private seed = Number.NaN;
  private lastFrame = 0;
  private dt = 0;

  begin(state: Readonly<GameSnapshot>, localId: string, wallTime: number) {
    this.dt = this.lastFrame ? Math.min(0.1, Math.max(0, wallTime - this.lastFrame)) : 0;
    this.lastFrame = wallTime;
    if (state.seed !== this.seed) {
      this.seed = state.seed;
      this.bandaging.clear();
      this.hurt.clear();
      this.ownHurtAge = Infinity;
      this.camera.reset();
      this.viewmodel.reset();
    }
    this.cues = this.tracker.collect(state, localId);
    for (const cue of this.cues)
      if (cue.type === "actor-consume" && cue.heals) this.bandaging.set(cue.playerId, cue.at);
      else if (cue.type === "actor-hurt") this.hurt.set(cue.playerId, { at: cue.at, source: cue.source });
      else if (cue.type === "damage") this.ownHurtAge = 0;
  }

  /** Player to show in the first-person hand; differs from `you` only while a bandage is being wrapped. */
  heldPlayer(you: Player) {
    return this.viewmodel.heldPlayer(you);
  }

  /**
   * Call after the camera and held group have their base pose. Returns the field-of-view offset.
   * `steady` suppresses camera offsets, for example while blending into the tactical view.
   */
  firstPerson(
    camera: THREE.PerspectiveCamera,
    held: THREE.Object3D,
    hand: MinecraftAvatar,
    you: Player,
    look: { yaw: number; pitch: number },
    motion: { moving: boolean; travel: number; swing: number },
    wallTime: number,
    steady = false,
  ) {
    const scale = motionScale();
    this.ownHurtAge += this.dt;
    hand.setHurt(you.alive ? hurtTint(this.ownHurtAge) : 0);
    this.camera.update(this.cues, you, look.yaw, motion.moving, this.dt);
    this.viewmodel.update(this.cues, you, look.yaw, look.pitch, motion.moving, this.dt, wallTime);
    this.viewmodel.pose(held, hand, camera.aspect, motion.swing, motion.travel, scale);
    return steady ? 0 : this.camera.apply(camera, wallTime, scale);
  }

  /** Call after the zombie is placed and turned. A struck zombie turns red, hops and tips away from the hit. */
  zombie(avatar: MinecraftAvatar, enemy: Readonly<Zombie>, time: number) {
    const age = enemy.hurtAt === undefined ? Infinity : time - enemy.hurtAt;
    avatar.setHurt(hurtTint(age));
    const scale = motionScale();
    const push = enemy.knockback;
    // The simulation slides the zombie along `knockback`; the body leans the same way.
    const bearing = push
      ? relativeBearing(enemy, { x: enemy.x - push.x, z: enemy.z - push.z }, avatar.rotation.y)
      : 0;
    leanAvatar(avatar, hurtKick(age) * scale, bearing);
    avatar.position.y += hurtHop(age) * scale;
  }

  /**
   * Call after Models.updateCharacter and after the avatar is placed and turned, so the poses here
   * override the walk cycle and the hurt stagger is added on top of the authoritative position.
   */
  actor(avatar: MinecraftAvatar, player: Readonly<Player>, time: number) {
    const wrapped = this.bandaging.get(player.id);
    if (wrapped !== undefined) {
      const age = time - wrapped;
      if (age < 0 || age >= BANDAGE_TIME || !player.alive) this.bandaging.delete(player.id);
      else poseBandaging(avatar, age);
    }
    const hurt = this.hurt.get(player.id);
    const age = hurt ? time - hurt.at : Infinity;
    if (hurt && (age < 0 || age >= HURT_TIME || !player.alive)) this.hurt.delete(player.id);
    avatar.setHurt(player.alive ? hurtTint(age) : 0);
    const kick = hurtKick(age) * motionScale();
    const source = hurt?.source;
    leanAvatar(avatar, kick, source ? relativeBearing(player, source, player.yaw) : 0);
    if (!kick) return;
    avatar.position.y += hurtHop(age) * motionScale();
    if (!source) return;
    const dx = player.x - source.x,
      dz = player.z - source.z,
      reach = Math.hypot(dx, dz);
    if (reach < 0.05) return;
    avatar.position.x += (dx / reach) * HURT_SHOVE * kick;
    avatar.position.z += (dz / reach) * HURT_SHOVE * kick;
  }

  /** Marks the local actor in the tactical view. `x` and `z` are world units, `blend` is the view transition. */
  topDown(you: Readonly<Player>, x: number, z: number, blend: number, wallTime: number) {
    this.marker.update(you, x, z, blend, wallTime, motionScale());
  }

  /**
   * Warns where permanent walls are about to rise. `landing` is Arena.wallLandings: cells whose wall
   * is still moving after a terrain reset.
   */
  walls(state: Readonly<GameSnapshot>, landing: ReadonlySet<number>) {
    if (this.telegraph.update(state, landing, motionScale())) this.camera.rumble(0.3);
  }

  /** Undirected camera shake for world events such as a zone wall slamming into place. */
  rumble(amount: number) {
    this.camera.rumble(amount);
  }

  dispose() {
    this.marker.dispose();
    this.telegraph.dispose();
  }
}
