import { RULES } from "./content";
import type { Blast, Player } from "./types";
export const COMBAT = {
  health: 100,
  attack: 70,
  ownChargeDamage: 10,
  crateScore: 25,
  coverDurability: 2,
  killScore: 100,
  pickupScore: 10,
  firstUpgradeScore: 75,
  upgradeScoreStep: 50,
} as const;
export const powerTier = (power: number) =>
  power >= 130 ? 2 : power >= 85 ? 1 : 0;
/** Damage falls with actual distance from the explosive origin, within its rays. */
export function blastDamage(blast: Blast, target: Pick<Player, "x" | "z"> & {id?:string}, time = blast.expiresAt - (blast.duration ?? RULES.blastDuration)) {
  if (time >= blast.expiresAt) return 0;
  if (blast.source !== "throwable" && blast.ownerId === target.id) return COMBAT.ownChargeDamage;
  const distance = Math.hypot(
    target.x - (blast.originX ?? blast.x),
    target.z - (blast.originZ ?? blast.z),
  );
  const remaining = Math.max(0, Math.min(1,(blast.expiresAt-time)/(blast.duration ?? RULES.blastDuration)));
  return Math.max(
    1,
    Math.round(
      (blast.power ?? COMBAT.attack) * remaining *
        Math.max(0.25, 1 - (0.75 * distance) / ((blast.range ?? 2) + 1)),
    ),
  );
}
