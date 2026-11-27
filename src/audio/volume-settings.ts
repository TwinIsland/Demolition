import { Setting, isRecord, jsonCodec } from "../app/storage";
import { AUDIO_BUSES } from "./sound-bank";

/** Faders the player can set: the output level, then one per mix bus. */
export const VOLUME_CHANNELS = ["master", ...AUDIO_BUSES] as const;
export type VolumeChannel = (typeof VOLUME_CHANNELS)[number];
/** Fader positions, 0 to 1. */
export type Volumes = Record<VolumeChannel, number>;

const DEFAULT_POSITION = 1;

const setting = new Setting<Partial<Volumes>>({
  key: "demolition-volume",
  // Read fader by fader, so a bus added later starts at its default instead of voiding the rest.
  codec: jsonCodec((raw) => {
    if (!isRecord(raw)) return undefined;
    const saved: Partial<Volumes> = {};
    for (const channel of VOLUME_CHANNELS) {
      const value = raw[channel];
      if (typeof value === "number" && value >= 0 && value <= 1) saved[channel] = value;
    }
    return saved;
  }),
});

export function loadVolumes(): Volumes {
  const saved = setting.load() ?? {};
  return Object.fromEntries(
    VOLUME_CHANNELS.map((channel) => [channel, saved[channel] ?? DEFAULT_POSITION]),
  ) as Volumes;
}

export function saveVolumes(volumes: Volumes) {
  setting.save(volumes);
}

/** Loudness follows roughly the square of the gain, so a squared fader feels even along its travel. */
export const faderGain = (position: number) => position * position;
