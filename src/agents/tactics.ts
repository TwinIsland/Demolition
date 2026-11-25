import { DIRECTIONS } from "../core/maps";
import { RULES } from "../core/content";
import type { Bomb, Difficulty, GameSnapshot, Player, Vec2 } from "../core/types";

/** Stateless tactical helpers for BotAgent. Everything here reads only the snapshot, so replays stay deterministic. */

export type Intent = "flee" | "loot" | "farm" | "hunt" | "heal" | "build";

/** Per-seat weights on the utility scores. Different seats play visibly different games. */
export interface Personality {
  hunt: number;
  loot: number;
  farm: number;
  caution: number;
  trap: number;
}
export const PERSONALITIES: Record<string, Personality> = {
  momo: { hunt: 1.35, loot: 0.85, farm: 0.8, caution: 0.8, trap: 1 },
  mint: { hunt: 0.8, loot: 1.4, farm: 1.25, caution: 1.1, trap: 0.8 },
  sunny: { hunt: 1, loot: 0.9, farm: 0.9, caution: 1.2, trap: 1.5 },
};
export const DEFAULT_PERSONALITY: Personality = { hunt: 1, loot: 1, farm: 1, caution: 1, trap: 1 };

/** Response curves in the style of the Infinite Axis Utility System: inputs and outputs are 0..1. */
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const linear = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));
export const logistic = (v: number, midpoint: number, steepness: number) =>
  1 / (1 + Math.exp(-steepness * (v - midpoint)));

/** Highest score wins; the current intent gets a bonus so the bot commits instead of dithering. */
export function chooseIntent(
  scores: Partial<Record<Intent, number>>,
  current?: Intent,
  inertia = 0.12,
): Intent | undefined {
  let best: Intent | undefined,
    bestScore = 0;
  for (const intent of Object.keys(scores) as Intent[]) {
    const score = (scores[intent] ?? 0) + (intent === current ? inertia : 0);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

/** Influence map: per-cell threat from opponents and zombies, plus a dead-end term. Higher is worse. */
export function threatField(s: Readonly<GameSnapshot>, self: Player, opponents: readonly Vec2[]) {
  const field = new Float32Array(s.size * s.size);
  for (let z = 0; z < s.size; z++)
    for (let x = 0; x < s.size; x++) {
      if (s.tiles[z][x] !== 0) continue;
      let threat = 0;
      for (const e of opponents) threat += Math.max(0, 1 - Math.hypot(e.x - x, e.z - z) / 6);
      for (const zombie of s.zombies)
        threat += 1.5 * Math.max(0, 1 - Math.hypot(zombie.x - x, zombie.z - z) / 3);
      const exits = DIRECTIONS.filter((d) => s.tiles[z + d.z]?.[x + d.x] === 0).length;
      if (exits <= 1) threat += 0.6;
      field[z * s.size + x] = threat;
    }
  return field;
}

/**
 * Pessimistic opponent model (Osogami & Takahashi 2019): the charge an opponent could plant right now.
 * Routes that stay safe with these added to the forecast cannot be sealed by a single enemy action.
 */
export function likelyCharges(
  s: Readonly<GameSnapshot>,
  self: Player,
  opponents: readonly Vec2[],
  reach = 4,
): Bomb[] {
  const bombs: Bomb[] = [];
  for (const [i, e] of opponents.entries()) {
    if (Math.hypot(e.x - self.x, e.z - self.z) > reach) continue;
    const x = Math.round(e.x),
      z = Math.round(e.z);
    if (s.tiles[z]?.[x] !== 0 || s.bombs.some((b) => b.x === x && b.z === z)) continue;
    const owner = s.players.find(
      (p) => p.alive && p.id !== self.id && Math.round(p.x) === x && Math.round(p.z) === z,
    );
    bombs.push({
      id: -100 - i,
      x,
      z,
      ownerId: owner?.id ?? "",
      range: owner?.range ?? RULES.baseRange,
      detonateAt: s.time + RULES.fuse,
      passThrough: owner ? [owner.id] : [],
    });
  }
  return bombs;
}

/**
 * Attack tokens ("kung-fu circle", Dawe 2013): only the closest `tokens` bots may hunt the human at once.
 * Ranking is a pure function of the snapshot, so bots agree without sharing state.
 */
export function mayHuntHuman(
  s: Readonly<GameSnapshot>,
  self: Player,
  human: Player | undefined,
  tokens: number,
) {
  if (!human?.alive) return true;
  const rank = s.players
    .filter((p) => p.alive && p.id !== human.id && p.id !== self.id)
    .filter((p) => {
      const mine = Math.hypot(self.x - human.x, self.z - human.z),
        theirs = Math.hypot(p.x - human.x, p.z - human.z);
      return theirs < mine || (theirs === mine && p.id < self.id);
    }).length;
  return rank < tokens;
}
export const huntTokens = (difficulty: Difficulty, bots: number) =>
  difficulty === "hard" ? Math.min(2, bots) : 1;

/** Prefer the score leader a little, so bots do not gang up on whoever is behind. */
export function targetWeight(s: Readonly<GameSnapshot>, target: Pick<Player, "id" | "score">) {
  const alive = s.players.filter((p) => p.alive);
  const top = Math.max(1, ...alive.map((p) => p.score));
  return 0.8 + (0.4 * target.score) / top;
}

/**
 * Dynamic difficulty (Hunicke 2005; Andrade et al. 2005): how well the human is doing against the field, 0..1.
 * The bot maps this onto reaction time and search width only; health and damage are never altered.
 */
export function humanAdvantage(s: Readonly<GameSnapshot>, human: Player | undefined) {
  if (!human) return 0.5;
  if (!human.alive) return 0;
  const bots = s.players.filter((p) => p.id !== human.id);
  if (!bots.length) return 0.5;
  const alive = bots.filter((p) => p.alive);
  const botHp = alive.reduce((n, p) => n + p.hp / p.maxHp, 0) / bots.length;
  const botScore = bots.reduce((n, p) => n + p.score, 0) / bots.length;
  const hp = human.hp / human.maxHp - botHp;
  const score = (human.score - botScore) / Math.max(100, human.score + botScore);
  return clamp01(0.5 + 0.5 * hp + 0.6 * score);
}
