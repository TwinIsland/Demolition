import type { VolumeChannel } from "../audio/sound";
import type { MatchMode } from "../core/match-modes";
import type { Appearance, BotSlot, ZombieRate } from "../core/room";
import type { ItemId, PerkId, SkillId, Vec2 } from "../core/types";
import type { Language } from "../i18n";
import type { GraphicsSettings } from "../render/graphics-settings";
import type { SkinModel } from "../render/minecraft-skins";

/** Everything the UI can ask the app to do. The UI never changes game or app state itself. */
export interface UIActions {
  // Lobby
  selectMode(id: MatchMode): void;
  selectMap(id: string): void;
  toggleTerrainPreview(): void;
  changeOutfit(value: Partial<Appearance>): void;
  importSkin(file: File | undefined, model: SkinModel): Promise<void>;
  openRoom(): void;
  // Match room and shop
  configureBot(id: string, changes: Partial<Pick<BotSlot, "skin" | "enabled" | "difficulty">>): void;
  setZombieRate(value: ZombieRate): void;
  setZoneDuration(seconds: number): void;
  drawPortrait(canvas: HTMLElement, skin: string, seat: number): Promise<void>;
  enterShop(): void;
  tradeSkill(id: SkillId, refund: boolean): void;
  deploy(): void;
  // Match
  activateSkill(id: SkillId): void;
  choosePerk(id: PerkId): void;
  usePerk(id: PerkId): void;
  /** Targeting tablet: fire at the picked cell, or put the tablet away. */
  confirmStrike(target: Vec2): void;
  cancelStrike(): void;
  /** In-match supply shop. */
  canShop(): boolean;
  /** Holds camera look and equipment use while the supply wheel is open. */
  setShopSelecting(selecting: boolean): void;
  shopTick(): void;
  buySupply(id: ItemId): void;
  shopSound(cue: "open" | "close" | "buy" | "deny"): void;
  openChat(): void;
  pause(): void;
  resume(): void;
  goHome(): void;
  // Settings and chrome
  openHelp(): void;
  openGraphics(): void;
  changeGraphics(value: GraphicsSettings): void;
  closeGraphics(): void;
  /** A fader moved in the settings; `position` is 0 to 1. */
  setVolume(channel: VolumeChannel, position: number): void;
  /** A fader was let go: sound a sample on its bus. */
  previewVolume(channel: VolumeChannel): void;
  /** Credits roll, opened from the lobby. */
  openCredits(): void;
  closeCredits(): void;
  setLanguage(value: Language): void;
  toggleSound(): void;
  /** Feedback for a click that triggers nothing with its own sound. */
  playClick(): void;
  /** Cuts the slow-motion replay short. */
  skipReplay(): void;
}
