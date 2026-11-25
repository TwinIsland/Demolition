import { COMBAT } from "../combat";
import { modeRules } from "../match-modes";
import { combatMessage } from "../combat-message";
import { modifiedStat, perkById, rollPerks, SKILLS, SLOT_LIMIT } from "../content";
import type { PerkId, Player, PlayerInput, SkillId } from "../types";
import type { SimContext } from "./context";
import { emit } from "./events";
import { effectContext } from "./match";

/** A run of all-silver offers this long guarantees a rarer card in the next one. */
const SILVER_STREAK_LIMIT = 2;

/** Score doubles as experience; crossing a threshold rolls a perk offer. */
export function gainScore(ctx: SimContext, p: Player, value: number) {
  p.score += value;
  p.xp += value;
  offerUpgrades(ctx, p);
}

function offerUpgrades(ctx: SimContext, p: Player) {
  while (p.xp >= p.nextLevel) {
    p.level++;
    p.xp -= p.nextLevel;
    p.nextLevel += Math.round(COMBAT.upgradeScoreStep * modeRules(ctx.state.mode).upgradePace);
    const history = ctx.offerHistory.get(p.id) ?? { previous: [], silverHands: 0 };
    p.offers = rollPerks(
      p,
      ctx.random,
      history.previous,
      history.silverHands >= SILVER_STREAK_LIMIT,
      !!ctx.map.randomizeTerrain,
    );
    history.previous = p.offers;
    history.silverHands = p.offers.every((id) => perkById(id)?.tier === "silver")
      ? history.silverHands + 1
      : 0;
    ctx.offerHistory.set(p.id, history);
    emit(ctx, p, combatMessage("升到 Lv.{0}", p.level), { type: "level" });
  }
}

/** Pre-match shop: refund first, then buy, so one command can swap a skill. */
export function applyShopCommand(
  p: Player,
  { buySkill: buy, refundSkill: refund }: Pick<PlayerInput, "buySkill" | "refundSkill">,
) {
  if (refund && p.skills.includes(refund)) {
    p.credits += SKILLS[refund].price;
    p.skills = p.skills.filter((id) => id !== refund);
  }
  if (
    buy &&
    Object.prototype.hasOwnProperty.call(SKILLS, buy) &&
    !p.skills.includes(buy) &&
    p.skills.length < SLOT_LIMIT &&
    p.credits >= SKILLS[buy].price
  ) {
    p.skills.push(buy);
    p.credits -= SKILLS[buy].price;
  }
}

/** Takes one card from the current offer. Anything not on offer is ignored. */
export function choosePerk(ctx: SimContext, p: Player, chosen: PerkId | undefined) {
  if (!chosen || !p.alive || !p.offers.includes(chosen)) return;
  perkById(chosen)?.onAcquire?.(p, effectContext(ctx, p));
  p.perks.push(chosen);
  emit(ctx, p, combatMessage("获得{0}", perkById(chosen)!), { type: "perk", perk: chosen });
  p.offers = [];
}

/** Spends one owned copy of an activatable perk, if the perk accepts the use. */
export function usePerk(ctx: SimContext, p: Player, id: PerkId) {
  const slot = p.perks.indexOf(id),
    perk = perkById(id);
  if (
    slot >= 0 &&
    perk?.use &&
    (!perk.canUse || perk.canUse(p, ctx.state)) &&
    perk.use(p, effectContext(ctx, p))
  ) {
    p.perks.splice(slot, 1);
    emit(ctx, p, combatMessage("启动{0}", perk), { type: "perk-use", perk: id });
  }
}

/** Casts an owned active skill that is off cooldown, or toggles it off. */
export function activateSkill(ctx: SimContext, p: Player, skill: SkillId, inputTime: number) {
  const s = ctx.state,
    def = SKILLS[skill];
  if (
    !def?.activate ||
    def.passive ||
    !p.skills.includes(skill) ||
    (p.cooldowns[skill] ?? 0) > s.time ||
    (def.canActivate && !def.canActivate(p, inputTime))
  )
    return;
  p.cooldowns[skill] = s.time + modifiedStat(p, "cooldown", def.cooldown, s.time);
  def.activate(p, s, modifiedStat(p, `duration:${skill}`, def.duration, s.time));
  const switchedOff = def.isActive && !def.isActive(p, s.time);
  emit(ctx, p, combatMessage(switchedOff ? "关闭{0}" : "启动{0}", def), { type: "skill", skill });
}
