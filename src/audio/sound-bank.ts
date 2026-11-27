/** Mix buses; each has its own volume on top of the master mute. */
export type AudioBus = "music" | "sfx" | "ui";

export interface CueSpec {
  url: string;
  bus: AudioBus;
  /** Default playback level before per-play gain and bus volume. */
  volume: number;
  /** Simultaneous voices; the oldest one is released when exceeded. */
  voices: number;
  /** Seconds that must pass before the cue may retrigger. */
  minInterval: number;
  /** Random playback-rate spread (0.04 = +-4%) so repeats do not sound stamped. */
  pitchJitter: number;
}

type CueDef = Omit<CueSpec, "url">;

const sfx = (volume: number, tweaks: Partial<CueDef> = {}): CueDef => ({
  bus: "sfx",
  volume,
  voices: 3,
  minInterval: 0.03,
  pitchJitter: 0,
  ...tweaks,
});
const ui = (volume: number, tweaks: Partial<CueDef> = {}): CueDef =>
  sfx(volume, { bus: "ui", voices: 2, minInterval: 0.04, ...tweaks });

/** Recordings shipped in public/assets, keyed by file stem. */
const CUES = {
  "ui-click": ui(0.42),
  "ui-accept": ui(0.42),
  "ui-back": ui(0.42),
  "aim-step": ui(0.26, { minInterval: 0.055 }),
  "clock-pulse": ui(0.5, { minInterval: 0.1 }),
  "deploy-signal": ui(0.5, { minInterval: 0.1 }),
  "level-up": ui(0.5),
  "shop-open": ui(0.5, { voices: 1 }),
  "shop-close": ui(0.5, { voices: 1 }),
  "shop-buy": ui(0.46),
  "shop-deny": ui(0.4, { minInterval: 0.2 }),
  "match-victory": ui(0.6, { voices: 1, minInterval: 1 }),
  "match-eliminated": ui(0.62, { voices: 1, minInterval: 1 }),
  "type-tick": ui(0.2, { voices: 3, minInterval: 0.03, pitchJitter: 0.05 }),
  "perk-embers": ui(0.6),
  "perk-silver": ui(0.46),
  "perk-gold": ui(0.46),
  "perk-diamond": ui(0.46),
  "mutation-award": ui(0.58),
  "reset-signal": sfx(0.56, { voices: 2 }),
  "room-shift": sfx(0.7, { voices: 1 }),
  "footstep-0": sfx(0.22, { pitchJitter: 0.04 }),
  "footstep-1": sfx(0.22, { pitchJitter: 0.04 }),
  "footstep-2": sfx(0.22, { pitchJitter: 0.04 }),
  "footstep-grass-0": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-grass-1": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-grass-2": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-mud-0": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-mud-1": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-mud-2": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-water-0": sfx(0.36, { pitchJitter: 0.07 }),
  "footstep-water-1": sfx(0.36, { pitchJitter: 0.07 }),
  "footstep-water-2": sfx(0.36, { pitchJitter: 0.07 }),
  "footstep-carpet-0": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-carpet-1": sfx(0.3, { pitchJitter: 0.05 }),
  "footstep-carpet-2": sfx(0.3, { pitchJitter: 0.05 }),
  // Pitch stays fixed: the beep is a timing signal.
  "fuse-tick": sfx(0.32, { voices: 4, minInterval: 0.02 }),
  blast: sfx(0.5, { voices: 4, minInterval: 0.06, pitchJitter: 0.04 }),
  "blast-ringing": sfx(0.2, { voices: 1 }),
  "missile-incoming": sfx(0.62, { voices: 2, minInterval: 0.2 }),
  "missile-impact": sfx(0.85, { voices: 2, minInterval: 0.1 }),
  // A fuse hiss about as long as the fuse itself, so several can burn at once.
  "bomb-place": sfx(0.9, { voices: 6, pitchJitter: 0.03 }),
  "fire-ignite": sfx(0.6, { voices: 3, minInterval: 0.08, pitchJitter: 0.04 }),
  "crate-build": sfx(0.9, { voices: 3, minInterval: 0.05, pitchJitter: 0.1 }),
  "gear-equip": sfx(0.5, { voices: 2 }),
  "gear-throw": sfx(0.46, { pitchJitter: 0.04 }),
  "gear-pickup": sfx(0.6, { pitchJitter: 0.08 }),
  "pickup-confirm": sfx(0.6, { pitchJitter: 0.08 }),
  "skill-cast": sfx(0.42),
  hurt: sfx(0.62, { pitchJitter: 0.04 }),
  // Damage taken and damage dealt: on the interface bus so no blast or fire bed can bury them.
  "player-hurt-0": ui(0.8, { voices: 2, minInterval: 0.2, pitchJitter: 0.08 }),
  "player-hurt-1": ui(0.8, { voices: 2, minInterval: 0.2, pitchJitter: 0.08 }),
  "player-hurt-2": ui(0.8, { voices: 2, minInterval: 0.2, pitchJitter: 0.08 }),
  "player-attack-0": ui(0.65, { voices: 3, minInterval: 0.04, pitchJitter: 0.06 }),
  "player-attack-1": ui(0.65, { voices: 3, minInterval: 0.04, pitchJitter: 0.06 }),
  "player-attack-2": ui(0.65, { voices: 3, minInterval: 0.04, pitchJitter: 0.06 }),
  "shield-block": sfx(0.62, { pitchJitter: 0.04 }),
  hit: sfx(0.6, { minInterval: 0.05, pitchJitter: 0.04 }),
  "zombie-death": sfx(0.5, { pitchJitter: 0.04 }),
  "zombie-hurt-1": sfx(0.5, { minInterval: 0.06, pitchJitter: 0.04 }),
  "zombie-hurt-2": sfx(0.5, { minInterval: 0.06, pitchJitter: 0.04 }),
  "zombie-spawn": sfx(0.5, { voices: 2, minInterval: 0.12, pitchJitter: 0.06 }),
  "zombie-attack-0": sfx(0.55, { voices: 2, minInterval: 0.08, pitchJitter: 0.05 }),
  "zombie-attack-1": sfx(0.55, { voices: 2, minInterval: 0.08, pitchJitter: 0.05 }),
  "zombie-groan-0": sfx(0.4, { voices: 1, pitchJitter: 0.08 }),
  "zombie-groan-1": sfx(0.4, { voices: 1, pitchJitter: 0.08 }),
  "zombie-groan-2": sfx(0.4, { voices: 1, pitchJitter: 0.08 }),
  "glass-shatter": sfx(0.7, { voices: 2, minInterval: 0.06, pitchJitter: 0.04 }),
  "bomb-kick": sfx(0.6, { minInterval: 0.08, pitchJitter: 0.05 }),
  "cover-break-0": sfx(0.6, { minInterval: 0.05, pitchJitter: 0.06 }),
  "cover-break-1": sfx(0.6, { minInterval: 0.05, pitchJitter: 0.06 }),
  "body-fall": sfx(0.7, { voices: 2, minInterval: 0.1, pitchJitter: 0.04 }),
  "zone-wall": sfx(0.8, { voices: 1, minInterval: 0.5 }),
  "kill-confirm": ui(0.72, { voices: 2, minInterval: 0.1 }),
} satisfies Record<string, CueDef>;

export type CueId = keyof typeof CUES;

/** Cues that content modules reference by URL; callers pass the level for the role. */
const MODULE_CUE: CueDef = sfx(0.5, { pitchJitter: 0.04 });

export const MENU_MUSIC = "./assets/volatile-reaction.mp3";
export const MUSIC_VOLUME = 0.18;
export const FIRE_LOOP: CueSpec = { url: "./assets/arena-fire.ogg", ...sfx(0.8, { voices: 1 }) };
export const RAIN_LOOP: CueSpec = { url: "./assets/environment/rain.ogg", ...sfx(0.3, { voices: 1 }) };
/** Insects, birds and frogs under the rain on forest maps. */
export const JUNGLE_LOOP: CueSpec = { url: "./assets/environment/jungle.ogg", ...sfx(0.34, { voices: 1 }) };
/** Light ballasts, ventilation and lapping water in a tiled hall. */
export const POOL_LOOP: CueSpec = { url: "./assets/environment/poolrooms.ogg", ...sfx(0.5, { voices: 1 }) };
/** Fluorescent tubes and far-off air handling on an office floor. */
export const OFFICE_LOOP: CueSpec = {
  url: "./assets/environment/backrooms.ogg",
  ...sfx(0.42, { voices: 1 }),
};
const thunder = (name: string): CueSpec => ({
  url: `./assets/environment/${name}.ogg`,
  ...sfx(0.7, { voices: 1, minInterval: 2, pitchJitter: 0.06 }),
});
export const THUNDER = { near: thunder("thunder-near"), far: thunder("thunder-far") };

const cueUrl = (ref: string) => (ref.includes("/") || ref.includes(":") ? ref : `./assets/${ref}.ogg`);

const specs = new Map<string, CueSpec>();

/** Resolves a bank id or a module-supplied URL to its playback spec. */
export function cue(ref: CueId | (string & {})): CueSpec {
  let spec = specs.get(ref);
  if (!spec) {
    const def = Object.hasOwn(CUES, ref) ? CUES[ref as CueId] : MODULE_CUE;
    spec = { url: cueUrl(ref), ...def };
    specs.set(ref, spec);
  }
  return spec;
}

export const BANK_CUES = Object.keys(CUES) as CueId[];
