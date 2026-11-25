import { COMBAT } from "../combat";
import { combatMessage } from "../combat-message";
import { ITEMS } from "../content";
import { coverSurface } from "../cover-layout";
import { canEquip } from "../equipment";
import { clearSight, firstBlocker } from "../geometry";
import type { ItemDefinition } from "../module-api";
import { canPlace } from "../placement";
import type { Equipment, ItemId, Player, PlayerInput, Zombie } from "../types";
import { SUMMON_TIME } from "../zombies";
import { placeBomb } from "./bombs";
import { BUILT_CRATE_SURFACE } from "../economy";
import { builtCrateAt, damageBuiltCrate } from "./building";
import { hurt, rewardZombie } from "./combat";
import type { SimContext } from "./context";
import { emit } from "./events";
import { destroyCover } from "./loot";
import { effectContext } from "./match";

/** Cosine of the half-angle of a melee swing: targets within about 61 degrees of the aim. */
const MELEE_ARC_COSINE = 0.48;

export function equip(ctx: SimContext, p: Player, item: Equipment) {
  if (item === p.equipped || !canEquip(p, item)) return;
  p.equipped = item;
  emit(ctx, p, "切换装备", { type: "equip", item });
}

/** The primary action: plant a bomb, swing, self-use, or throw, depending on what is equipped. */
export function useEquipment(
  ctx: SimContext,
  p: Player,
  target?: PlayerInput["aimTarget"],
  mode: PlayerInput["throwMode"] = "direct",
  meleeYaw = p.yaw,
) {
  const s = ctx.state,
    kind = p.equipped;
  if (kind === "bomb") {
    placeBomb(ctx, p, target);
    return;
  }
  if (!canEquip(p, kind)) return;
  const def = ITEMS[kind];
  if (def.melee) {
    swing(ctx, p, kind, def.melee, Number.isFinite(meleeYaw) ? meleeYaw : p.yaw);
    return;
  }
  if (def.onUse) {
    if (!def.onUse(p, effectContext(ctx, p))) return;
  } else if (def.throwable && target && canPlace(s, p, target, kind, mode)) {
    s.thrown.push({
      ...target,
      id: ctx.nextId(),
      ownerId: p.id,
      kind,
      mode,
      origin: { x: p.x, z: p.z, elevation: p.elevation },
      landsAt: s.time + def.throwable.flight,
      power: p.attack,
    });
  } else return;
  emit(ctx, p, combatMessage(def.throwable ? "投出{0}" : "使用{0}", def), { type: "equipment", item: kind });
  if (!def.permanent && --p.inventory[kind] === 0) p.equipped = "bomb";
}

/** Hits the nearest target in the arc, unless cover that the weapon can damage is closer. */
function swing(
  ctx: SimContext,
  p: Player,
  kind: ItemId,
  melee: NonNullable<ItemDefinition["melee"]>,
  yaw: number,
) {
  const s = ctx.state,
    cooldown = "equipment:" + kind;
  if ((p.cooldowns[cooldown] ?? 0) > s.time) return;
  p.cooldowns[cooldown] = s.time + melee.cooldown;
  emit(ctx, p, "挥击", { type: "melee", item: kind });
  let closest = melee.reach,
    target: Player | Zombie | undefined;
  for (const enemy of [...s.players, ...s.zombies]) {
    const player = "alive" in enemy;
    if (
      enemy === p ||
      (player && !enemy.alive) ||
      (!player && enemy.spawnAt !== undefined && s.time < enemy.spawnAt + SUMMON_TIME)
    )
      continue;
    const dx = enemy.x - p.x,
      dz = enemy.z - p.z,
      distance = Math.hypot(dx, dz);
    if (
      distance > closest ||
      -dx * Math.sin(yaw) - dz * Math.cos(yaw) < distance * MELEE_ARC_COSINE ||
      !clearSight(s, p, enemy)
    )
      continue;
    target = enemy;
    closest = distance;
  }
  if (melee.coverDamage && melee.coverDamage > 0) {
    const block = firstBlocker(s, p, {
      x: p.x - Math.sin(yaw) * melee.reach,
      z: p.z - Math.cos(yaw) * melee.reach,
    });
    if (block && block.fraction * melee.reach <= closest && s.tiles[block.z]?.[block.x] === 2) {
      const { x, z } = block;
      if (builtCrateAt(s, x, z)) {
        emit(ctx, p, "击中掩体", { type: "cover-hit", item: kind, coverSurface: BUILT_CRATE_SURFACE }, block);
        if (damageBuiltCrate(ctx, p, x, z, melee.coverDamage))
          emit(ctx, p, combatMessage("摧毁掩体 · +{0} 积分", 0), { type: "cover", item: kind }, block);
        return;
      }
      const cell = z * s.size + x,
        origin = s.coverOrigins?.[cell] ?? cell;
      const { cover } = ctx.coverAt(origin % s.size, Math.floor(origin / s.size));
      emit(ctx, p, "击中掩体", { type: "cover-hit", item: kind, coverSurface: coverSurface(cover) }, block);
      const damage = (s.coverDamage ??= {});
      damage[origin] = (damage[origin] ?? 0) + melee.coverDamage;
      if (damage[origin] >= COMBAT.coverDurability) {
        const reward = destroyCover(ctx, p, x, z);
        emit(ctx, p, combatMessage("摧毁掩体 · +{0} 积分", reward), { type: "cover", item: kind }, block);
      }
      return;
    }
  }
  if (!target) return;
  if ("alive" in target) {
    if (target.invulnerableUntil <= s.time)
      hurt(ctx, target, p.id, melee.damage, "近战", COMBAT.meleeImmunity, kind);
  } else if (ctx.undead.strike(s, target, melee.damage, p)) rewardZombie(ctx, target, p, kind);
  else
    emit(
      ctx,
      p,
      combatMessage("命中 Lv.{0} 僵尸", target.level),
      { type: "hit", item: kind, zombie: { id: target.id, level: target.level, outcome: "hurt" } },
      target,
    );
}
