import { jsonCodec, Setting } from "../app/storage";
import { ASCENSION_ART } from "./ascend/assets";
import { STORY_ART } from "./assets";
import { hasCheckpoint, loadStory } from "./save";
import { SHUTDOWN_ART } from "./shutdown/art";
import { endingsSeen } from "./shutdown/unlocks";

/** The story's cutscenes, as the collection lists them: each can be watched again once seen. */
export const FILMS = [
  { id: "window-dusk", act: 1, title: "窗外的黄昏", cover: STORY_ART.comic1, checkpoints: ["act1-done"] },
  { id: "stare", act: 1, title: "玩偶的回望", cover: STORY_ART.comic1, checkpoints: ["act1-done"] },
  { id: "computer", act: 1, title: "开机", cover: STORY_ART.comic1, checkpoints: ["act1-done"] },
  { id: "pull-in", act: 2, title: "被屏幕吸入", cover: STORY_ART.comic2, checkpoints: ["act2-done"] },
  {
    id: "landing",
    act: 3,
    title: "坠入平面国",
    cover: STORY_ART.comic3,
    checkpoints: ["act3-arrive", "act3-done"],
  },
  {
    id: "lulu-card",
    act: 3,
    title: "露露登场",
    cover: STORY_ART.comic3,
    checkpoints: ["act3-arrive", "act3-done"],
  },
  { id: "rival-card", act: 3, title: "示例对手登场", cover: STORY_ART.comic3, checkpoints: ["act3-done"] },
  { id: "relic", act: 3, title: "升维打击器", cover: STORY_ART.comic3b, checkpoints: ["act3-done"] },
  {
    id: "ascension",
    act: 4,
    title: "升维",
    cover: ASCENSION_ART.panel,
    checkpoints: ["act4-arrive", "act4-gear", "act4-skill", "act4-done"],
  },
  {
    id: "status-queue",
    act: 4,
    title: "状态栏，打开",
    cover: ASCENSION_ART.risen,
    checkpoints: ["act4-done"],
  },
  { id: "final-form", act: 5, title: "最终形态", cover: SHUTDOWN_ART.kings, checkpoints: ["act5-done"] },
  { id: "farewell", act: 5, title: "世界的最后一块", cover: SHUTDOWN_ART.wall, checkpoints: ["act5-done"] },
  { id: "pull-out", act: 5, title: "回去", cover: SHUTDOWN_ART.home, ending: "home" },
  { id: "window-morning", act: 5, title: "清晨的窗", cover: SHUTDOWN_ART.home, ending: "home" },
  { id: "evening", act: 5, title: "留下的那个傍晚", cover: SHUTDOWN_ART.stay, ending: "stay" },
] as const satisfies readonly {
  id: string;
  act: number;
  title: string;
  /** An illustration of the same stretch of story, shown on the film's tile. */
  cover: string | undefined;
  /** Completed checkpoints prove the film played in a save older than this list. */
  checkpoints?: readonly string[];
  ending?: "home" | "stay";
}[];

export type FilmId = (typeof FILMS)[number]["id"];

export const isFilm = (id: string | undefined): id is FilmId => FILMS.some((film) => film.id === id);

// Like the illustrations, what has been seen survives starting a new story.
const setting = new Setting<string[]>({
  key: "demolition-story-films-v1",
  codec: jsonCodec((raw) =>
    Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : undefined,
  ),
});

export function unlockedFilms(): Set<string> {
  const saved = setting.load();
  if (saved) return new Set(saved);
  // Once, for saves made before the list existed: after this only playing a film unlocks it.
  const story = loadStory();
  const endings = endingsSeen();
  const unlocked = FILMS.filter(
    (film) =>
      ("checkpoints" in film && film.checkpoints.some((checkpoint) => hasCheckpoint(story, checkpoint))) ||
      ("ending" in film && endings.includes(film.ending)),
  ).map((film) => film.id);
  setting.save(unlocked);
  return new Set(unlocked);
}

/** Called by the story where a film starts to play. */
export function seeFilm(id: FilmId) {
  const unlocked = unlockedFilms();
  if (unlocked.has(id)) return;
  unlocked.add(id);
  setting.save([...unlocked]);
}

/** Fills the whole list, or empties it. Only the menu's cheat code does this. */
export const grantFilms = () => setting.save(FILMS.map((film) => film.id));
export const forgetFilms = () => setting.save([]);
