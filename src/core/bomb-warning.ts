import { RULES } from "./content";
import type { Player } from "./types";

export const OWN_CHARGE_COLOR = "#53ee83";
const opponentColors = ["#ff6557","#ffb039","#bb81ff"] as const;

export function bombGuideColor(players:readonly Player[], ownerId:string, viewerId:string) {
  if (ownerId === viewerId) return OWN_CHARGE_COLOR;
  let opponent = 0;
  for (const p of players) {
    if (p.id === viewerId) continue;
    if (p.id === ownerId) return opponentColors[opponent % opponentColors.length];
    opponent++;
  }
  return opponentColors[0];
}
/** Shared simulation-clock cadence keeps warning lights and audio synchronized. */
export function bombWarning(detonateAt: number, time: number, sliding = false) {
  if (sliding) {
    const cycles = time/.36;
    return {progress:.55,phase:cycles%1,beat:Math.floor(cycles),lit:true,interval:.36};
  }
  const progress = Math.max(
    0,
    Math.min(1, 1 - (detonateAt - time) / RULES.fuse),
  );
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
