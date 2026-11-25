import { IdleAnimation, WalkingAnimation, type PlayerObject } from "skinview3d";
import { MathUtils } from "three";
import { RULES } from "../core/content";

/** Drive articulated Minecraft joints from authoritative displacement, not keys. */
export class AvatarMotion {
  private walk = new WalkingAnimation();
  private idle = new IdleAnimation();
  private sample?: { x: number; z: number; time: number };
  constructor() {
    this.walk.headBobbing = false;
  }
  update(rig: PlayerObject, x: number, z: number, time: number, verticalSpeed = 0) {
    const previous = this.sample;
    this.sample = { x, z, time };
    if (!previous) return;
    const dt = time - previous.time;
    if (dt <= 0 || dt > 0.3) return;
    const distance = Math.hypot(x - previous.x, z - previous.z);
    const joints = [rig.skin.leftArm, rig.skin.rightArm, rig.skin.leftLeg, rig.skin.rightLeg, rig.skin.head];
    const old = joints.map((j) => j.rotation.clone());
    rig.resetJoints();
    if (verticalSpeed !== 0) {
      const rising = MathUtils.clamp(verticalSpeed / RULES.jumpSpeed, 0, 1);
      rig.skin.leftLeg.rotation.x = -0.32 - 0.3 * rising;
      rig.skin.rightLeg.rotation.x = 0.23;
      rig.skin.leftArm.rotation.z = -0.24;
      rig.skin.rightArm.rotation.z = 0.2;
    } else if (distance > 0.0001) this.walk.update(rig, distance / 2.3);
    else this.idle.update(rig, dt);
    joints.forEach((joint, i) => {
      joint.rotation.x = MathUtils.damp(old[i].x, joint.rotation.x, 20, dt);
      joint.rotation.y = MathUtils.damp(old[i].y, joint.rotation.y, 20, dt);
      joint.rotation.z = MathUtils.damp(old[i].z, joint.rotation.z, 20, dt);
    });
  }
}
