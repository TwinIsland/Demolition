import { RULES } from "./content";
import type { Blast, Player } from "./types";
export const COMBAT = {
  health: 100,
  attack: 70,
  /** Standing in your own blast costs this share of its power, and never less than the minimum. */
  ownBombDamageRate: 0.2,
  ownBombDamage: 10,
  crateScore: 25,
  coverDurability: 2,
  killScore: 100,
  pickupScore: 10,
  firstUpgradeScore: 75,
  upgradeScoreStep: 50,
  /** Centre distance, per axis for blasts and radial for items, at which a player touches them. */
  touchRadius: 0.55,
  /** Seconds of immunity after a blast or zombie hit. */
  hitImmunity: 1.3,
  /** Melee grants a much shorter window, so repeated swings still connect. */
  meleeImmunity: 0.3,
} as const;
export const powerTier = (power: number) => (power >= 130 ? 2 : power >= 85 ? 1 : 0);
/** Damage falls with actual distance from the blast origin, within its rays. */
export function blastDamage(
  blast: Blast,
  target: Pick<Player, "x" | "z"> & { id?: string },
  time = blast.expiresAt - (blast.duration ?? RULES.blastDuration),
) {
  if (time >= blast.expiresAt) return 0;
  if (blast.source !== "throwable" && blast.ownerId === target.id)
    return Math.max(
      COMBAT.ownBombDamage,
      Math.round((blast.power ?? COMBAT.attack) * COMBAT.ownBombDamageRate),
    );
  const distance = Math.hypot(target.x - (blast.originX ?? blast.x), target.z - (blast.originZ ?? blast.z));
  const remaining = Math.max(
    0,
    Math.min(1, (blast.expiresAt - time) / (blast.duration ?? RULES.blastDuration)),
  );
  return Math.max(
    1,
    Math.round(
      (blast.power ?? COMBAT.attack) *
        remaining *
        Math.max(0.25, 1 - (0.75 * distance) / ((blast.range ?? 2) + 1)),
    ),
  );
}
