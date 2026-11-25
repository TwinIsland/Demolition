import { skins, finishes } from "#game-catalog";
import { indexPacks } from "./pack-api";
import type { Difficulty } from "./types";

export const SKINS = indexPacks(skins,"skin");
export const BOMB_STYLES = indexPacks(finishes,"bomb finish");
export const SKIN_PRESETS = Object.fromEntries(Object.values(SKINS).map(s => [s.id,s.name]));
export const DEFAULT_SKIN = SKINS.hacksore ?? Object.values(SKINS)[0];
export const DEFAULT_FINISH = BOMB_STYLES.standard ?? Object.values(BOMB_STYLES)[0];
export type AvatarSkin = string;
export type BombStyle = string;
export type Appearance = { skin: AvatarSkin | "custom"; bombStyle: BombStyle };
export const ZOMBIE_RATES = {
  off: { name:"关闭", first:Infinity, min:0, max:0 },
  low: { name:"低", first:8, min:10, max:17 },
  normal: { name:"标准", first:4, min:5, max:9 },
  high: { name:"高", first:2.5, min:2.5, max:5 },
} as const;
export type ZombieRate = keyof typeof ZOMBIE_RATES;
export const BOT_PROFILES = [
  { id:"momo", name:"MOMO", color:"#6dbcf7", skin:"hacksore" },
  { id:"mint", name:"MINT", color:"#5be1a8", skin:"haka" },
  { id:"sunny", name:"SUNNY", color:"#e7c65f", skin:"haka" },
] as const;
export interface BotSlot {
  id: typeof BOT_PROFILES[number]["id"];
  enabled: boolean;
  skin: AvatarSkin;
  difficulty: Difficulty;
}
export function defaultSlots(difficulty: Difficulty = "normal"): BotSlot[] {
  return BOT_PROFILES.map(p=>({id:p.id, enabled:true, skin:SKINS[p.skin]?.id ?? DEFAULT_SKIN.id, difficulty}));
}
