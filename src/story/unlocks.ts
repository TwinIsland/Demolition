import { Setting, textCodec } from "../app/storage";
import { DEFAULT_KNIFE } from "../core/knife-styles";
import { BOMB_STYLES } from "../core/room";
import { nextAct } from "./chapters";
import { loadStory } from "./save";

/**
 * What finishing the story earns for versus play: the modelled bomb finishes, every knife but
 * the service knife, and the story's own map. Once earned they stay, also when a new game wipes
 * the story's progress.
 */
const cleared = new Setting<"1">({
  key: "demolition-story-cleared",
  codec: textCodec((text): text is "1" => text === "1"),
});

/** True once the story has been played to its end, now or at any time before. */
export function storyCleared(): boolean {
  if (cleared.load()) return true;
  if (nextAct(loadStory())) return false;
  cleared.save("1");
  return true;
}

/** Maps the story takes place on; they open for versus play with its ending. */
const STORY_MAPS: ReadonlySet<string> = new Set(["flatland"]);

export const mapLocked = (id: string) => STORY_MAPS.has(id) && !storyCleared();
export const finishLocked = (id: string) => !!BOMB_STYLES[id]?.model && !storyCleared();
export const knifeLocked = (id: string) => id !== DEFAULT_KNIFE.id && !storyCleared();
