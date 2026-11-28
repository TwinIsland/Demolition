import { shutdownImages } from "./shutdown/art";

import { ASCENSION_ART } from "./ascend/assets";

/** Story art, bundled with the game and decoded on the loading screen like every other image. */
const url = (file: string) => new URL(`./assets/${file}`, import.meta.url).href;
/** The bundler resolves such a pattern one folder deep, so the skins folder has its own. */
const skin = (file: string) => new URL(`./assets/skins/${file}`, import.meta.url).href;

/** Sprites of the mapped rooms, cut from the painted sheets by tools/story/cut-rpg.py. */
const rpg = (file: string) => new URL(`./assets/rpg/${file}.png`, import.meta.url).href;
const RPG_NAMES = [
  "tiles",
  ...["bed", "desk", "chair", "bookshelf", "mirror", "box"],
  ...["curtains-closed", "curtains-open", "door-closed", "door-open", "poster-megumin", "poster-aqua"],
  ...["tissue", "sock", "phone", "crisps", "clock", "power-strip"],
  ...["noodles", "tissue-box", "gamepad", "manga", "lamp", "plush"],
  ...[
    "toilet",
    "sink",
    "bathtub",
    "washer",
    "basket",
    "wall-shelf",
    "figurine",
    "key",
    "lockbox",
    "lockbox-open",
  ],
  ...["fridge", "cabinet", "table", "chair-front", "chair-back", "calendar", "plant", "window"],
] as const;
export const RPG_ART = Object.fromEntries(RPG_NAMES.map((name) => [name, rpg(name)])) as Record<
  (typeof RPG_NAMES)[number],
  string
>;

export const STORY_ART = {
  logo: url("logo-purple-8bit.png"),
  computer: url("computer-setup.png"),
  computerItem: url("computer-item.png"),
  bedroomDust: url("bedroom-dust.png"),
  comic1: url("comic-1.webp"),
  comic2: url("comic-2.webp"),
  /** Act 3: waking up in Flatland, and the moment before the button is pressed. */
  comic3: url("comic-3.webp"),
  comic3b: url("comic-3b.webp"),
  /** The Ascension Striker, as an item. */
  relic: url("relic.png"),
  /** The old monitor, with a hole where its screen is: laid over the act 2 mini-game. */
  crt: url("crt.png"),
  zeroWalk: url("zero-walk.png"),
  zeroSkin: url("zero-skin.png"),
  /** Zero once the bandage is off: the same sheets with a bare right forearm. */
  zeroWalkBare: url("zero-walk-bare.png"),
  zeroSkinBare: url("zero-skin-bare.png"),
  /** Sprite sheet of the act 2 mini-game; tools/story/make-arcade.py documents its frame order. */
  arcade: url("arcade.png"),
  /** The two players of the mini-game; tools/story/make-chibi.py documents its frame order. */
  chibi: url("chibi.png"),
} as const;

/** Zero's dialogue portraits, by mood. */
export const ZERO_PORTRAITS = {
  smug: url("zero-smug.png"),
  flustered: url("zero-flustered.png"),
  sincere: url("zero-sincere.png"),
} as const;
/** Lulu's, in her own moods. */
export const LULU_PORTRAITS = {
  pout: url("lulu-pout.png"),
  flustered: url("lulu-flustered.png"),
  impressed: url("lulu-impressed.png"),
} as const;
/** The sample opponent: a template nobody filled in. */
export const ZHANGSAN_PORTRAITS = {
  blank: url("zhangsan-blank.png"),
  smile: url("zhangsan-smile.png"),
  ko: url("zhangsan-ko.png"),
  puzzled: url("zhangsan-puzzled.png"),
} as const;
export type Mood =
  keyof typeof ZERO_PORTRAITS | keyof typeof LULU_PORTRAITS | keyof typeof ZHANGSAN_PORTRAITS;

/** Skins of the story's cast, by the id the game's renderer knows them under. */
// The bundler resolves these patterns one folder deep, so the skins folder needs a pattern of its own.
export const STORY_SKINS = {
  "story-zero": skin("zero.png"),
  "story-zero-bare": skin("zero-bare.png"),
  "story-lulu": skin("lulu.png"),
  "story-zhangsan": skin("zhang-san.png"),
  "story-bluescreen": skin("blue-screen.png"),
  "story-popup": skin("popup.png"),
  "story-antivirus": skin("antivirus.png"),
} as const;

export const storyImages = (): string[] => [
  ...Object.values(STORY_ART),
  ...Object.values(RPG_ART),
  ...Object.values(ZERO_PORTRAITS),
  ...Object.values(LULU_PORTRAITS),
  ...Object.values(ZHANGSAN_PORTRAITS),
  ...Object.values(STORY_SKINS),
  ...Object.values(ASCENSION_ART),
  ...shutdownImages(),
];
