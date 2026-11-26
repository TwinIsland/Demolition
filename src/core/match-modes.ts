import { COMBAT } from "./combat";
import { RULES } from "./content";
import { STAMINA } from "./stamina";

/** Starting loadout and progression pace of a match mode. */
export interface ModeRules {
  health: number;
  attack: number;
  /** Cells per second. */
  speed: number;
  range: number;
  capacity: number;
  stamina: number;
  /** Coins for the pre-match shop; what is left over carries into the match. */
  credits: number;
  /** Multiplier on the score needed for each perk offer. */
  upgradePace: number;
  /** Everyone plays the whole match in the overhead view. */
  overhead?: boolean;
  /** Health that comes back by itself: `rate` per second, once `delay` seconds have passed unhurt. */
  healthRegen?: { delay: number; rate: number };
}

const STANDARD: ModeRules = {
  health: COMBAT.health,
  attack: COMBAT.attack,
  speed: RULES.baseSpeed,
  range: RULES.baseRange,
  capacity: RULES.baseCapacity,
  stamina: STAMINA.capacity,
  credits: RULES.startingCredits,
  upgradePace: 1,
};

/**
 * Wild mode is a separate preset, so tuning it never touches the standard balance: everyone
 * starts oversized, with far more health to burn through and perk offers twice as often.
 */
const WILD: ModeRules = {
  health: 300,
  attack: 90,
  speed: 3.2,
  range: 4,
  capacity: 10,
  stamina: 160,
  credits: 260,
  upgradePace: 0.5,
  healthRegen: { delay: 5, rate: 12 },
};

/** Classic mode: the standard balance, played entirely from above like the games that inspired it. */
const CLASSIC: ModeRules = { ...STANDARD, overhead: true };

export const MATCH_MODES = {
  freeForAll: { name: "自由乱斗", available: true, rules: STANDARD },
  classic: { name: "经典模式", available: true, rules: CLASSIC },
  practice: { name: "练习模式", available: true, rules: STANDARD },
  carnival: { name: "狂野模式", available: true, rules: WILD },
} as const;
export type MatchMode = keyof typeof MATCH_MODES;
export const DEFAULT_MODE: MatchMode = "freeForAll";
export const modeRules = (mode: MatchMode | undefined): ModeRules => MATCH_MODES[mode ?? DEFAULT_MODE].rules;
