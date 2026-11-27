import { blastDamage, COMBAT } from "../combat";
import { combatMessage } from "../combat-message";
import { eachOwned } from "../content";
import { ZOMBIE_STATS } from "../loot";
import { grantMutation } from "../mutations";
import { matchStats, type Blast, type GameSnapshot, type ItemId, type Player, type Zombie } from "../types";
import { COINS } from "../economy";
import { gainCredits } from "./building";
import type { SimContext } from "./context";
import { emit } from "./events";
import { dropZombieLoot } from "./loot";
import { gainScore } from "./progression";

/** Longest pause between shield impact events; never extends immunity past shield expiry. */
const SHIELD_IMPACT_INTERVAL = 0.38;
/** Share of damage dealt that the attacker earns as score. */
const DAMAGE_SCORE_RATE = 0.2;

/** Blast cells of one explosion share its id; a cell from an older snapshot stands alone. */
const explosionOf = (blast: Blast) => blast.explosionId ?? blast.id;

function markExplosion(s: GameSnapshot, explosion: number, list: "contactedBy" | "absorbedBy", id: string) {
  for (const cell of s.blasts) if (explosionOf(cell) === explosion) (cell[list] ??= []).push(id);
}

export function tickShields(ctx: SimContext, dt: number) {
  for (const p of ctx.state.players) {
    if (p.shield <= 0) continue;
    if (p.shield <= dt) endShield(ctx, p, "expired");
    else p.shield -= dt;
  }
}

function endShield(ctx: SimContext, p: Player, reason: "broken" | "expired") {
  p.shield = 0;
  emit(ctx, p, reason === "broken" ? "爆炸击碎了护盾" : "护盾已消散", {
    type: "shield-end",
    item: "shield",
    reason,
  });
}

function shieldBlocks(ctx: SimContext, p: Player) {
  if (p.shield <= 0) return false;
  // Rate-limit impact feedback, without extending immunity beyond shield expiry.
  p.invulnerableUntil = ctx.state.time + Math.min(SHIELD_IMPACT_INTERVAL, p.shield);
  emit(ctx, p, "护盾抵挡了伤害", { type: "hurt", blocked: true });
  return true;
}

/** Player-attributed damage: scores the attacker, and credits the kill when it is lethal. */
export function hurt(
  ctx: SimContext,
  p: Player,
  attackerId: string,
  amount: number,
  source: string,
  immunity: number,
  item?: ItemId,
) {
  const s = ctx.state;
  if (s.mode === "practice" && !p.bot) return;
  if (shieldBlocks(ctx, p)) return;
  p.invulnerableUntil = s.time + immunity;
  const damage = Math.min(p.hp, amount);
  p.hp = Math.max(0, p.hp - damage);
  matchStats(p).damageTaken += damage;
  const attacker = s.players.find((a) => a.id === attackerId);
  if (attacker && attacker.id !== p.id) matchStats(attacker).damageDealt += damage;
  if (attacker && attacker.id !== p.id && attacker.alive) {
    const points = Math.max(1, Math.round(damage * DAMAGE_SCORE_RATE));
    eachOwned(attacker, (m, n) => m.onDamageDealt?.(attacker, damage, n));
    gainScore(ctx, attacker, points);
    gainCredits(attacker, COINS.hit);
    emit(
      ctx,
      attacker,
      combatMessage("命中 {0} -{1} HP · +{2} 积分", p, damage, points),
      { type: "hit", item },
      p,
    );
  }
  emit(ctx, p, combatMessage("受到 {0} 点{1}伤害", damage, source), { type: "hurt", blocked: false });
  if (p.hp <= 0) {
    p.alive = false;
    matchStats(p).diedAt = s.time;
    p.offers = [];
    const killer = s.players.find((a) => a.id === attackerId)!;
    if (killer.id !== p.id) {
      killer.kills++;
      if (killer.alive) gainScore(ctx, killer, COMBAT.killScore);
      gainCredits(killer, COINS.kill);
    }
    emit(
      ctx,
      killer,
      killer.id === p.id
        ? combatMessage("{0} 被自己的炸药淘汰了", p)
        : combatMessage("{0} 淘汰了 {1}", killer, p),
      { type: "kill" },
    );
  }
}

/** Applies the strongest blast the player is standing in. One explosion hurts a player at most once. */
export function resolveBlastDamage(ctx: SimContext, p: Player) {
  const s = ctx.state;
  let strongest: Blast | undefined;
  let damage = 0;
  const contacts = new Set<number>();
  for (const blast of s.blasts) {
    if (Math.abs(blast.x - p.x) >= COMBAT.touchRadius || Math.abs(blast.z - p.z) >= COMBAT.touchRadius)
      continue;
    if (!blast.contactedBy?.includes(p.id)) contacts.add(explosionOf(blast));
    if (blast.absorbedBy?.includes(p.id)) continue;
    const amount = blastDamage(blast, p, s.time);
    if (amount > damage) {
      strongest = blast;
      damage = amount;
    }
  }
  if (contacts.size) {
    for (const cell of s.blasts) if (contacts.has(explosionOf(cell))) (cell.contactedBy ??= []).push(p.id);
    emit(ctx, p, "爆炸冲击", { type: "blast-contact" });
  }
  if (strongest && p.shield > 0) {
    endShield(ctx, p, "broken");
    // A blocked explosion stays blocked across its whole footprint and lifetime.
    markExplosion(s, explosionOf(strongest), "absorbedBy", p.id);
  } else if (strongest && p.invulnerableUntil <= s.time) {
    hurt(
      ctx,
      p,
      strongest.ownerId,
      damage,
      strongest.source === "missile" ? "导弹" : "爆炸",
      COMBAT.hitImmunity,
    );
    // An own bomb costs its self-damage once, however long the owner stays in it.
    if (strongest.ownerId === p.id && (strongest.source ?? "bomb") === "bomb")
      markExplosion(s, explosionOf(strongest), "absorbedBy", p.id);
  }
}

/** Score, a possible mutation, then loot. The RNG draws happen in exactly that order. */
export function rewardZombie(ctx: SimContext, zombie: Zombie, owner: Player, item?: ItemId) {
  const { score, mutationChance } = ZOMBIE_STATS[zombie.level];
  gainScore(ctx, owner, score);
  matchStats(owner).zombieKills++;
  gainCredits(owner, COINS.zombieKill[zombie.level]);
  emit(
    ctx,
    owner,
    combatMessage("击倒 Lv.{0} 僵尸 · +{1} 积分", zombie.level, score),
    { type: "hit", item, zombie: { id: zombie.id, level: zombie.level, outcome: "killed" } },
    zombie,
  );
  if (owner.alive && (zombie.gift || ctx.random() < mutationChance)) {
    const mutation = grantMutation(owner, ctx.random);
    emit(ctx, owner, combatMessage("获得{0}", mutation), { type: "mutation", mutation: mutation.id });
  }
  dropZombieLoot(ctx, zombie, owner);
}

/** Zombie contact damage has no attacker, so nobody scores and the elimination is unattributed. */
function zombieAttack(ctx: SimContext, p: Player, damage: number) {
  const s = ctx.state;
  if (p.invulnerableUntil > s.time || (s.mode === "practice" && !p.bot)) return;
  if (shieldBlocks(ctx, p)) return;
  p.invulnerableUntil = s.time + COMBAT.hitImmunity;
  matchStats(p).damageTaken += Math.min(p.hp, damage);
  p.hp = Math.max(0, p.hp - damage);
  emit(ctx, p, combatMessage("僵尸攻击 · -{0} HP", damage), { type: "hurt", blocked: false });
  if (!p.hp) {
    p.alive = false;
    matchStats(p).diedAt = s.time;
    p.offers = [];
    emit(ctx, p, combatMessage("{0} 被僵尸淘汰", p), { type: "kill" });
  }
}

export function stepZombies(ctx: SimContext, dt: number) {
  const s = ctx.state;
  ctx.undead.step(
    s,
    dt,
    ctx.random,
    ctx.nextId,
    (zombie, ownerId) =>
      rewardZombie(
        ctx,
        zombie,
        s.players.find((p) => p.id === ownerId)!,
      ),
    (p, damage) => zombieAttack(ctx, p, damage),
  );
}
