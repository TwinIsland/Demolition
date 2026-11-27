import { jsonCodec, Setting } from "../app/storage";
import { STORY_ART } from "./assets";
import { ASCENSION_ART } from "./ascend/assets";
import { SHUTDOWN_ART } from "./shutdown/art";
import { endingsSeen } from "./shutdown/unlocks";
import { hasCheckpoint, loadStory } from "./save";

interface Illustration {
  id: string;
  title: string;
  url: string | undefined;
  /** Completed checkpoints prove this picture appeared in an older save. */
  checkpoints?: readonly string[];
  ending?: "home" | "stay";
}

export const ILLUSTRATIONS: readonly Illustration[] = [
  { id: "comic-1", title: "凡俗的牢笼", url: STORY_ART.comic1, checkpoints: ["act1-done"] },
  { id: "comic-2", title: "泡泡 X", url: STORY_ART.comic2, checkpoints: ["act2-done"] },
  { id: "comic-3", title: "平面国", url: STORY_ART.comic3, checkpoints: ["act3-arrive", "act3-done"] },
  { id: "comic-3b", title: "升维打击器", url: STORY_ART.comic3b, checkpoints: ["act3-done"] },
  {
    id: "comic-4",
    title: "升维",
    url: ASCENSION_ART.panel,
    checkpoints: ["act4-arrive", "act4-gear", "act4-done"],
  },
  {
    id: "comic-4b",
    title: "第一次看见天空",
    url: ASCENSION_ART.sky4b,
    checkpoints: ["act4-arrive", "act4-gear", "act4-done"],
  },
  { id: "comic-4c", title: "没有通关的人", url: ASCENSION_ART.risen, checkpoints: ["act4-done"] },
  { id: "comic-5", title: "关机", url: SHUTDOWN_ART.wall, checkpoints: ["act5-fight", "act5-done"] },
  { id: "comic-5b", title: "四天王", url: SHUTDOWN_ART.kings, checkpoints: ["act5-fight", "act5-done"] },
  { id: "comic-6a", title: "回去", url: SHUTDOWN_ART.home, ending: "home" },
  { id: "comic-6b", title: "留下", url: SHUTDOWN_ART.stay, ending: "stay" },
];

// Like ending rewards, the collection survives starting a new story.
const setting = new Setting<string[]>({
  key: "demolition-story-gallery-v1",
  codec: jsonCodec((raw) =>
    Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : undefined,
  ),
});

export function unlockedIllustrations(): Set<string> {
  const saved = setting.load();
  if (saved) return new Set(saved);
  // Migrate once. After this, only actually showing an illustration grants its unlock.
  const unlocked = new Set<string>();
  const story = loadStory();
  const endings = endingsSeen();
  for (const art of ILLUSTRATIONS) {
    if (
      art.checkpoints?.some((checkpoint) => hasCheckpoint(story, checkpoint)) ||
      (art.ending && endings.includes(art.ending))
    )
      unlocked.add(art.id);
  }
  setting.save([...unlocked]);
  return unlocked;
}

/** Called only when a story illustration is actually put on screen, never by menu previews. */
export function unlockIllustration(url: string) {
  const art = ILLUSTRATIONS.find((candidate) => candidate.url === url);
  if (!art) return;
  const unlocked = unlockedIllustrations();
  if (unlocked.has(art.id)) return;
  unlocked.add(art.id);
  setting.save([...unlocked]);
}
