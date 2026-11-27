/** Story art, bundled with the game and decoded on the loading screen like every other image. */
const url = (file: string) => new URL(`./assets/${file}`, import.meta.url).href;

export const STORY_ART = {
  bedroom: url("bedroom.png"),
  comic1: url("comic-1.webp"),
  zeroWalk: url("zero-walk.png"),
  zeroSkin: url("zero-skin.png"),
} as const;

/** Zero's dialogue portraits, by mood. */
export const ZERO_PORTRAITS = {
  smug: url("zero-smug.png"),
  flustered: url("zero-flustered.png"),
  sincere: url("zero-sincere.png"),
} as const;
export type Mood = keyof typeof ZERO_PORTRAITS;

export const storyImages = (): string[] => [...Object.values(STORY_ART), ...Object.values(ZERO_PORTRAITS)];
