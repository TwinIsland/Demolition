import { BOT_PROFILES, defaultSlots } from "./room";
import { CRATE_CHANCES, dropChance, lootContext, supplyDrop, zombieDrops, ZOMBIE_STATS } from "./loot";

import { fieldSupply, supplyInterval } from "./field-supplies";
import { canEquip } from "./equipment";
import { STAMINA, recoverOrSpend, sprintSeconds } from "./stamina";
import { canPlace } from "./placement";
import { slidingZombieContact, SUMMON_TIME, ZombieDirector } from "./zombies";
import { COMBAT, blastDamage } from "./combat";
import { grantMutation } from "./mutations";
import { combatMessage, type CombatMessage } from "./combat-message";
import { t } from "../i18n";
import { coverLayout, coverSurface } from "./cover-layout";
import { rearrangeCover } from "./rearrange-cover";
import { CONSUMABLES, HAS_TICK_HOOKS, eachOwned, modifiedStat, isEquipment, ITEMS, rollPerks, SLOT_LIMIT, RULES, SKILLS, perkById } from "./content";
import { blastCells, blastContact, clearSight, firstBlocker, slideBlocked, SLIDE_STEP } from "./geometry";
import type { EffectContext, ItemDefinition } from "./module-api";
import type { Zombie } from "./types";
import { DEFAULT_MODE, MATCH_MODES } from "./match-modes";
import { DIRECTIONS, MAPS, generateMap, seededRandom, spawnPoints, type MapDefinition } from "./maps";
import { idleInput, inTacticalView } from "./types";
import type {
  Blast,
  Bomb,
  GameEvent,
  GameSnapshot,

  MatchOptions,
  Player,
  PlayerInput,
  SkillId,
} from "./types";

export class Simulation {
  readonly state: GameSnapshot;
  private map: MapDefinition;
  private coverAt:ReturnType<typeof coverLayout>;
  private random: () => number;
  private crateMisses = new Map<string, number>();
  private offerHistory = new Map<string, { previous: string[]; silverHands: number }>();
  private sequence = 0;
  private nextSupply: number;
  private undead: ZombieDirector;
  constructor(options: MatchOptions) {
    const mode = options.mode ?? DEFAULT_MODE;
    if (!MATCH_MODES[mode]?.available) throw new Error(t("该模式尚未开放"));
    this.undead = new ZombieDirector(options.zombieRate);
    const def = MAPS.find((m) => m.id === options.mapId);
    if (!def) throw new Error(`Unknown map: ${options.mapId}`);
    this.map = def;
    this.coverAt = coverLayout(def,options.seed);
    this.random = seededRandom(options.seed);
    const tiles = generateMap(def, this.random);
    this.nextSupply = supplyInterval(this.random);
    const slots = options.opponents ?? defaultSlots(options.difficulty);
    const bots = BOT_PROFILES.flatMap(profile => {
      const slot = slots.find(s => s.id === profile.id && s.enabled);
      return slot ? [{...profile, bot:true, skin:slot.skin, difficulty:slot.difficulty}] : [];
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
    const spawns = spawnPoints(def.size);
    this.state = {
      mode,
      canResetTerrain: mode === "practice" && !!def.randomizeTerrain,
      seed: options.seed,
      mapId: def.id,
      difficulty: options.difficulty ?? "normal",
      mapName: def.name,
      size: def.size,
      tiles,
      time: 0,
      duration: RULES.duration,
      countdown: 3,
      phase: "countdown",
      winnerId: null,
      players: profiles.map((p, i) => ({
        ...p,
        ...spawns[i],
        elevation: 0, verticalSpeed: 0,
        yaw: i === 0 ? -Math.PI / 2 : Math.PI / 2,
        hp: COMBAT.health,
        maxHp: COMBAT.health,
        stamina: STAMINA.capacity, maxStamina: STAMINA.capacity,
        staminaRegenAt: 0, sprinting: false,
        attack: COMBAT.attack,
        score: 0,
        inventory: Object.fromEntries(CONSUMABLES.map(id=>[id,0])),
        moduleData: {},
        equipped: "bomb",
        credits: 115,
        skills: [],
        alive: true,
        shield: 0,
        invulnerableUntil: 0,
        speed: RULES.baseSpeed,
        range: RULES.baseRange,
        capacity: RULES.baseCapacity,
        kills: 0,
        xp: 0,
        level: 1,
        nextLevel: COMBAT.firstUpgradeScore,
        perks: [],
        offers: [],
        scanUntil: 0,
        surgeUntil: 0,
        jammedUntil: 0,
        cooldowns: Object.fromEntries(Object.keys(SKILLS).map(id=>[id,0])),
      })),
      zombies: [],
      thrown: [], smoke: [],
      bombs: [],
      blasts: [],
      items: [],
      events: [],
    };
  }
  private equip(p:Player, item:string) {
    if (item === p.equipped || !canEquip(p,item)) return;
    p.equipped = item;
    this.event("equip",p,"切换装备",p.x,p.z,{item});
  }
  step(dt: number, inputs: ReadonlyMap<string, PlayerInput>) {
    const s = this.state;
    // Choices are accepted at dt=0 while the local game is paused by its UI.
    for (const p of s.players) {
      const command = inputs.get(p.id);
      if (s.phase === "countdown" && command) {
        const { buy, refund, equip } = command;
        if (equip && p.alive) this.equip(p,equip);
        if (refund && p.skills.includes(refund)) {
          p.credits += SKILLS[refund].price;
          p.skills = p.skills.filter(id => id !== refund);
        }
        if (buy && Object.prototype.hasOwnProperty.call(SKILLS, buy) && !p.skills.includes(buy) &&
            p.skills.length < SLOT_LIMIT && p.credits >= SKILLS[buy].price) {
          p.skills.push(buy);
          p.credits -= SKILLS[buy].price;
        }
      }
      const chosen = command?.perk;
      if (chosen && p.alive && p.offers.includes(chosen)) {
        perkById(chosen)?.onAcquire?.(p,this.effectContext(p));
        p.perks.push(chosen);
        this.event("perk", p, combatMessage("获得{0}",perkById(chosen)!), p.x, p.z, {perk:chosen});
        p.offers = [];
      }
    }
    if (s.phase === "finished" || dt <= 0) return;
    if (s.phase === "countdown") {
      s.countdown = Math.max(0, s.countdown - dt);
      if (!s.countdown) s.phase = "playing";
      return;
    }
    const stepStart = s.time;
    s.time += dt;
    const arenaView = s.arenaView;
    if (arenaView && s.time >= arenaView.endsAt) delete s.arenaView;
    else if (arenaView && stepStart < arenaView.startsAt && s.time >= arenaView.startsAt) {
      for (const actor of s.players) actor.forcedViewUntil = arenaView.endsAt;
    }
    const reset = s.terrainReset;
    const practiceReset = !reset && s.canResetTerrain && s.players.some(p => !p.bot && p.alive && inputs.get(p.id)?.resetTerrain);
    if (practiceReset || (reset && reset.completedAt === undefined && s.time >= reset.at)) {
      rearrangeCover(s,this.map,this.random);
      this.undead.terrainChanged(s.time);
      if (reset) reset.completedAt = s.time;
      // Discard commands aimed at the old cover layout.
      return;
    } else if (reset?.completedAt !== undefined && s.time >= reset.completedAt + 1.25) {
      delete s.terrainReset;
    }
    for (const p of s.players) {
      if (p.shield <= 0) continue;
      if (p.shield <= dt) this.endShield(p,"expired");
      else p.shield -= dt;
    }
    s.blasts = s.blasts.filter((b) => b.expiresAt > s.time);
    // Resolve arena-wide effects before any seat moves or handles its skill input.
    for (const p of s.players) {
      const id = inputs.get(p.id)?.usePerk;
      if (!p.alive || !id) continue;
      const slot = p.perks.indexOf(id), perk = perkById(id);
      if (slot >= 0 && perk?.use && (!perk.canUse || perk.canUse(p,s)) && perk.use(p,this.effectContext(p))) {
        p.perks.splice(slot,1);
        this.event("perk-use",p,combatMessage("启动{0}",perk),p.x,p.z,{perk:id});
      }
    }
    for (const p of s.players) {
      if (!p.alive) continue;
      const input = inputs.get(p.id) ?? idleInput(p.yaw);
      p.yaw = Number.isFinite(input.yaw) ? input.yaw : p.yaw;
      if (HAS_TICK_HOOKS) eachOwned(p,(m,n)=>m.onTick?.(p,s,dt,n));
      this.move(p,input,dt,inTacticalView(p,stepStart));
      if (input.skill) this.useSkill(p,input.skill,stepStart);
      if (inTacticalView(p,stepStart)) {
        if (input.plantAtFeet) this.placeBomb(p);
      } else {
        if (input.equip) this.equip(p,input.equip);
        if (input.bomb) this.useEquipment(p,input.bombTarget,input.throwMode,input.meleeYaw);
      }
    }
    s.smoke=s.smoke.filter(c=>c.expiresAt>s.time);
    for (const t of s.thrown) {
      if (t.landsAt>s.time) continue;
      ITEMS[t.kind]?.onLand?.({
        projectile:t,
        smoke:(duration,radius)=>s.smoke.push({id:t.id,x:t.x,z:t.z,expiresAt:s.time+duration,duration,radius}),
        explode:range=>this.detonate({id:t.id,ownerId:t.ownerId,x:t.x,z:t.z,range,power:t.power,passThrough:[],detonateAt:s.time},"throwable"),
      });
    }
    s.thrown=s.thrown.filter(t=>t.landsAt>s.time);
    const onFire = (x:number,z:number) => s.blasts.some(b => b.x === x && b.z === z);
    for (const bomb of s.bombs) {
      const contact = blastContact(bomb,s.time,onFire);
      if (contact || (!bomb.slide && bomb.detonateAt <= s.time)) this.explode(bomb,contact);
    }
    for (const bomb of s.bombs) {
      const slide = bomb.slide;
      if (!slide) continue;
      const victim = slidingZombieContact(s.zombies,bomb,s.time);
      if (victim) this.explode(bomb,victim);
      else if (s.time >= slide.arrivedAt) this.slideBomb(bomb, slide.x, slide.z);
    }
    // Actors overlapping a fresh charge may leave its footprint once.
    for (const b of s.bombs)
      b.passThrough = b.passThrough.filter((id) => {
        const p = s.players.find((p) => p.id === id)!;
        return (
          Math.abs(p.x - b.x) < 0.5 + RULES.playerRadius &&
          Math.abs(p.z - b.z) < 0.5 + RULES.playerRadius
        );
      });
    for (const p of s.players) {
      if (!p.alive) continue;
      let strongest: Blast | undefined;
      let damage = 0;
      const contacts = new Set<number>();
      for (const blast of s.blasts) {
        if (Math.abs(blast.x - p.x) >= .55 || Math.abs(blast.z - p.z) >= .55) continue;
        if (!blast.contactedBy?.includes(p.id)) contacts.add(blast.explosionId ?? blast.id);
        if (blast.absorbedBy?.includes(p.id)) continue;
        const amount = blastDamage(blast,p,s.time);
        if (amount > damage) { strongest = blast; damage = amount; }
      }
      if (contacts.size) {
        for (const cell of s.blasts) if (contacts.has(cell.explosionId ?? cell.id)) (cell.contactedBy ??= []).push(p.id);
        this.event("blast-contact",p,"爆炸冲击");
      }
      if (strongest && p.shield > 0) {
        this.endShield(p,"broken");
        // A blocked explosion stays blocked across its whole footprint and lifetime.
        const explosion = strongest.explosionId ?? strongest.id;
        for (const cell of s.blasts) if ((cell.explosionId ?? cell.id) === explosion)
          (cell.absorbedBy ??= []).push(p.id);
      } else if (strongest && p.invulnerableUntil <= s.time) {
        this.hurt(p,strongest.ownerId,damage,"爆炸",1.3);
        if (strongest.ownerId === p.id && strongest.source !== "throwable") {
          const explosion = strongest.explosionId ?? strongest.id;
          for (const cell of s.blasts) if ((cell.explosionId ?? cell.id) === explosion) (cell.absorbedBy ??= []).push(p.id);
        }
      }
      if (!p.alive) continue;
      for (const item of [...s.items])
        if (Math.hypot(item.x - p.x, item.z - p.z) < 0.55) {
          const def=ITEMS[item.kind];
          if (isEquipment(def)) p.inventory[item.kind]=(p.inventory[item.kind] ?? 0)+1;
          def.onPickup?.(p);
          s.items = s.items.filter((i) => i.id !== item.id);
          this.event("pickup", p, combatMessage("获得{0}",ITEMS[item.kind]), p.x, p.z, {item:item.kind});
          this.gainScore(p, def.pickupScore ?? COMBAT.pickupScore);
        }
    }
    this.undead.step(s, dt, this.random, () => ++this.sequence,
      (zombie, ownerId) => this.rewardZombie(zombie,s.players.find(p => p.id === ownerId)!), (p, damage) => {
      if (p.invulnerableUntil > s.time || (s.mode === "practice" && !p.bot)) return;
      if (this.shieldBlocks(p)) return;
      p.invulnerableUntil = s.time + 1.3;
      p.hp = Math.max(0, p.hp - damage);
      this.event("hurt", p, combatMessage("僵尸攻击 · -{0} HP",damage));
      if (!p.hp) { p.alive = false; p.offers = []; this.event("kill", p, combatMessage("{0} 被僵尸淘汰",p)); }
    });
    if (s.time >= this.nextSupply) {
      this.nextSupply = s.time + supplyInterval(this.random);
      const item = fieldSupply(s,this.random,() => ++this.sequence);
      if (item) s.items.push(item);
    }
    const living = s.players.filter((p) => p.alive);
    if (s.mode !== "practice" && (living.length <= 1 || s.time >= s.duration)) {
      s.phase = "finished";
      delete s.terrainReset;
      delete s.arenaView;
      // At timeout, use eliminations then health. A tied score produces a draw.
      const sorted = [...living].sort(
        (a, b) => b.score - a.score || b.hp - a.hp,
      );
      const [first, second] = sorted;
      s.winnerId =
        first &&
        (!second || first.score !== second.score || first.hp !== second.hp)
          ? first.id
          : null;
    }
    s.events = s.events.filter((e,i,events) => e.at > s.time-12 && (i >= events.length-30 || e.type === "mutation"));
  }
  private move(p: Player, input: PlayerInput, dt: number, overhead:boolean) {
    const jump = !!input.jump && !overhead;
    if (jump || p.elevation > 0 || p.verticalSpeed !== 0) this.moveVertically(p,jump,dt);
    let mx = Number.isFinite(input.moveX) ? input.moveX : 0;
    let mz = Number.isFinite(input.moveZ) ? input.moveZ : 0;
    if (overhead && mx && mz) {
      if (Math.abs(mx) >= Math.abs(mz)) mz = 0;
      else mx = 0;
    }
    const length = Math.max(1, Math.hypot(mx, mz));
    const speed=modifiedStat(p,"moveSpeed",p.speed,this.state.time);
    const sprint = sprintSeconds(p,Boolean(input.sprint && (mx || mz)),dt);
    const distance = speed * (dt + sprint * (STAMINA.speedFactor - 1));
    const x = mx / length * distance, z = mz / length * distance;
    const startX = p.x, startZ = p.z;
    if (p.elevation === 0 && (x || z) && this.state.bombs.length) this.tryKick(p,x,z);
    if (x && this.canOccupy(p, p.x + x, p.z)) p.x += x;
    if (z && this.canOccupy(p, p.x, p.z + z)) p.z += z;
    recoverOrSpend(p, p.x !== startX || p.z !== startZ ? sprint : 0, dt, this.state.time);
  }
  private moveVertically(p: Player, jump: boolean, dt: number) {
    if (jump && p.elevation === 0 && p.verticalSpeed === 0) p.verticalSpeed = RULES.jumpSpeed;
    const gravity = p.verticalSpeed > 0 ? RULES.jumpGravity : RULES.fallGravity;
    p.elevation += p.verticalSpeed * dt - .5 * gravity * dt * dt;
    p.verticalSpeed -= gravity * dt;
    if (p.elevation <= 0) {
      p.elevation = 0;
      p.verticalSpeed = 0;
    }
  }
  private tryKick(p:Player, moveX:number, moveZ:number) {
    const dx = Math.abs(moveX) >= Math.abs(moveZ) ? Math.sign(moveX) : 0;
    const dz = dx ? 0 : Math.sign(moveZ);
    let nearest: Bomb | undefined;
    let best = Infinity;
    for (const bomb of this.state.bombs) {
      if (bomb.slide) continue;
      const x = bomb.x-p.x, z = bomb.z-p.z;
      const ahead = x*dx+z*dz, across = Math.abs(x*dz-z*dx);
      const sameTile = Math.round(p.x) === bomb.x && Math.round(p.z) === bomb.z;
      if ((!sameTile && ahead < 0) || ahead > .92 || across > .5+RULES.playerRadius) continue;
      const distance = x*x+z*z;
      if (distance < best && clearSight(this.state,p,bomb)) { best=distance; nearest=bomb; }
    }
    if (!nearest) return;
    const charge = nearest;
    eachOwned(p,mod => mod.onBombContact?.(() => {
      if (!charge.slide) this.slideBomb(charge,dx,dz,p.id);
    }));
  }
  private canOccupy(p: Player, x: number, z: number) {
    const r = RULES.playerRadius;
    for (const px of [x - r, x + r])
      for (const pz of [z - r, z + r]) {
        const cx = Math.round(px),
          cz = Math.round(pz);
        const tile = this.state.tiles[cz]?.[cx];
        if (tile !== 0) return false;
        const bomb = this.state.bombs.find(b => b.x === cx && b.z === cz && b.slide?.kickerId !== p.id && !b.passThrough.includes(p.id));
        if (bomb) {
          if (bomb.slide) this.explode(bomb);
          return false;
        }
      }
    return true;
  }
  private slideBomb(bomb: Bomb, dx: number, dz: number, kickerId?:string) {
    const s = this.state, x = bomb.x + dx, z = bomb.z + dz;
    if ((!dx && !dz) || !s.bombs.includes(bomb)) return;
    if (s.blasts.some(b => b.x === bomb.x && b.z === bomb.z)) { this.explode(bomb); return; }
    if (slideBlocked(s,x,z,kickerId)) {
      if (bomb.slide) this.explode(bomb);
      return;
    }
    bomb.x = x;
    bomb.z = z;
    bomb.passThrough = [];
    bomb.slide = { x: dx, z: dz, arrivedAt: s.time + SLIDE_STEP, kickerId };
    if (s.blasts.some(b => b.x === x && b.z === z)) this.explode(bomb);
  }
  private placeBomb(p: Player, target = { x: Math.round(p.x), z: Math.round(p.z) }) {
    const s = this.state,
      {x,z} = target;
    if (
      !canPlace(s, p, target)
    )
      return;
    s.bombs.push({
      id: ++this.sequence,
      x,
      z,
      ownerId: p.id,
      power: Math.round(p.attack),
      range: modifiedStat(p,"bombRange",p.range,s.time),
      blastDuration: modifiedStat(p, "blastDuration", RULES.blastDuration, s.time),
      detonateAt: s.time + RULES.fuse,
      passThrough: s.players
        .filter((a) => Math.abs(a.x - x) < 0.75 && Math.abs(a.z - z) < 0.75)
        .map((a) => a.id),
    });
    this.event("bomb", p, "放置炸药");
  }
  private useEquipment(p: Player, target?: PlayerInput["bombTarget"], mode: PlayerInput["throwMode"] = "direct", meleeYaw = p.yaw) {
    const s = this.state, kind = p.equipped;
    if (kind === "bomb") { this.placeBomb(p,target); return; }
    if (!canEquip(p,kind)) return;
    const def = ITEMS[kind];
    if (def.melee) { this.swing(p,kind,def.melee,Number.isFinite(meleeYaw) ? meleeYaw : p.yaw); return; }
    if (def.onUse) {
      if (!def.onUse(p,this.effectContext(p))) return;
    } else if (def.throwable && target && canPlace(s,p,target,kind,mode)) {
      s.thrown.push({ ...target, id:++this.sequence, ownerId:p.id, kind, mode,
        origin:{x:p.x,z:p.z,elevation:p.elevation}, landsAt:s.time+def.throwable.flight, power:p.attack });
    } else return;
    this.event("equipment",p,combatMessage(def.throwable ? "投出{0}" : "使用{0}",def),p.x,p.z,{item:kind});
    if (!def.permanent && --p.inventory[kind] === 0) p.equipped = "bomb";
  }
  private swing(p:Player, kind:string, melee:NonNullable<ItemDefinition["melee"]>, yaw:number) {
    const s = this.state, cooldown = "equipment:"+kind;
    if ((p.cooldowns[cooldown] ?? 0) > s.time) return;
    p.cooldowns[cooldown] = s.time+melee.cooldown;
    this.event("melee",p,"挥击",p.x,p.z,{item:kind});
    let closest = melee.reach, target: Player | Zombie | undefined;
    for (const enemy of [...s.players,...s.zombies]) {
      const player = "alive" in enemy;
      if (enemy === p || (player && !enemy.alive) ||
          (!player && enemy.spawnAt !== undefined && s.time < enemy.spawnAt+SUMMON_TIME)) continue;
      const dx = enemy.x-p.x, dz = enemy.z-p.z, distance = Math.hypot(dx,dz);
      if (distance > closest ||
          -dx*Math.sin(yaw)-dz*Math.cos(yaw) < distance*.48 || !clearSight(s,p,enemy)) continue;
      target = enemy;
      closest = distance;
    }
    if (melee.coverDamage && melee.coverDamage > 0) {
      const block = firstBlocker(s,p,{x:p.x-Math.sin(yaw)*melee.reach,z:p.z-Math.cos(yaw)*melee.reach});
      if (block && block.fraction*melee.reach <= closest && s.tiles[block.z]?.[block.x] === 2) {
        const {x,z} = block, cell = z*s.size+x, origin = s.coverOrigins?.[cell] ?? cell;
        const {cover} = this.coverAt(origin%s.size, Math.floor(origin/s.size));
        this.event("cover-hit",p,"击中掩体",x,z,{item:kind,coverSurface:coverSurface(cover)});
        const damage = s.coverDamage ??= {};
        damage[origin] = (damage[origin] ?? 0)+melee.coverDamage;
        if (damage[origin] >= COMBAT.coverDurability) {
          const reward = this.destroyCover(p,x,z);
          this.event("cover",p,combatMessage("摧毁掩体 · +{0} 积分",reward),x,z,{item:kind});
        }
        return;
      }
    }
    if (!target) return;
    if ("alive" in target) {
      if (target.invulnerableUntil <= s.time) this.hurt(target,p.id,melee.damage,"近战",.3,kind);
    } else if (this.undead.strike(s,target,melee.damage)) this.rewardZombie(target,p,kind);
    else this.event("hit",p,combatMessage("命中 Lv.{0} 僵尸",target.level),target.x,target.z,
      {item:kind,zombieId:target.id,zombieLevel:target.level,zombieOutcome:"hurt"});
  }
  private rewardZombie(zombie:Zombie, owner:Player, item?:string) {
    const s = this.state, score = ZOMBIE_STATS[zombie.level].score;
    this.gainScore(owner,score);
    this.event("hit",owner,combatMessage("击倒 Lv.{0} 僵尸 · +{1} 积分",zombie.level,score),zombie.x,zombie.z,
      {zombieId:zombie.id,zombieLevel:zombie.level,zombieOutcome:"killed",item});
    if (owner.alive && this.random() < ZOMBIE_STATS[zombie.level].mutationChance) {
      const mutation = grantMutation(owner,this.random);
      this.event("mutation",owner,combatMessage("获得{0}",mutation),owner.x,owner.z,{mutation:mutation.id});
    }
    const x = Math.round(zombie.x), z = Math.round(zombie.z);
    for (const kind of zombieDrops(zombie.level,lootContext(s,zombie,owner),this.random)) {
      const candidates = [{x,z}, ...DIRECTIONS.map(d => ({x:x+d.x,z:z+d.z}))];
      const cell = candidates.find(c => s.tiles[c.z]?.[c.x] === 0 &&
        !s.items.some(i => i.x===c.x && i.z===c.z) && !s.bombs.some(b => b.x===c.x && b.z===c.z));
      s.items.push({...(cell ?? {x,z}),kind,id:++this.sequence});
    }
  }
  private useSkill(p: Player, skill: SkillId, inputTime:number) {
    const s=this.state, def=SKILLS[skill];
    if (!def?.activate || def.passive || !p.skills.includes(skill) || (p.cooldowns[skill] ?? 0)>s.time ||
        (def.canActivate && !def.canActivate(p,inputTime))) return;
    p.cooldowns[skill]=s.time+modifiedStat(p,"cooldown",def.cooldown,s.time);
    def.activate(p,s,modifiedStat(p,`duration:${skill}`,def.duration,s.time));
    const switchedOff = def.isActive && !def.isActive(p,s.time);
    this.event("skill", p, combatMessage(switchedOff ? "关闭{0}" : "启动{0}",def),p.x,p.z,{skill});
  }
  private explode(bomb: Bomb, origin: {x:number;z:number} = bomb) {
    const s = this.state;
    if (!s.bombs.some((b) => b.id === bomb.id)) return;
    s.bombs = s.bombs.filter((b) => b.id !== bomb.id);
    this.detonate(origin === bomb ? bomb : {...bomb,x:origin.x,z:origin.z});
  }
  private detonate(bomb: Bomb, source:NonNullable<Blast["source"]> = "charge") {
    const s=this.state;
    const owner = s.players.find((p) => p.id === bomb.ownerId)!;
    // Capture the original blockers before modifying crates for this explosion.
    const cells = blastCells(s, bomb);
    const duration = bomb.blastDuration ?? RULES.blastDuration;
    let destroyed = 0, coverScore = 0;
    for (const cell of cells) {
      s.blasts.push({
        ...cell,
        explosionId: bomb.id,
        source,
        id: ++this.sequence,
        ownerId: bomb.ownerId,
        originX: bomb.x,
        originZ: bomb.z,
        power: bomb.power ?? COMBAT.attack,
        range: bomb.range,
        duration,
        expiresAt: s.time + duration,
      });
      s.items = s.items.filter((i) => i.x !== cell.x || i.z !== cell.z);
      if (s.tiles[cell.z][cell.x] === 2) {
        coverScore += this.destroyCover(owner,cell.x,cell.z);
        if (owner.alive) destroyed++;
      }
    }
    if (destroyed) this.event("cover",owner,combatMessage("摧毁掩体 ×{0} · +{1} 积分",destroyed,coverScore),bomb.x,bomb.z);
    this.event("blast", owner, "炸药爆开", bomb.x, bomb.z);
    const reached = (x:number,z:number) => cells.some(c => c.x === x && c.z === z);
    for (const other of s.bombs) {
      const contact = blastContact(other,s.time,reached);
      if (contact) this.explode(other,contact);
    }
  }
  private destroyCover(owner:Player,x:number,z:number) {
    const s = this.state, cell = z*s.size+x;
    s.tiles[z][x] = 0;
    delete s.coverDamage?.[s.coverOrigins?.[cell] ?? cell];
    delete s.coverOrigins?.[cell];
    let score = 0;
    if (owner.alive) {
      eachOwned(owner,(m,n)=>m.onCoverDestroyed?.(owner,n));
      score = modifiedStat(owner,"crateScore",COMBAT.crateScore,s.time);
      this.gainScore(owner,score);
    }
    const misses = this.crateMisses.get(owner.id) ?? 0;
    const dropped = this.dropItem(x,z,CRATE_CHANCES[misses],owner);
    this.crateMisses.set(owner.id,dropped ? 0 : Math.min(misses+1,CRATE_CHANCES.length-1));
    return score;
  }
  private effectContext(p:Player): EffectContext {
    const s = this.state;
    return {
      stat:(key,base) => modifiedStat(p,key,base,s.time),
      forceArenaView:(duration, warningSeconds = 0) => {
        if (!p.alive || s.phase !== "playing" || s.arenaView || !Number.isFinite(duration) || duration <= 0 ||
            !Number.isFinite(warningSeconds) || warningSeconds < 0 ||
            s.players.some(actor => actor.alive && (actor.forcedViewUntil ?? 0) > s.time)) return false;
        const startsAt = s.time + warningSeconds;
        s.arenaView = {startsAt, endsAt:startsAt + duration};
        if (!warningSeconds) for (const actor of s.players) actor.forcedViewUntil = s.arenaView.endsAt;
        return true;
      },
      requestTerrainReset:delay => {
        if (!this.map.randomizeTerrain || s.terrainReset || s.phase !== "playing" ||
            !p.alive || !Number.isFinite(delay) || delay <= 0) return false;
        s.terrainReset = { id:++this.sequence, ownerId:p.id, at:s.time + delay };
        return true;
      },
    };
  }
  private endShield(p:Player,reason:NonNullable<GameEvent["shieldEnd"]>) {
    p.shield = 0;
    this.event("shield-end",p,reason === "broken" ? "爆炸击碎了护盾" : "护盾已消散",
      p.x,p.z,{item:"shield",shieldEnd:reason});
  }
  private shieldBlocks(p:Player) {
    if (p.shield <= 0) return false;
    // Rate-limit impact feedback, without extending immunity beyond shield expiry.
    p.invulnerableUntil = this.state.time+Math.min(.38,p.shield);
    this.event("hurt",p,"护盾抵挡了伤害",p.x,p.z,{blocked:true});
    return true;
  }
  private hurt(p:Player, attackerId:string, amount:number, source:string, immunity:number, item?:string) {
    if (this.state.mode === "practice" && !p.bot) return;
    if (this.shieldBlocks(p)) return;
    p.invulnerableUntil = this.state.time+immunity;
    const damage = Math.min(p.hp,amount);
    p.hp = Math.max(0, p.hp - damage);
    const attacker = this.state.players.find((a) => a.id === attackerId);
    if (attacker && attacker.id !== p.id && attacker.alive) {
      const points = Math.max(1, Math.round(damage * 0.2));
      eachOwned(attacker,(m,n)=>m.onDamageDealt?.(attacker,damage,n));
      this.gainScore(attacker, points);
      this.event(
        "hit",
        attacker,
        combatMessage("命中 {0} -{1} HP · +{2} 积分",p,damage,points),
        p.x,
        p.z,
        {item},
      );
    }
    this.event("hurt", p, combatMessage("受到 {0} 点{1}伤害",damage,source));
    if (p.hp <= 0) {
      p.alive = false;
      p.offers = [];
      const killer = this.state.players.find((a) => a.id === attackerId)!;
      if (killer.id !== p.id) {
        killer.kills++;
        if (killer.alive) this.gainScore(killer, COMBAT.killScore);
      }
      this.event(
        "kill",
        killer,
        killer.id === p.id
          ? combatMessage("{0} 被自己的炸药淘汰了",p)
          : combatMessage("{0} 淘汰了 {1}",killer,p),
      );
    }
  }
  private dropItem(x: number, z: number, chance: number, owner: Player) {
    if (this.state.items.some(i => i.x === x && i.z === z)) return;
    const context = lootContext(this.state,{x,z},owner);
    if (this.random() >= dropChance(chance,context)) return false;
    const kind=supplyDrop(context,this.random);
    if (!kind) return false;
    this.state.items.push({x,z,id:++this.sequence,kind});
    return true;
  }
  private gainScore(p: Player, value: number) {
    p.score += value;
    p.xp += value;
    this.offerUpgrade(p);
  }
  private offerUpgrade(p: Player) {
    while (p.xp >= p.nextLevel) {
      p.level++;
      p.xp -= p.nextLevel;
      p.nextLevel += COMBAT.upgradeScoreStep;
      const history = this.offerHistory.get(p.id) ?? {previous: [], silverHands: 0};
      p.offers = rollPerks(p, this.random, history.previous, history.silverHands >= 2, !!this.map.randomizeTerrain);
      history.previous = p.offers;
      history.silverHands = p.offers.every(id => perkById(id)?.tier === "silver") ? history.silverHands+1 : 0;
      this.offerHistory.set(p.id, history);
      this.event("level", p, combatMessage("升到 Lv.{0}",p.level));
    }
  }
  private event(
    type: GameEvent["type"],
    p: Player,
    text: string | CombatMessage,
    x = p.x,
    z = p.z,
    detail: Pick<GameEvent,"item" | "perk" | "skill" | "blocked" | "zombieId" | "zombieLevel" | "zombieOutcome" | "coverSurface" | "shieldEnd" | "mutation"> = {},
  ) {
    this.state.events.push({
      ...detail,
      id: ++this.sequence,
      at: this.state.time,
      type,
      playerId: p.id,
      text: typeof text === "string" ? text : text.zh,
      textEn: typeof text === "string" ? combatMessage(text).en : text.en,
      x,
      z,
    });
  }
}
