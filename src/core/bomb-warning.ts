import { RULES } from "./content";
import type { Player } from "./types";

export const OWN_BOMB_COLOR = "#53ee83";
const OPPONENT_COLORS = ["#ff6557", "#ffb039", "#bb81ff"] as const;

export function bombGuideColor(players: readonly Player[], ownerId: string, viewerId: string) {
  if (ownerId === viewerId) return OWN_BOMB_COLOR;
  let opponent = 0;
  for (const p of players) {
    if (p.id === viewerId) continue;
    if (p.id === ownerId) return OPPONENT_COLORS[opponent % OPPONENT_COLORS.length];
    opponent++;
  }
  return OPPONENT_COLORS[0];
}
/** The last stretch of the fuse, where the beep and the blast-path warning turn urgent. */
const FINAL_COUNTDOWN = 0.8;
/** 0 until the final countdown starts, then rising to 1 at detonation. Sliding bombs stay at 0. */
export const finalCountdown = (detonateAt: number, time: number, sliding = false) =>
  sliding ? 0 : Math.max(0, Math.min(1, 1 - (detonateAt - time) / FINAL_COUNTDOWN));

/** Shared simulation-clock cadence keeps warning lights and audio synchronized. */
export function bombWarning(detonateAt: number, time: number, sliding = false) {
  if (sliding) {
    const cycles = time / 0.36;
    return { progress: 0.55, phase: cycles % 1, beat: Math.floor(cycles), lit: true, interval: 0.36 };
  }
  const progress = Math.max(0, Math.min(1, 1 - (detonateAt - time) / RULES.fuse));
  // Period falls continuously from 620 ms to 100 ms. Integrate its frequency
  // instead of multiplying time by a varying frequency (which causes jumps).
  const cycles = (-RULES.fuse / 0.52) * Math.log(1 - (0.52 / 0.62) * progress);
  return {
    progress,
    phase: cycles % 1,
    beat: Math.floor(cycles),
    lit: cycles % 1 < 0.38,
    interval: 0.62 - 0.52 * progress,
  };
}
