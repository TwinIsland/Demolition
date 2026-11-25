import { ZONE } from "../core/zone";
import {
  BOMB_STYLES,
  DEFAULT_FINISH,
  DEFAULT_SKIN,
  SKIN_PRESETS,
  ZOMBIE_RATES,
  type Appearance,
  type ZombieRate,
} from "../core/room";
import type { SkinModel } from "../render/minecraft-skins";
import { Setting, isRecord, jsonCodec, readEntry, textCodec } from "./storage";

/** State of the imported PNG skin. The entries are written by the renderer's skin loader. */
export interface CustomSkin {
  imported: boolean;
  model?: SkinModel;
}

const isSkinModel = (text: string | undefined): text is SkinModel =>
  text === "auto" || text === "default" || text === "slim";

export function readCustomSkin(): CustomSkin {
  const model = readEntry("demolition-skin-model");
  return { imported: !!readEntry("demolition-skin"), model: isSkinModel(model) ? model : undefined };
}

export const isZombieRate = (text: string): text is ZombieRate => Object.hasOwn(ZOMBIE_RATES, text);

const appearance = new Setting<Partial<Appearance>>({
  key: "demolition-appearance",
  // Fields are checked one by one so a skin or finish pack that was removed only resets its own field.
  codec: jsonCodec((raw) => {
    if (!isRecord(raw)) return undefined;
    const saved: Partial<Appearance> = {};
    const { skin, bombStyle } = raw;
    if (typeof skin === "string" && (Object.hasOwn(SKIN_PRESETS, skin) || skin === "custom"))
      saved.skin = skin;
    if (typeof bombStyle === "string" && Object.hasOwn(BOMB_STYLES, bombStyle)) saved.bombStyle = bombStyle;
    return saved;
  }),
});

const zombieRate = new Setting<ZombieRate>({
  key: "demolition-zombie-rate",
  codec: textCodec(isZombieRate),
});

const zoneDuration = new Setting<string>({
  key: "demolition-zone-duration",
  codec: textCodec((text): text is string => (ZONE.durations as readonly number[]).includes(Number(text))),
});

export const loadZoneDuration = (): number => Number(zoneDuration.load() ?? ZONE.defaultDuration);
export const saveZoneDuration = (seconds: number) => zoneDuration.save(String(seconds));

export function loadAppearance(): Appearance {
  return {
    skin: readCustomSkin().imported ? "custom" : DEFAULT_SKIN.id,
    bombStyle: DEFAULT_FINISH.id,
    ...appearance.load(),
  };
}

export function saveAppearance(value: Appearance) {
  appearance.save(value);
}

export function loadZombieRate(): ZombieRate {
  return zombieRate.load() ?? "normal";
}

export function saveZombieRate(value: ZombieRate) {
  zombieRate.save(value);
}
