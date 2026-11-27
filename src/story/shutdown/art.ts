/**
 * Art of act 5 and its endings. The two pixel rooms are always there (tools/story/make-act5.py
 * makes them); the comic panels are the owner's paintings and may not have been delivered yet,
 * so each is optional and the act has a shot of its own to fall back on.
 */
const found = import.meta.glob<string>("./art/*.{png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});
const art = (name: string): string | undefined =>
  Object.entries(found).find(([path]) => path.slice(path.lastIndexOf("/") + 1).split(".")[0] === name)?.[1];

export const SHUTDOWN_ART = {
  bedroomMorning: art("bedroom-morning")!,
  dining: art("dining")!,
  /** Panel 5: the wall of fire with a progress bar in it. */
  wall: art("comic-5"),
  /** Panel 5b: the Four Heavenly Kings, all three of them. */
  kings: art("comic-5b"),
  /** Panel 6a: the bedroom in the morning. */
  home: art("comic-6a"),
  /** Panel 6b: two guides and an empty text box. */
  stay: art("comic-6b"),
} as const;

/** For the loading screen. */
export const shutdownImages = (): string[] =>
  Object.values(SHUTDOWN_ART).filter((url): url is string => !!url);
