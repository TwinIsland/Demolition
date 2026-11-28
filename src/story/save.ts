import { isRecord, jsonCodec, Setting } from "../app/storage";

/** The only story so far; later stories get their own entry in `StorySave.stories`. */
export const MAIN_STORY = "ascension";

type FlagValue = string | number | boolean;

/**
 * Story progress. Everything is keyed by string IDs, never by position, so chapters and
 * checkpoints can be inserted or reordered without invalidating a save; unknown IDs are kept.
 * The story resumes from the last checkpoint reached, not from a snapshot of the scene.
 */
export interface StorySave {
  stories: Record<string, { checkpoints: string[] }>;
  /** Choices and collectibles that later scenes may read. */
  flags: Record<string, FlagValue>;
  /** When a checkpoint was last reached, in milliseconds since the epoch. */
  playedAt?: number;
}

const isFlag = (value: unknown): value is FlagValue =>
  typeof value === "string" || typeof value === "boolean" || Number.isFinite(value);

function validate(raw: unknown): StorySave | undefined {
  if (!isRecord(raw) || !isRecord(raw.stories)) return undefined;
  const stories: StorySave["stories"] = {};
  for (const [id, entry] of Object.entries(raw.stories)) {
    if (!isRecord(entry) || !Array.isArray(entry.checkpoints)) continue;
    stories[id] = { checkpoints: entry.checkpoints.filter((c): c is string => typeof c === "string") };
  }
  const flags: StorySave["flags"] = {};
  if (isRecord(raw.flags))
    for (const [id, value] of Object.entries(raw.flags)) if (isFlag(value)) flags[id] = value;
  const playedAt =
    typeof raw.playedAt === "number" && Number.isFinite(raw.playedAt) ? raw.playedAt : undefined;
  return { stories, flags, playedAt };
}

const setting = new Setting<StorySave>({ key: "demolition-story-v1", codec: jsonCodec(validate) });

export const loadStory = (): StorySave => setting.load() ?? { stories: {}, flags: {} };

export const hasCheckpoint = (save: StorySave, checkpoint: string, story = MAIN_STORY) =>
  !!save.stories[story]?.checkpoints.includes(checkpoint);

/** Records a checkpoint and the flags gathered on the way to it, then writes the save. */
export function reachCheckpoint(checkpoint: string, flags: StorySave["flags"] = {}, story = MAIN_STORY) {
  const save = loadStory();
  const entry = (save.stories[story] ??= { checkpoints: [] });
  if (!entry.checkpoints.includes(checkpoint)) entry.checkpoints.push(checkpoint);
  Object.assign(save.flags, flags);
  save.playedAt = Date.now();
  setting.save(save);
  return save;
}

/** Forgets one story's progress and every flag, for a new game. Other stories keep theirs. */
export function resetStory(story = MAIN_STORY) {
  const save = loadStory();
  delete save.stories[story];
  setting.save({ stories: save.stories, flags: {} });
}
