import { jsonCodec, Setting } from "../../app/storage";

/** The two ways the story ends. */
export type Ending = "home" | "stay";

/**
 * What finishing the story gives: going home leaves the player Lulu's skin, staying leaves them
 * Zero's. Kept apart from the story save, so that a new game does not take a reward back.
 */
export const ENDING_SKINS: Record<Ending, { skin: string; name: string }> = {
  home: { skin: "story-lulu", name: "露露" },
  stay: { skin: "story-zero", name: "零" },
};

const setting = new Setting<Ending[]>({
  key: "demolition-story-unlocks",
  codec: jsonCodec((raw) =>
    Array.isArray(raw) ? raw.filter((id): id is Ending => id === "home" || id === "stay") : undefined,
  ),
});

/** Endings seen so far, in the order they were reached. */
export const endingsSeen = (): Ending[] => setting.load() ?? [];

/** Skins the story has handed out, by the id the renderer knows them under. */
export const unlockedSkins = () => endingsSeen().map((ending) => ENDING_SKINS[ending]);

/** Records an ending. Returns true the first time it is reached. */
export function reachEnding(ending: Ending) {
  const seen = endingsSeen();
  if (seen.includes(ending)) return false;
  setting.save([...seen, ending]);
  return true;
}
