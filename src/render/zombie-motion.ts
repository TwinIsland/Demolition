import { MathUtils } from "three";
import type { Zombie } from "../core/types";
import { ZOMBIE_STRIKE } from "../core/zombies";
import type { MinecraftAvatar } from "./minecraft-avatar";

export function poseZombie(avatar:MinecraftAvatar, enemy:Zombie, time:number, rise:number) {
  avatar.motion.update(avatar.rig,enemy.x,enemy.z,time);
  const recoil = enemy.hurtAt === undefined ? 0 : 1-MathUtils.smoothstep(time-enemy.hurtAt,0,.16);
  avatar.rig.rotation.z = -.13*recoil;
  const {leftArm,rightArm,body,head} = avatar.rig.skin;
  leftArm.rotation.set(-1.30-(1-rise)*.75,0,-.06);
  rightArm.rotation.set(-1.40-(1-rise)*.5,0,.06);
  body.rotation.set(0,0,0);
  const attack = enemy.attack;
  if (!attack) return;
  const age = time-attack.at;
  const end = ZOMBIE_STRIKE.windup + ZOMBIE_STRIKE.recovery;
  if (age < 0 || age >= end) return;
  const windup = MathUtils.smoothstep(age,0,ZOMBIE_STRIKE.windup*.6);
  const swipe = MathUtils.smoothstep(age,ZOMBIE_STRIKE.windup*.6,ZOMBIE_STRIKE.windup);
  const release = 1-MathUtils.smoothstep(age,ZOMBIE_STRIKE.windup+.055,end);
  const lift = (windup-swipe)*release, hit = swipe*release;
  avatar.rotation.y = attack.yaw;
  rightArm.rotation.x += -.96*lift + .58*hit;
  leftArm.rotation.x += -.58*lift + .38*hit;
  rightArm.rotation.z += .28*lift - .23*hit;
  leftArm.rotation.z -= .17*lift - .12*hit;
  body.rotation.set(-.10*lift+.23*hit,.16*lift-.21*hit,0);
  head.rotation.x = -.06*lift+.15*hit;
}
