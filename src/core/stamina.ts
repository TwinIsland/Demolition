import { modifiedStat } from "./content";
import type { Player } from "./types";

export const STAMINA = {
  capacity: 100, drain: 25, regen: 18, delay: .85, restart: 20, speedFactor: 1.55,
} as const;

export function sprintSeconds(p: Player, requested: boolean, dt: number) {
  if (!requested || (!p.sprinting && p.stamina < STAMINA.restart)) return 0;
  return Math.min(dt, p.stamina / STAMINA.drain);
}

export function recoverOrSpend(p: Player, seconds: number, dt: number, time: number) {
  p.sprinting = seconds > 0;
  if (p.sprinting) {
    p.stamina = Math.max(0, p.stamina - seconds * STAMINA.drain);
    p.staminaRegenAt = time + STAMINA.delay;
  } else if (p.stamina < p.maxStamina && time > p.staminaRegenAt) {
    const regen = modifiedStat(p, "staminaRegen", STAMINA.regen, time);
    p.stamina = Math.min(p.maxStamina, p.stamina + regen * Math.min(dt,time - p.staminaRegenAt));
  }
}
