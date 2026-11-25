import modules from "#game-catalog";
import type { Hooks, ItemDefinition, PerkDefinition, SkillDefinition, Tier } from "./module-api";
import type { Player } from "./types";

export type { PerkDefinition } from "./module-api";
export const TIERS = {
  silver: { name: "白银", weight: 61, color: "#bdcad4", sound: "perk-silver" },
  gold: { name: "黄金", weight: 30, color: "#f6c261", sound: "perk-gold" },
  diamond: { name: "钻石", weight: 8, color: "#93e6ff", sound: "perk-diamond" },
  mythic: { name: "神话", weight: 1, color: "#dc9cff", sound: "perk-diamond" },
} satisfies Record<Tier,{name:string; weight:number; color:string; sound:string}>;
export const SLOT_LIMIT = 4;
export const RULES = {
  fuse: 2.65,
  blastDuration: 0.42,
  duration: 180,
  step: 1 / 60,
  playerRadius: 0.24,
  baseSpeed: 2.3,
  jumpSpeed: 9.4,
  jumpGravity: 36,
  fallGravity: 48,
  baseRange: 2,
  baseCapacity: 2,
} as const;

const items: Record<string, ItemDefinition> = Object.create(null);
const skills: Record<string, SkillDefinition> = Object.create(null);
const perks: Record<string, PerkDefinition> = Object.create(null);
export const HAS_TICK_HOOKS = modules.some(m=>m.kind!=="item" && m.onTick);
const bindings = new Map<string,string>();
const ordered = [...modules].sort((a,b)=>(a.order ?? 100)-(b.order ?? 100) || a.id.localeCompare(b.id,"en"));
for (const mod of ordered) {
  if (!/^[a-z][a-z0-9-]*$/.test(mod.id) || mod.id in Object.prototype || !mod.name || !mod.icon)
    throw new Error(`Invalid ${mod.kind} config: ${mod.id}`);
  const table = mod.kind === "skill" ? skills : mod.kind === "perk" ? perks : items;
  if (table[mod.id]) throw new Error(`Duplicate ${mod.kind} ID: ${mod.id}`);
  if (mod.kind === "skill") {
    if (![mod.price,mod.cooldown,mod.duration].every(n=>Number.isFinite(n) && n>=0))
      throw new Error(`Invalid skill price or timing: ${mod.id}`);
    if (!mod.passive && !mod.activate) throw new Error(`Missing activate: ${mod.id}`);
    if (mod.code) {
      if (bindings.has(mod.code)) throw new Error(`Duplicate skill key: ${mod.code}`);
      bindings.set(mod.code, mod.id);
    }
    skills[mod.id] = mod;
  } else {
    if (!Number.isFinite(mod.weight) || mod.weight < 0) throw new Error(`Invalid weight: ${mod.id}`);
    if (mod.kind === "perk") {
      if (!Object.hasOwn(TIERS,mod.tier)) throw new Error(`Unknown perk tier: ${mod.id}`);
      perks[mod.id] = mod;
    } else {
      if (mod.pool !== "supply" && mod.pool !== "elite") throw new Error(`Unknown item pool: ${mod.id}`);
      if (mod.id === "bomb" || (mod.throwable && (mod.onUse || !mod.onLand || !(mod.throwable.flight > 0) || !(mod.throwable.reach > 0))))
        throw new Error(`Invalid equipment: ${mod.id}`);
      items[mod.id] = mod;
    }
  }
}
export const SKILLS = Object.freeze(skills);
export const ITEMS = Object.freeze(items);
export const PERKS = Object.values(perks);
export const SHOP_SKILLS = Object.keys(skills);
export const isEquipment = (item: ItemDefinition) => Boolean(item.throwable || item.onUse || item.melee);
const equipment = Object.values(items).filter(isEquipment);
export const CONSUMABLES = equipment.filter(item => !item.permanent).map(item => item.id);
export const EQUIPMENT_SLOTS = ["bomb", ...equipment.map(item => item.id)];
/** Looks up the module's default key, independently of local player settings. */
export const skillForKey = (code:string) => bindings.get(code);
export const perkById = (id:string) => perks[id];

export function eachOwned(p:Player, visit:(hooks:Hooks, stacks:number)=>void) {
  for (const id of p.skills) if (skills[id]) visit(skills[id],1);
  if (!p.perks.length) return;
  const stacks = new Map<string,number>();
  for (const id of p.perks) stacks.set(id,(stacks.get(id) ?? 0)+1);
  for (const [id,n] of stacks) if (perks[id]) visit(perks[id],n);
}
export function modifiedStat(p:Player, stat:keyof NonNullable<Hooks["modifiers"]>, base:number, time=0) {
  let value=base;
  eachOwned(p,(hooks,n)=>{
    const modify=hooks.modifiers?.[stat];
    if (modify) value=modify(value,p,n,time);
  });
  return value;
}

export function rollPerks(player:Player, random:()=>number, previous:string[]=[], guaranteeRare=false, supportsTerrainReset=false) {
  const pool = PERKS.filter(p => p.weight > 0 &&
    (!p.requiresTerrainReset || supportsTerrainReset) &&
    (!p.requiresSkill || player.skills.includes(p.requiresSkill)) &&
    (!p.requiresActiveSkill || player.skills.some(id=>skills[id]?.activate)) &&
    (!p.eligible || p.eligible(player)));
  const offers:string[]=[];
  while (offers.length<3 && pool.length) {
    let tiers=(Object.keys(TIERS) as Tier[]).filter(t=>pool.some(p=>p.tier===t));
    if (guaranteeRare && offers.length===2 && offers.every(id=>perks[id].tier==="silver") && tiers.some(t=>t!=="silver"))
      tiers=tiers.filter(t=>t!=="silver");
    let roll=random()*tiers.reduce((sum,t)=>sum+TIERS[t].weight,0);
    const tier=tiers.find(t=>(roll-=TIERS[t].weight)<0) ?? tiers[0];
    const choices=pool.filter(p=>p.tier===tier);
    const weight=(p:PerkDefinition)=>p.weight*(previous.includes(p.id)?1:2);
    let pick=random()*choices.reduce((sum,p)=>sum+weight(p),0);
    const chosen=choices.find(p=>(pick-=weight(p))<0) ?? choices[0];
    offers.push(chosen.id);
    pool.splice(pool.indexOf(chosen),1);
  }
  return offers;
}
