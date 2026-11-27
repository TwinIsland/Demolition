import { modeRules } from "../match-modes";
import type { SimContext } from "./context";

/**
 * Passive health regeneration for modes that enable it. Any loss of health restarts the delay;
 * after it, health climbs steadily to the maximum. Health stays a whole number: the fraction is
 * carried over. The firestorm at the end of a match still allows no recovery.
 */
export function regenerate(ctx: SimContext, dt: number) {
  const s = ctx.state,
    rule = modeRules(s.mode).healthRegen;
  if (!rule || s.zone?.final) return;
  for (const p of s.players) {
    if (!p.alive) continue;
    // Lessons set health deliberately; the bandage demonstration must wait for the player.
    if (s.storyTutorial && !p.bot) continue;
    const track = ctx.regen.get(p.id) ?? { hp: p.hp, from: 0, owed: 0 };
    ctx.regen.set(p.id, track);
    if (p.hp < track.hp) {
      track.from = s.time + rule.delay;
      track.owed = 0;
    } else if (p.hp < p.maxHp && s.time >= track.from) {
      track.owed += rule.rate * dt;
      const whole = Math.floor(track.owed);
      track.owed -= whole;
      p.hp = Math.min(p.maxHp, p.hp + whole);
    }
    track.hp = p.hp;
  }
}
