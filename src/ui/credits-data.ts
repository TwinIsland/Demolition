/**
 * Content of the credits roll. The third-party list is a curated summary of
 * `public/assets/CREDITS.md`, which stays the full record: when an asset is added there, add its
 * line here too.
 */

/** Copy in both shipped languages: `[zh, en]`. */
export type Bilingual = readonly [zh: string, en: string];

export interface StaffCredit {
  role: Bilingual;
  names: readonly string[];
}

export interface AssetCredit {
  title: string;
  /** Where the asset is used. `map` names a map id and shows that map's name. */
  use?: Bilingual;
  map?: string;
  author: string;
  license?: string;
}

export interface AssetGroup {
  title: Bilingual;
  entries: readonly AssetCredit[];
}

const OWNER = "TwinIsland";
const solo = (zh: string, en: string): StaffCredit => ({ role: [zh, en], names: [OWNER] });

export const STAFF: readonly StaffCredit[] = [
  solo("游戏设计与制作", "Game Design & Production"),
  solo("剧情总监", "Narrative Director"),
  { role: ["程序", "Programming"], names: [OWNER, "Claude Code", "Codex"] },
  solo("美术与音效", "Art & Audio"),
];

const CC0 = "CC0 1.0";
const CC_BY = "CC BY 4.0";
const OFL = "SIL OFL 1.1";
const polyHaven = (title: string, author = "Poly Haven"): AssetCredit => ({ title, author, license: CC0 });
const kenney = (title: string): AssetCredit => ({ title, author: "Kenney · kenney.nl", license: CC0 });

export const ASSET_GROUPS: readonly AssetGroup[] = [
  {
    title: ["音乐", "Music"],
    entries: [
      {
        title: "Volatile Reaction",
        use: ["主菜单", "Main menu"],
        author: "Kevin MacLeod · incompetech.com",
        license: CC_BY,
      },
      {
        title: "Five Armies",
        map: "dream-garden",
        author: "Kevin MacLeod · incompetech.com",
        license: CC_BY,
      },
      { title: "Mechanolith", map: "night-lab", author: "Kevin MacLeod · incompetech.com", license: CC_BY },
      {
        title: "Rite of Passage",
        map: "rainforest",
        author: "Kevin MacLeod · incompetech.com",
        license: CC_BY,
      },
      {
        title: "Dreamy Flashback",
        map: "poolrooms",
        author: "Kevin MacLeod · incompetech.com",
        license: CC_BY,
      },
      {
        title: "Lost in Liminal Dream",
        map: "backrooms",
        author: "Lux-aeterna · Pixabay",
        license: "Pixabay Content License",
      },
      {
        title: "You've Got to Have Freedom",
        use: ["致谢", "Credits"],
        author: "Pharoah Sanders",
        license: "© Pharoah Sanders",
      },
      {
        title: "电动少女 · 电动少女 (8-Bit Remix)",
        use: ["故事模式", "Story mode"],
        author: "Chinese Football",
        license: "© Chinese Football",
      },
      {
        title: "Share Friendship · Clumsy Communication · 献花の番人",
        use: ["故事模式", "Story mode"],
        author: "黒魔",
        license: "© 黒魔",
      },
      {
        title: "Dark Place (loop)",
        use: ["备用曲目", "Fallback track"],
        author: "OpenGameArt",
        license: CC0,
      },
    ],
  },
  {
    title: ["音效", "Sound Effects"],
    entries: [
      kenney("Impact Sounds"),
      kenney("Interface Sounds"),
      kenney("Sci-Fi Sounds"),
      kenney("Digital Audio"),
      kenney("RPG Audio"),
      { title: "Zombies Sound Pack", author: "artisticdude · OpenGameArt", license: CC0 },
      { title: "Battle Sound Effects", author: "Ogrebane · OpenGameArt", license: CC0 },
      { title: "Fire Crackling", author: "AntumDeluge · OpenGameArt", license: CC0 },
      { title: "Tinnitus", author: "Joseph Sardin · BigSoundBank", license: CC0 },
      { title: "UI Button Press Deep", author: "Qvantor · Freesound", license: CC0 },
      { title: "Click Button (Flashlight)", author: "sweet_niche · Freesound", license: CC0 },
      { title: "Setting Electronic Timer 1 Beep", author: "Rudmer_Rotteveel · Freesound", license: CC0 },
      {
        title: "Water footsteps",
        map: "poolrooms",
        author: "AGFX · Freesound, via Minetest Game",
        license: "CC BY 3.0",
      },
      {
        title: "Zombie and player voices, level-up, pickup, crate, fuse, Hijack and footstep sounds",
        author: "Mojang Studios · Minecraft: Java Edition",
        license: "© Mojang Studios",
      },
    ],
  },
  {
    title: ["材质与天空", "Textures & Skies"],
    entries: [
      polyHaven("Kloofendal 48d Partly Cloudy (Pure Sky)", "Greg Zaal, Jarod Guest · Poly Haven"),
      polyHaven("Overcast Soil (Pure Sky)"),
      polyHaven("Concrete Floor 02"),
      polyHaven("Concrete Wall 003"),
      polyHaven("Brown Planks 09"),
      polyHaven("Green Metal Rust"),
      polyHaven("Rusty Metal Sheet"),
      polyHaven("Metal Plate"),
      polyHaven("Blue Metal Plate"),
      polyHaven("Hessian 380"),
      polyHaven("Rubberized Track"),
      polyHaven("Bark Brown 02"),
      polyHaven("Tree Bark 03"),
      polyHaven("Leafy Grass"),
      polyHaven("Forrest Ground 01"),
      polyHaven("Mud Forest"),
      polyHaven("Mossy Rock"),
      polyHaven("Mossy Sandstone"),
      polyHaven("Decrepit Wallpaper", "Rob Tuytel · Poly Haven"),
      polyHaven("Dirty Carpet", "Rohit Seervi · Poly Haven"),
      { title: "Explosion", use: ["爆炸序列帧", "Blast flipbook"], author: "OpenGameArt", license: CC0 },
      {
        title: "Smoke",
        use: ["烟雾贴图", "Smoke sprite"],
        author: "OpenGameArt · three.js examples",
      },
    ],
  },
  {
    title: ["模型与皮肤", "Models & Skins"],
    entries: [
      { title: "Dynamite Stick Bundle", author: "The Base Mesh", license: CC0 },
      { title: "Sci-Fi Essentials Kit", author: "Quaternius", license: CC0 },
      {
        title: "KayKit Medieval Hexagon Pack",
        use: ["平面国的建筑与物件", "Flatland buildings and props"],
        author: "Kay Lousberg",
        license: CC0,
      },
      {
        title: "KayKit Halloween Bits",
        use: ["平面国的墓园、灯柱与拱门", "Flatland graveyard, lanterns and arches"],
        author: "Kay Lousberg",
        license: CC0,
      },
      { title: "Hatsune Miku-VOCALOID", author: "julito · SkinsDB", license: "CC BY-SA 3.0" },
    ],
  },
  {
    title: ["字体", "Fonts"],
    entries: [
      { title: "Barlow Semi Condensed", author: "The Barlow Project Authors", license: OFL },
      { title: "Noto Sans SC", author: "Google", license: OFL },
    ],
  },
  {
    title: ["开源软件", "Open Source Software"],
    entries: [
      { title: "three.js", author: "mrdoob & contributors", license: "MIT" },
      { title: "postprocessing", author: "Raoul van Rüschen", license: "Zlib" },
      { title: "N8AO", author: "N8python", license: "ISC" },
      { title: "howler.js", author: "James Simpson · GoldFire Studios", license: "MIT" },
      { title: "skinview3d", author: "Blessing Skin community", license: "MIT" },
      { title: "Valibot", author: "Fabian Hiller", license: "MIT" },
      { title: "Vite", author: "Evan You & contributors", license: "MIT" },
      { title: "TypeScript", author: "Microsoft", license: "Apache-2.0" },
      { title: "Tauri", author: "The Tauri Programme", license: "MIT / Apache-2.0" },
    ],
  },
  {
    title: ["生成式美术", "Generated Artwork"],
    entries: [
      {
        title: "Logo, key art, map briefings, UI surfaces",
        use: ["标志、主视觉、地图插图、界面材质", "Art directed by TwinIsland"],
        author: "OpenAI ImageGen",
      },
      {
        title: "Equipment, skill, perk and mutation icons",
        use: ["装备、技能、增益与基因图标", "Art directed by TwinIsland"],
        author: "Google Gemini",
      },
      {
        title: "Equipment, bomb and knife 3D models",
        use: ["装备、炸药与小刀 3D 模型", "Art directed by TwinIsland"],
        author: "Meshy 7.5",
      },
    ],
  },
];

export const FULL_CREDITS_URL = "https://github.com/TwinIsland/Demolition/blob/main/public/assets/CREDITS.md";
