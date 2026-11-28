/**
 * Raster art referenced from game-skin.css. CSS backgrounds are fetched lazily
 * by the browser, so the loading screen decodes them here before the UI shows.
 */
import { preloadSkinHeads } from "./skin-heads";

const SKIN_ASSETS = [
  "/assets/ui/plate.webp",
  "/assets/ui/painted-steel.webp",
  "/assets/ui/player-card.webp",
  "/assets/ui/player-card-self.webp",
  "/assets/ui/radar-frame.webp",
  "/assets/menu/hangar.webp",
  "/assets/menu/confirm.webp",
] as const;

function decode(url: string): Promise<void> {
  const image = new Image();
  image.src = url;
  // A missing decorative texture must not block the game from starting.
  return image.decode().catch(() => console.warn("UI texture failed to load", url));
}

/** Resolves once every skin texture and skin head portrait is decoded. */
export function preloadSkinAssets(): Promise<void> {
  return Promise.all([...SKIN_ASSETS.map(decode), preloadSkinHeads()]).then(() => undefined);
}
