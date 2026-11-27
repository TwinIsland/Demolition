/** Art of act 4. Each address is written out, so the bundler finds the file whatever serves it. */
export const ASCENSION_ART = {
  /** The village standing up: the panel held at the hit, and the act's cover in the menu. */
  panel: new URL("../assets/comic-4.webp", import.meta.url).href,
  /** She sees the sky. */
  sky4b: new URL("../assets/comic-4b.webp", import.meta.url).href,
  /** The ones who did not clear the game. */
  risen: new URL("../assets/comic-4c.webp", import.meta.url).href,
  /** Equirectangular sky the standing world is lit under. */
  sky: new URL("../assets/sky-ascension.webp", import.meta.url).href,
} as const;
