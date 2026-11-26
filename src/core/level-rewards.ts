import type { Player } from "./types";

/** A fixed stat gain granted by reaching a level, on top of that level's perk offer. */
export type LevelGain = "capacity" | "maxHp" | "range" | "attack";

/** Size of each gain, and the ceiling it shares with every other source of that stat. */
export const LEVEL_GAINS = {
  capacity: { amount: 1, cap: 7 },
  maxHp: { amount: 10, cap: Infinity },
  range: { amount: 1, cap: 5 },
  attack: { amount: 10, cap: Infinity },
} as const satisfies Record<LevelGain, { amount: number; cap: number }>;

/** Gains by level reached. Capacity comes early, so every operator soon carries a third charge. */
const LEVEL_TABLE: Readonly<Record<number, readonly LevelGain[]>> = {
  2: ["capacity"],
  3: ["maxHp"],
  4: ["capacity"],
  5: ["range"],
  6: ["capacity", "maxHp"],
  7: ["attack"],
  8: ["capacity", "maxHp"],
  9: ["range"],
};
/** Past the table every level still toughens the operator a little. */
const LATE_LEVEL: readonly LevelGain[] = ["maxHp"];

export const levelGains = (level: number): readonly LevelGain[] =>
  LEVEL_TABLE[level] ?? (level > 9 ? LATE_LEVEL : []);

/**
 * Applies the gains of `level` and returns the ones that took effect. A stat already at its
 * ceiling is skipped. Levelling never heals: extra maximum health arrives empty.
 */
export function applyLevelGains(p: Player, level: number): LevelGain[] {
  return levelGains(level).filter((gain) => {
    const { amount, cap } = LEVEL_GAINS[gain];
    if (p[gain] >= cap) return false;
    p[gain] = Math.min(cap, p[gain] + amount);
    return true;
  });
}

/** Combat-feed and banner wording of one gain; the keys are translated by the locale tables. */
export const LEVEL_GAIN_TEXT: Record<LevelGain, string> = {
  capacity: "炸弹容量 +1",
  maxHp: "生命上限 +10",
  range: "爆炸范围 +1",
  attack: "攻击力 +10",
};
