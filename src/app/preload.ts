import { ITEMS, PERKS, SKILLS } from "../core/content";
import { MAPS } from "../core/maps";
import { MUTATIONS } from "../core/mutations";
import type { GameSnapshot } from "../core/types";
import { EN_MESSAGES } from "../locales/en";
import type { Sound } from "../audio/sound";
import type { GameRenderer } from "../render/game-renderer";
import type { LoadProgress } from "../render/scene-assets";
import { iconArt } from "../ui/icons";
import { preloadSkinAssets } from "../ui/skin-assets";
import { preloadMinimapArt } from "../ui/tactical-map";

const IMAGE_URL = /^(?:\.{0,2}\/|https?:\/\/|data:image\/)/i;
const FONT_FAMILIES = ["Barlow Semi Condensed", "Noto Sans SC"];
const FONT_WEIGHTS = [400, 500, 600, 700, 800, 900];

/** A stalled optional asset (for example audio blocked by the browser) must not hang startup. */
const ASSET_TIMEOUT_MS = 20_000;
const timeout = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Reports several independent loaders as one bar. */
class ProgressGroup {
  private done = 0;
  private total = 0;
  private sceneDone = 0;
  private sceneTotal = 0;
  constructor(private readonly report: LoadProgress) {}

  /** Counts each promise as one unit; a failure still counts, since optional assets must not block. */
  track<T>(tasks: Iterable<Promise<T>>): Promise<void> {
    const pending = [...tasks].map((task) => {
      this.total++;
      return Promise.race([task, timeout(ASSET_TIMEOUT_MS)])
        .catch((error) => console.warn("Preload failed", error))
        .then(() => {
          this.done++;
          this.emit();
        });
    });
    this.emit();
    return Promise.all(pending).then(() => undefined);
  }
  /** Progress callback for the Three.js loading manager, which counts its own queue. */
  readonly scene: LoadProgress = (done, total) => {
    this.sceneDone = done;
    this.sceneTotal = total;
    this.emit();
  };
  private emit() {
    this.report(this.done + this.sceneDone, this.total + this.sceneTotal);
  }
}

function decodeImage(url: string): Promise<void> {
  const image = new Image();
  image.src = url;
  return image.decode();
}

/** Every image referenced by a same-origin stylesheet: CSS backgrounds are otherwise fetched on first paint. */
function stylesheetImages(): string[] {
  const urls = new Set<string>();
  const visit = (rules: CSSRuleList, base: string) => {
    for (const rule of rules) {
      if ("cssRules" in rule) visit((rule as CSSGroupingRule).cssRules, base);
      if (rule instanceof CSSFontFaceRule || !("style" in rule)) continue;
      const text = (rule as CSSStyleRule).style.cssText;
      for (const match of text.matchAll(/url\((["']?)([^"')]+)\1\)/g))
        if (!match[2].startsWith("data:") && !match[2].startsWith("#"))
          urls.add(new URL(match[2], base).href);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules, sheet.href ?? document.baseURI);
    } catch {
      // Cross-origin sheets cannot be read; they hold nothing of ours.
    }
  }
  return [...urls];
}

/** Images referenced from markup that only appears later: module icons and map briefing art. */
function contentImages(): string[] {
  const definitions = [
    ...Object.values(SKILLS),
    ...Object.values(ITEMS),
    ...PERKS,
    ...Object.values(MUTATIONS),
  ];
  const icons = definitions.map((definition) => definition.icon).filter((icon) => IMAGE_URL.test(icon));
  return [...new Set([...icons, ...iconArt(), ...MAPS.flatMap((map) => (map.artwork ? [map.artwork] : []))])];
}

/**
 * Web fonts are split by unicode range and fetched only for glyphs that get drawn. Asking for
 * every string the UI can show pulls in the needed subsets before the first screen appears.
 */
function loadFonts(): Promise<unknown>[] {
  if (!document.fonts) return [];
  const sample = [...Object.keys(EN_MESSAGES), ...Object.values(EN_MESSAGES), "0123456789"].join("");
  return FONT_FAMILIES.flatMap((family) =>
    FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 16px "${family}"`, sample)),
  );
}

/**
 * Startup preload. Loads every asset the game can use (models, textures, skins, map art, audio,
 * UI images, fonts) behind the loading screen, so nothing is fetched lazily afterwards.
 */
export async function preloadEverything(
  renderer: GameRenderer,
  sound: Sound,
  state: Readonly<GameSnapshot>,
  report: LoadProgress,
) {
  const progress = new ProgressGroup(report);
  await Promise.all([
    renderer.prepareAll(state, MAPS, progress.scene),
    progress.track(sound.preloadAll(MAPS.map((map) => map.bgm ?? ""))),
    progress.track([...stylesheetImages(), ...contentImages()].map(decodeImage)),
    progress.track(loadFonts()),
    progress.track([preloadSkinAssets()]),
    progress.track(preloadMinimapArt()),
  ]);
}
