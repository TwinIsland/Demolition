import { t } from "../i18n";
import { COMBAT } from "./combat";
import { CONSUMABLES, eachOwned, HAS_TICK_HOOKS, RULES, SKILLS } from "./content";
import { ZONE } from "./zone";
import { coverLayout } from "./cover-layout";
import { supplyInterval } from "./field-supplies";
import { generateMap, MAPS, movableWalls, seededRandom, spawnPoints, type MapDefinition } from "./maps";
import { DEFAULT_MODE, MATCH_MODES, modeRules, type MatchMode } from "./match-modes";
import { BOT_PROFILES, defaultSlots } from "./room";
import { landThrown, placeBomb, updateBombs } from "./systems/bombs";
import { build } from "./systems/building";
import { expireFires, resolveFireDamage } from "./systems/fires";
import { regenerate } from "./systems/regen";
import { buySupply } from "./systems/supply";
import { stepStrikes } from "./systems/strikes";
import { stepZone } from "./systems/zone";
import { resolveBlastDamage, stepZombies, tickShields } from "./systems/combat";
import type { SimContext } from "./systems/context";
import { equip, useEquipment } from "./systems/equipment";
import { pruneEvents } from "./systems/events";
import { collectItems, spawnFieldSupply } from "./systems/loot";
import { finishIfDecided, tickCountdown, updateArenaView, updateTerrainReset } from "./systems/match";
import { move } from "./systems/movement";
import { applyShopCommand, activateSkill, choosePerk, usePerk } from "./systems/progression";
import { idleInput, inTacticalView } from "./types";
import type { GameSnapshot, MatchOptions, Player, PlayerInput, Tile } from "./types";
import { ZombieDirector } from "./zombies";

/**
 * The authoritative match. This class only wires the systems in src/core/systems together:
 * it owns construction and the order of phases inside a tick. Rules live in the systems.
 */
export class Simulation {
  readonly state: GameSnapshot;
  private readonly ctx: SimContext;

  constructor(options: MatchOptions) {
    const mode = options.mode ?? DEFAULT_MODE;
    if (!MATCH_MODES[mode]?.available) throw new Error(t("该模式尚未开放"));
    const undead = new ZombieDirector(options.zombieRate);
    const map = MAPS.find((m) => m.id === options.mapId);
    if (!map) throw new Error(`Unknown map: ${options.mapId}`);
    const random = seededRandom(options.seed);
    // The first draws of the stream, in this order: terrain, then the first supply timer.
    const tiles = generateMap(map, random);
    const nextSupplyAt = supplyInterval(random);
    let sequence = 0;
    this.state = initialState(options, mode, map, tiles);
    this.ctx = {
      state: this.state,
      map,
      coverAt: coverLayout(map, options.seed),
      random,
      nextId: () => ++sequence,
      undead,
      crateMisses: new Map(),
      offerHistory: new Map(),
      zoneBurn: new Map(),
      zoneBurnEventAt: new Map(),
      healthCaps: new Map(),
      regen: new Map(),
      nextSupplyAt,
    };
  }

  /**
   * Advances one tick. The order of the phases below is part of the game rules and of the
   * deterministic contract (RNG draws and id allocation follow it); do not reorder.
   */
  step(dt: number, inputs: ReadonlyMap<string, PlayerInput>) {
    const ctx = this.ctx,
      s = this.state;

    // 1. Menu commands: loadout during the countdown, perk choices at any time.
    //    These are accepted at dt=0 while the local game is paused by its UI.
    for (const p of s.players) {
      const command = inputs.get(p.id);
      if (s.phase === "countdown" && command) {
        if (command.equip && p.alive) equip(ctx, p, command.equip);
        applyShopCommand(p, command);
      }
      choosePerk(ctx, p, command?.choosePerk);
    }
    if (s.phase === "finished" || dt <= 0) return;
    if (s.phase === "countdown") {
      tickCountdown(s, dt);
      return;
    }

    // 2. Clock and arena-wide state.
    const stepStart = s.time;
    s.time += dt;
    updateArenaView(s, stepStart);
    // A rearranged arena discards this tick's commands: they were aimed at the old cover layout.
    if (updateTerrainReset(ctx, inputs)) return;
    tickShields(ctx, dt);
    s.blasts = s.blasts.filter((b) => b.expiresAt > s.time);
    expireFires(s);
    stepZone(ctx, dt);

    // 3. Activated perks resolve for every player before any player moves or handles its skill input.
    for (const p of s.players) {
      const command = inputs.get(p.id);
      if (p.alive && command?.usePerk) usePerk(ctx, p, command.usePerk, command.perkTarget);
    }

    // 4. Player actions, one player at a time in roster order.
    for (const p of s.players) {
      if (p.alive) this.act(p, inputs.get(p.id) ?? idleInput(p.yaw), dt, stepStart);
    }

    // 5. Projectiles and bombs: landings, fuses and chain reactions, slides.
    landThrown(ctx);
    stepStrikes(ctx);
    updateBombs(ctx);

    // 6. Blast damage, then pickups for those still standing.
    for (const p of s.players) {
      if (!p.alive) continue;
      resolveBlastDamage(ctx, p);
      if (p.alive) resolveFireDamage(ctx, p);
      if (p.alive) collectItems(ctx, p);
    }

    regenerate(ctx, dt);

    // 7. World: zombies, then the field supply timer.
    stepZombies(ctx, dt);
    spawnFieldSupply(ctx);

    // 8. Match end and event log upkeep.
    finishIfDecided(s);
    pruneEvents(s);
  }

  /** One player's turn: facing, module tick hooks, movement, skill, building, then equipment. */
  private act(p: Player, input: PlayerInput, dt: number, stepStart: number) {
    const ctx = this.ctx,
      s = this.state;
    p.yaw = Number.isFinite(input.yaw) ? input.yaw : p.yaw;
    if (HAS_TICK_HOOKS) eachOwned(p, (m, n) => m.onTick?.(p, s, dt, n));
    move(ctx, p, input, dt, inTacticalView(p, stepStart));
    if (input.activateSkill) activateSkill(ctx, p, input.activateSkill, stepStart);
    if (input.build) build(ctx, p);
    if (input.buyItem) buySupply(ctx, p, input.buyItem);
    if (inTacticalView(p, stepStart)) {
      // Overhead, as in classic arena bombers, the bomb drops on the cell the player stands on.
      if (input.plantHere) placeBomb(ctx, p);
    } else {
      if (input.equip) equip(ctx, p, input.equip);
      if (input.useEquipment) useEquipment(ctx, p, input.aimTarget, input.throwMode, input.meleeYaw);
    }
  }
}

/** Unknown or unsafe values fall back to the default, so a stale saved setting cannot break a match. */
const zoneDuration = (seconds: number | undefined) =>
  Number.isFinite(seconds) && seconds! >= 30 && seconds! <= 1800 ? seconds! : ZONE.defaultDuration;

function initialState(
  options: MatchOptions,
  mode: MatchMode,
  map: MapDefinition,
  tiles: Tile[][],
): GameSnapshot {
  const slots = options.opponents ?? defaultSlots(options.difficulty);
  const bots = BOT_PROFILES.flatMap((profile) => {
    const slot = slots.find((s) => s.id === profile.id && s.enabled);
    return slot ? [{ ...profile, bot: true, skin: slot.skin, difficulty: slot.difficulty }] : [];
  });
  if (mode !== "practice" && !bots.length) throw new Error(t("至少需要一位 AI 对手"));
  const profiles = [
    {
      id: options.humanId ?? "you",
      name: "你",
      color: "#f07066",
      bot: false,
      ...options.appearance,
    },
    ...bots,
  ];
  const spawns = spawnPoints(map.size),
    rules = modeRules(mode);
  return {
    mode,
    canResetTerrain: mode === "practice" && !!map.randomizeTerrain,
    seed: options.seed,
    mapId: map.id,
    difficulty: options.difficulty ?? "normal",
    mapName: map.name,
    size: map.size,
    tiles,
    wallOrigins: movableWalls(map, tiles),
    time: 0,
    duration: zoneDuration(options.zoneDuration),
    countdown: RULES.countdown,
    phase: "countdown",
    winnerId: null,
    players: profiles.map((p, i) => ({
      ...p,
      ...spawns[i],
      elevation: 0,
      tacticalView: rules.overhead || undefined,
      verticalSpeed: 0,
      yaw: i === 0 ? -Math.PI / 2 : Math.PI / 2,
      hp: rules.health,
      maxHp: rules.health,
      stamina: rules.stamina,
      maxStamina: rules.stamina,
      staminaRegenAt: 0,
      sprinting: false,
      attack: rules.attack,
      score: 0,
      inventory: Object.fromEntries(CONSUMABLES.map((id) => [id, 0])),
      moduleData: {},
      equipped: "bomb",
      credits: rules.credits,
      skills: [],
      alive: true,
      shield: 0,
      invulnerableUntil: 0,
      speed: rules.speed,
      range: rules.range,
      capacity: rules.capacity,
      kills: 0,
      xp: 0,
      level: 1,
      nextLevel: Math.round(COMBAT.firstUpgradeScore * rules.upgradePace),
      perks: [],
      offers: [],
      scanUntil: 0,
      cooldowns: Object.fromEntries(Object.keys(SKILLS).map((id) => [id, 0])),
    })),
    zombies: [],
    thrown: [],
    fires: [],
    strikes: [],
    bombs: [],
    blasts: [],
    items: [],
    events: [],
  };
}
