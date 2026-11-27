import { STAMINA } from "../core/stamina";
import { ITEMS, modifiedStat, RULES, SKILLS, perkById } from "../core/content";
import { blastCells, clearSight, KICK, slideBlocked } from "../core/geometry";
import { DIRECTIONS, seededRandom } from "../core/maps";
import { canPlace, placementRadius } from "../core/placement";
import { SUMMON_TIME } from "../core/zombies";
import { areAllies, idleInput, inTacticalView, isBystander, isCloaked } from "../core/types";
import type { Personality } from "./tactics";
import type {
  AgentContext,
  Bomb,
  Difficulty,
  GameSnapshot,
  ItemId,
  PerkId,
  Player,
  PlayerAgent,
  SkillId,
  Vec2,
} from "../core/types";
import { canBuild } from "../core/systems/building";
import { supplyPrice, supplyRefusal } from "../core/systems/supply";
import { ZONE, zoneIgnitesIn } from "../core/zone";
import { BombForecast } from "./bomb-forecast";
import {
  approachField,
  DEFAULT_PERSONALITY,
  humanAdvantage,
  huntTokens,
  LARGE_ARENA,
  likelyCharges,
  mayHuntHuman,
  PERSONALITIES,
  targetWeight,
  threatField,
} from "./tactics";
import { safeRoute } from "./tactical-route";

type BotSettings = { think: number; depth: number; candidates: number; recovery: number; throwDelay: number };
const BOT_SETTINGS: Record<Exclude<Difficulty, "adaptive">, BotSettings> = {
  easy: { think: 0.48, depth: 5, candidates: 1, recovery: 1.6, throwDelay: 1.4 },
  normal: { think: 0.38, depth: 7, candidates: 2, recovery: 1.45, throwDelay: 1.3 },
  hard: { think: 0.18, depth: 10, candidates: 5, recovery: 0.65, throwDelay: 0.7 },
};
/** The adaptive tier slides between these as the human falls behind or pulls ahead. */
const ADAPTIVE_RANGE = { low: BOT_SETTINGS.easy, high: { ...BOT_SETTINGS.hard, think: 0.24, recovery: 0.8 } };
function adaptiveSettings(skill: number): BotSettings {
  const mix = (key: keyof BotSettings) =>
    ADAPTIVE_RANGE.low[key] + (ADAPTIVE_RANGE.high[key] - ADAPTIVE_RANGE.low[key]) * skill;
  return {
    think: mix("think"),
    depth: Math.round(mix("depth")),
    candidates: Math.round(mix("candidates")),
    recovery: mix("recovery"),
    throwDelay: mix("throwDelay"),
  };
}
/** How fast the adaptive tier follows the human's standing, per decision. */
const ADAPTIVE_RATE = 0.03;
/** Shop preferences per seat; a seeded jitter reorders close calls so loadouts vary between matches. */
const SHOP_TASTE: Record<string, Record<string, number>> = {
  momo: { kick: 1.3, medic: 0.9, veil: 0.9, cloak: 0.7, scan: 0.5, detonator: 0 },
  mint: { medic: 1.3, cloak: 1, scan: 0.9, kick: 0.7, veil: 0.5, detonator: 0 },
  sunny: { scan: 1.2, veil: 1.2, kick: 1, cloak: 0.8, medic: 0.8, detonator: 0 },
};
/** Coins a bot keeps back when shopping, so it can still afford a bandage later. */
const SUPPLY_RESERVE = 20;
/**
 * Buys healing first, then a shield, then throwables once a reserve of coins is left over.
 */
function supplyWish(p: Readonly<Player>, s: Readonly<GameSnapshot>): ItemId | undefined {
  const spare = (id: ItemId, reserve: number) =>
    !supplyRefusal(s, p, id) && p.credits - supplyPrice(p, id) >= reserve && !(p.inventory[id] ?? 0);
  if (p.hp < p.maxHp * 0.55 && spare("bandage", 0)) return "bandage";
  const reserve = SUPPLY_RESERVE;
  if (p.shield <= 0 && spare("shield", reserve)) return "shield";
  if (spare("grenade", reserve * 2)) return "grenade";
  if (spare("molotov", reserve * 2)) return "molotov";
  return undefined;
}
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const cell = (p: Vec2) => ({ x: Math.round(p.x), z: Math.round(p.z) });
const same = (a: Vec2, b: Vec2) => a.x === b.x && a.z === b.z;
const NORMAL_WALK_SCALE = 0.8;
const bearing = (from: Vec2, to: Vec2) => Math.atan2(from.x - to.x, from.z - to.z);
const turnDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const aimedAt = (p: Player, point: Vec2) => Math.abs(turnDelta(p.yaw, bearing(p, point))) < 0.42;
type Contact = Vec2 & { id: string; dx: number; dz: number; seen: number; readyAt: number };
type ThrowPlan = { kind: "grenade" | "molotov"; targetId: string | number; landing: Vec2; readyAt: number };

function visible(s: Readonly<GameSnapshot>, p: Player, other: Player, limitedView: boolean) {
  if (p.scanUntil > s.time) return true;
  if (isCloaked(other, s.time)) return false;
  if (limitedView) {
    const distance = dist(p, other);
    return (
      distance <= 9 &&
      (distance < 1.25 || Math.abs(turnDelta(p.yaw, bearing(p, other))) < (Math.PI * 5) / 12) &&
      clearSight(s, p, other)
    );
  }
  return true;
}

function upgrade(p: Player) {
  const weight = (id: PerkId) => {
    const perk = perkById(id);
    return perk?.aiPriority?.(p) ?? (perk?.tier === "gold" ? 6 : 4);
  };
  return p.offers.reduce((a, b) => (weight(a) >= weight(b) ? a : b));
}

export class BotAgent implements PlayerAgent {
  private target?: Vec2;
  private contacts = new Map<string, Contact>();
  private nextThink = 0;
  private nextBomb = 0;
  private pendingThrow?: ThrowPlan;
  private facingTarget?: Vec2;
  private radarContact?: Vec2;
  private nextRadar = 0;
  private sprintUntil = 0;
  private nextSprint = 0;
  private fleeing = false;
  /** Adaptive tier: smoothed estimate of how well the human is doing, 0..1. */
  private humanLead = 0.5;
  private readonly personality: Personality;
  constructor(readonly playerId: string) {
    this.personality = PERSONALITIES[playerId] ?? DEFAULT_PERSONALITY;
    this.reset();
  }
  reset() {
    this.target = undefined;
    this.contacts.clear();
    this.nextThink = this.playerId === "mint" ? 0.07 : this.playerId === "sunny" ? 0.13 : 0.02;
    this.nextBomb = 0.8;
    this.pendingThrow = undefined;
    this.facingTarget = undefined;
    this.radarContact = undefined;
    this.nextRadar = 0;
    this.sprintUntil = this.nextSprint = 0;
    this.fleeing = false;
    this.humanLead = 0.5;
  }
  private observe(s: Readonly<GameSnapshot>, p: Player, limitedView: boolean, reaction: number) {
    for (const enemy of s.players) {
      if (enemy.id === p.id || areAllies(p, enemy) || isBystander(enemy)) {
        this.contacts.delete(enemy.id);
        continue;
      }
      const last = this.contacts.get(enemy.id);
      if (!enemy.alive) {
        this.contacts.delete(enemy.id);
        continue;
      }
      if (!visible(s, p, enemy, limitedView)) {
        if (last && (last.seen < last.readyAt || s.time - last.seen > (limitedView ? 0.75 : 1.4)))
          this.contacts.delete(enemy.id);
        continue;
      }
      const elapsed = last ? Math.max(0.001, s.time - last.seen) : 1;
      this.contacts.set(enemy.id, {
        id: enemy.id,
        x: enemy.x,
        z: enemy.z,
        seen: s.time,
        readyAt: last?.readyAt ?? s.time + reaction,
        dx: last ? (enemy.x - last.x) / elapsed : 0,
        dz: last ? (enemy.z - last.z) / elapsed : 0,
      });
    }
    return [...this.contacts.values()].filter((contact) => contact.seen >= contact.readyAt);
  }
  private glanceAtRadar(s: Readonly<GameSnapshot>, p: Player, variation: number) {
    if (s.time < this.nextRadar) return;
    this.nextRadar = s.time + 1.8 + 0.8 * variation;
    let nearest: Player | undefined;
    for (const other of s.players) {
      // A cloaked operator drops off the radar too.
      if (
        other.id !== p.id &&
        !areAllies(p, other) &&
        !isBystander(other) &&
        other.alive &&
        !isCloaked(other, s.time) &&
        (!nearest || dist(p, other) < dist(p, nearest))
      )
        nearest = other;
    }
    // A sampled radar tile guides navigation. Only confirmed sightings can direct an attack.
    this.radarContact = nearest ? cell(nearest) : undefined;
  }
  decide({ state: s, self: p, dt }: AgentContext) {
    const input = idleInput(p.yaw),
      difficulty = p.difficulty ?? s.difficulty ?? "normal",
      human = s.players.find((other) => !other.bot),
      config = difficulty === "adaptive" ? adaptiveSettings(this.humanLead) : BOT_SETTINGS[difficulty];
    let weaponAim: Vec2 | undefined;
    if (p.offers.length) input.choosePerk = upgrade(p);
    input.usePerk = p.perks.find((id) => perkById(id)?.aiShouldUse?.(p, s));
    if (s.phase === "countdown") {
      // Leave enough coins for one crate; everything else goes on the seat's favourite skills.
      const taste = SHOP_TASTE[this.playerId] ?? {},
        seat = s.players.findIndex((other) => other.id === p.id);
      const appeal = (id: SkillId, index: number) =>
        (taste[id] ?? 0.6) *
        (0.7 + 0.6 * seededRandom(s.seed ^ Math.imul(seat + 1, 40503) ^ (index * 7919))());
      input.buySkill = Object.keys(SKILLS)
        .map((id, index) => ({ id, appeal: appeal(id, index) }))
        .filter(
          ({ id, appeal }) =>
            appeal > 0 && !p.skills.includes(id) && p.credits - SKILLS[id].price >= SUPPLY_RESERVE,
        )
        .sort((a, b) => b.appeal - a.appeal || a.id.localeCompare(b.id, "en"))[0]?.id;
      return input;
    }
    if (s.phase !== "playing") return input;
    input.buyItem = supplyWish(p, s);
    // Normal and adaptive bots see, turn and react like a person; easy and hard keep their own rules.
    const normal = difficulty === "normal" || difficulty === "adaptive";
    const overhead = inTacticalView(p, s.time);
    const walkScale = normal ? NORMAL_WALK_SCALE : 1;
    if (s.time >= this.nextThink) {
      // Per-player timing varies between decisions and can be reproduced from the match seed.
      const variation = normal
        ? seededRandom(
            s.seed ^
              Math.imul(s.players.findIndex((other) => other.id === p.id) + 1, 2654435761) ^
              Math.round(s.time / RULES.step),
          )()
        : 0;
      this.nextThink = s.time + config.think + 0.14 * variation;
      const recovery = config.recovery + 0.22 * variation;
      const enemies = this.observe(s, p, normal, normal ? 0.28 + 0.16 * variation : 0);
      if (normal) this.glanceAtRadar(s, p, variation);
      this.humanLead += (humanAdvantage(s, human) - this.humanLead) * ADAPTIVE_RATE;
      // Attack tokens: only the closest bots press the human; the others find something else to do.
      const bots = s.players.filter((other) => other.alive && other.bot).length;
      const huntsHuman = mayHuntHuman(s, p, human, huntTokens(difficulty, bots));
      const hunted = (contact: Vec2 & { id?: string }) => huntsHuman || contact.id !== human?.id;
      const seenOrRadar = enemies.length || !this.radarContact ? enemies : [this.radarContact];
      const navigationContacts = seenOrRadar.filter(
        (contact) => huntsHuman || !human || dist(contact, human) > 0.75,
      );
      // Pessimistic opponent model: careful bots also avoid cells a nearby opponent could seal.
      const wary = difficulty === "hard" || (difficulty !== "easy" && p.hp < p.maxHp * 0.6);
      const f = new BombForecast(s, wary ? likelyCharges(s, p, enemies, 3) : undefined, undefined, p.id),
        here = cell(p);
      const threat = threatField(s, p, enemies),
        frailty = 1 - p.hp / p.maxHp,
        mood = this.personality;
      // On a large arena the fight can be far outside the route search: follow walking distance.
      const approach =
        s.size >= LARGE_ARENA && navigationContacts.length ? approachField(s, navigationContacts) : undefined;
      const reach = Math.max(15, approach ? s.size * 1.5 : 0);
      const value = (c: Vec2) => {
        const item = s.items.find((i) => same(i, c));
        const loot = item ? (ITEMS[item.kind].aiPickupValue?.(p) ?? 19) : 0;
        const cover = DIRECTIONS.filter((d) => s.tiles[c.z + d.z]?.[c.x + d.x] === 2).length;
        const nearest = approach
          ? Math.min(reach, approach[c.z * s.size + c.x])
          : Math.min(15, ...navigationContacts.map((e) => dist(e, c)));
        const undead = Math.min(6, ...s.zombies.map((z) => dist(z, c)));
        // The zone pulls everyone inward well before a ring ignites.
        const ignites = s.zone ? zoneIgnitesIn(s.size, c, s.time, s.duration) : Infinity;
        const zonePull = Math.max(0, ZONE.warning + 10 - ignites) * 1.6;
        return (
          loot * mood.loot +
          cover * 2.8 * mood.farm -
          nearest * 1.1 * mood.hunt -
          Math.max(0, 2.5 - undead) * 8 -
          threat[c.z * s.size + c.x] * 5 * frailty * mood.caution -
          zonePull
        );
      };
      const route = safeRoute(s, p, f, config.depth, value, false, walkScale);
      this.target =
        route?.first ??
        DIRECTIONS.map((d) => ({ x: here.x + d.x, z: here.z + d.z })).find(
          (c) =>
            s.tiles[c.z]?.[c.x] === 0 && !f.occupied(c.x, c.z, 0, 0.4) && !f.burning(c.x, c.z, 0.15, 0.65),
        ) ??
        here;
      // Targeted perks aim at what the bot has actually seen, so a cloaked operator is safe from them.
      for (const id of new Set(p.perks)) {
        const perk = perkById(id);
        const aim = perk?.targeted && (!perk.canUse || perk.canUse(p, s)) && perk.aiTarget?.(p, s, enemies);
        if (aim) {
          input.usePerk = id;
          input.perkTarget = aim;
          break;
        }
      }
      const ready = (id: SkillId) => p.skills.includes(id) && p.cooldowns[id] <= s.time;
      let bestPriority = 0;
      for (const id of p.skills) {
        const skill = SKILLS[id];
        if (!ready(id) || !skill?.aiCastPriority || (skill.canActivate && !skill.canActivate(p, s.time)))
          continue;
        const priority = skill.aiCastPriority(p, s.time, enemies);
        if (priority > bestPriority) {
          input.activateSkill = id;
          bestPriority = priority;
        }
      }
      this.fleeing = f.burning(here.x, here.z, 0, 1.4) || s.zombies.some((z) => dist(z, p) < 3);
      if (normal && this.fleeing && s.time >= this.nextSprint && p.stamina >= STAMINA.restart) {
        this.sprintUntil = s.time + 0.6 + 0.22 * variation;
        this.nextSprint = this.sprintUntil + 1.2;
      }
      if (!overhead && this.fleeing && !p.shield && p.inventory.shield > 0 && ITEMS.shield?.onUse) {
        input.equip = "shield";
        input.useEquipment = true;
      } else if (!overhead && p.maxHp - p.hp >= 30 && p.inventory.bandage > 0) {
        input.equip = "bandage";
        input.useEquipment = true;
      }
      const knife = ITEMS.knife?.melee;
      if (!overhead && !input.useEquipment && knife && (p.cooldowns["equipment:knife"] ?? 0) <= s.time) {
        // Knives are for clearing zombies, never for rushing an operator.
        weaponAim = s.zombies.find((enemy) => dist(enemy, p) <= knife.reach && clearSight(s, p, enemy));
        if (weaponAim) {
          input.equip = "knife";
          input.useEquipment = !normal || (p.equipped === "knife" && aimedAt(p, weaponAim));
        }
      }
      if (
        !input.useEquipment &&
        !weaponAim &&
        s.time >= this.nextBomb &&
        !f.burning(here.x, here.z, 0, 0.7)
      ) {
        const plan = overhead
          ? undefined
          : this.planThrow(s, p, enemies, config.throwDelay + 0.18 * variation);
        this.pendingThrow = plan;
        if (plan) {
          input.equip = plan.kind;
          weaponAim = plan.landing;
          if (s.time >= plan.readyAt && (!normal || aimedAt(p, plan.landing))) {
            input.useEquipment = true;
            input.aimTarget = plan.landing;
            input.throwMode = "lob";
            this.pendingThrow = undefined;
            this.nextBomb = s.time + recovery;
          }
        }
        const tactic = !plan && this.attack(s, p, enemies, difficulty, config, hunted);
        if (tactic) {
          this.target = tactic.first;
          if (overhead && !tactic.kick) {
            // Overhead, the bomb drops where the bot stands.
            input.plantHere = same(cell(p), tactic.target);
          } else if (!tactic.kick) {
            input.equip = "bomb";
            if (normal && dist(p, tactic.target) > 0.6) weaponAim = tactic.target;
            input.useEquipment = !weaponAim || aimedAt(p, weaponAim);
            if (input.useEquipment) input.aimTarget = tactic.target;
          }
          if (tactic.kick)
            this.nextThink =
              s.time + Math.max(config.think, (dist(p, tactic.target) - 0.72) / p.speed + KICK.windup + 0.08);
          if (input.useEquipment || input.plantHere || tactic.kick) this.nextBomb = s.time + recovery;
        }
      } else this.pendingThrow = undefined;
      const site = this.planBuild(s, p, enemies, f);
      if (site && !input.useEquipment && !input.plantHere) {
        weaponAim = site;
        input.build = true;
        input.buildTarget = site;
      }
      this.facingTarget = normal ? weaponAim : undefined;
    }
    if (this.target) {
      let dx = this.target.x - p.x,
        dz = this.target.z - p.z;
      // Center in the corridor before turning across a solid corner.
      if (Math.abs(dx) > 0.5 && Math.abs(dz) > 0.04 && Math.abs(dz) < 0.5) dx = 0;
      else if (Math.abs(dz) > 0.5 && Math.abs(dx) > 0.04 && Math.abs(dx) < 0.5) dz = 0;
      const d = Math.hypot(dx, dz);
      if (d > 0.015) {
        input.sprint = this.fleeing && (!normal || s.time < this.sprintUntil);
        const pace = input.sprint ? STAMINA.speedFactor : 1;
        const scale = walkScale / Math.max(d, p.speed * pace * walkScale * dt);
        input.moveX = dx * scale;
        input.moveZ = dz * scale;
        input.yaw = Math.atan2(-dx, -dz);
      }
    }
    if (this.pendingThrow?.kind === "grenade") weaponAim = this.pendingThrow.landing;
    const standing = !input.moveX && !input.moveZ;
    const lookTarget = weaponAim ?? this.facingTarget ?? (normal && standing ? this.radarContact : undefined);
    if (lookTarget) input.yaw = bearing(p, lookTarget);
    if (normal) {
      const maxTurn = Math.PI * dt;
      input.yaw = p.yaw + Math.max(-maxTurn, Math.min(maxTurn, turnDelta(p.yaw, input.yaw)));
    }
    return input;
  }

  private planThrow(
    s: Readonly<GameSnapshot>,
    p: Player,
    contacts: Contact[],
    delay: number,
  ): ThrowPlan | undefined {
    // A grenade for the burst; otherwise a Molotov to burn the target out of its position.
    const kind = p.inventory.grenade ? "grenade" : p.inventory.molotov ? "molotov" : undefined;
    if (!kind) return;

    const threats = [
      ...contacts.filter((e) => e.seen === s.time),
      ...s.zombies.filter((z) => z.spawnAt === undefined || s.time >= z.spawnAt + SUMMON_TIME),
    ].filter((e) => p.scanUntil > s.time || clearSight(s, p, e));
    const old = this.pendingThrow;
    const reachable = (landing: Vec2) => dist(landing, p) > 2.7 && canPlace(s, p, landing, kind, "lob");
    const inRange = threats.filter((e) => reachable(cell(e)));
    const enemy = inRange.find((e) => e.id === old?.targetId) ?? inRange[0];
    if (!enemy) return;
    if (old?.kind === kind && old.targetId === enemy.id && reachable(old.landing)) return old;
    // Commit to the observed tile so strafing after the windup starts can beat the throw.
    return { kind, targetId: enemy.id, landing: cell(enemy), readyAt: s.time + delay };
  }

  /**
   * Defensive building: wall off a lane that a zombie or, when hurt, an opponent is coming down.
   * Only when the bot keeps another way out and the cell is safe to stand next to.
   */
  private planBuild(s: Readonly<GameSnapshot>, p: Player, enemies: Contact[], f: BombForecast) {
    if (inTacticalView(p, s.time) || p.crates <= 0) return;
    const here = cell(p);
    if (f.burning(here.x, here.z, 0, 0.5)) return;
    const hurt = p.hp < p.maxHp * 0.5;
    const threats: Vec2[] = [
      ...s.zombies.filter((z) => z.spawnAt === undefined || s.time >= z.spawnAt + SUMMON_TIME),
      ...(hurt ? enemies : []),
    ];
    const exits = DIRECTIONS.map((d) => ({ x: here.x + d.x, z: here.z + d.z })).filter(
      (c) => s.tiles[c.z]?.[c.x] === 0,
    );
    if (exits.length < 2) return;
    for (const threat of threats) {
      const distance = dist(threat, p);
      if (distance < 1.3 || distance > 3.2 || !clearSight(s, p, threat)) continue;
      const dx = threat.x - p.x,
        dz = threat.z - p.z;
      // The threat must be coming straight down a lane the bot stands in.
      if (Math.min(Math.abs(dx), Math.abs(dz)) > 0.35) continue;
      const site =
        Math.abs(dx) > Math.abs(dz)
          ? { x: here.x + Math.sign(dx), z: here.z }
          : { x: here.x, z: here.z + Math.sign(dz) };
      if (canBuild(s, p, site)) return site;
    }
  }

  private attack(
    s: Readonly<GameSnapshot>,
    p: Player,
    enemies: Contact[],
    difficulty: Difficulty,
    config: BotSettings,
    hunted: (contact: Contact) => boolean,
  ) {
    const here = cell(p),
      hard = difficulty === "hard",
      overhead = inTacticalView(p, s.time);
    const radius = difficulty === "easy" ? 0 : Math.floor(placementRadius(p, s.time));
    // Overhead the only legal cell is the one underfoot.
    const placements: Vec2[] = [];
    if (overhead) placements.push(here);
    else
      for (let z = here.z - radius; z <= here.z + radius; z++)
        for (let x = here.x - radius; x <= here.x + radius; x++) placements.push({ x, z });
    const choices: { bomb: Bomb; kick: boolean; score: number; first?: Vec2 }[] = [];
    const scoreHit = (cells: Vec2[], ownerId = p.id) => {
      const hits = (c: Vec2) => cells.some((hit) => same(hit, cell(c)));
      let value = cells.filter((c) => s.tiles[c.z][c.x] === 2).length * 3;
      for (const z of s.zombies) if (hits(z)) value += 3 + z.level * 2;
      for (const e of enemies) {
        if (e.id === ownerId) continue;
        // Bots without a token still take a free hit, but do not plan around the human.
        const opponent = s.players.find((other) => other.id === e.id);
        const worth =
          (hunted(e) ? 1 : 0.35) * (opponent ? targetWeight(s, opponent) : 1) * this.personality.hunt;
        if (hits(e)) value += 9 * worth;
        if (!hard || dist(p, e) > 10) continue;
        const at = cell(e);
        const exits = DIRECTIONS.map((d) => ({ x: at.x + d.x, z: at.z + d.z })).filter(
          (c) => s.tiles[c.z]?.[c.x] === 0,
        );
        if (exits.length) value += (8 * exits.filter(hits).length) / exits.length;
        const ahead = cell({
          x: e.x + Math.max(-1, Math.min(1, e.dx * 0.65)),
          z: e.z + Math.max(-1, Math.min(1, e.dz * 0.65)),
        });
        if (!same(at, ahead) && hits(ahead)) value += 6;
      }
      return value;
    };
    for (const { x, z } of placements) {
      if (!canPlace(s, p, { x, z })) continue;
      const bomb: Bomb = {
        x,
        z,
        id: -1,
        range: modifiedStat(p, "bombRange", p.range, s.time),
        ownerId: p.id,
        blastDuration: modifiedStat(p, "blastDuration", RULES.blastDuration, s.time),
        pierce: modifiedStat(p, "blastPierce", 0, s.time) || undefined,
        detonateAt: s.time + modifiedStat(p, "bombFuse", RULES.fuse, s.time),
        passThrough: x === here.x && z === here.z ? [p.id] : [],
      };
      const score = scoreHit(blastCells(s, bomb));
      if (score > 0) choices.push({ bomb, kick: false, score });
    }
    if (hard && p.skills.includes("kick"))
      for (const b of s.bombs) {
        const dx = b.x - here.x,
          dz = b.z - here.z;
        if (Math.abs(dx) + Math.abs(dz) !== 1 || b.slide || b.passThrough.includes(p.id)) continue;
        const delay = Math.max(0.03, (dist(b, p) - 0.72) / p.speed) + KICK.windup;
        const x = b.x + dx,
          z = b.z + dz;
        if (slideBlocked(s, x, z) || b.detonateAt <= s.time + delay + 0.2) continue;
        const bomb = { ...b, slide: { x: dx, z: dz, arrivedAt: s.time + delay } };
        const shifted = new BombForecast(s, undefined, bomb, p.id);
        const score =
          scoreHit(shifted.footprints.get(b.id) ?? [], b.ownerId) - scoreHit(blastCells(s, b), b.ownerId) + 2;
        if (score > 2) choices.push({ bomb, kick: true, score, first: cell(b) });
      }
    choices.sort((a, b) => b.score - a.score || dist(p, b.bomb) - dist(p, a.bomb));
    for (const choice of choices.slice(0, config.candidates)) {
      const f = choice.kick
        ? new BombForecast(s, undefined, choice.bomb, p.id)
        : new BombForecast(s, choice.bomb, undefined, p.id);
      const escape = safeRoute(
        s,
        p,
        f,
        config.depth,
        () => 0,
        true,
        difficulty === "normal" || difficulty === "adaptive" ? NORMAL_WALK_SCALE : 1,
      );
      if (escape && (!choice.kick || !f.burning(choice.bomb.x, choice.bomb.z, 0, 0.6)))
        return {
          first: choice.first ?? escape.first,
          target: cell(choice.bomb),
          kick: choice.kick,
        };
    }
  }
}
