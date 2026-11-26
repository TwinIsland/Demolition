/** Sky image, sun, sky fill and fog for one kind of weather. */
export interface SkyLook {
  /** Equirectangular HDR image used for the visible sky and for image-based lighting. */
  sky: string;
  backgroundIntensity: number;
  environmentIntensity: number;
  sun: { color: string; intensity: number };
  fill: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
}
/** What the weather needs from the scene's lighting rig. */
export interface SkyRig {
  /** Start loading a look's sky image so that switching to it later needs no download. */
  preload(look: SkyLook): void;
  apply(look: SkyLook): void;
  /** Brighten the whole scene for a lightning stroke. 0 restores the look's own levels. */
  flash(amount: number): void;
}
export const CLEAR_SKY: SkyLook = {
  sky: "./assets/sky.hdr",
  backgroundIntensity: 0.8,
  environmentIntensity: 0.7,
  sun: { color: "#ffedcf", intensity: 2.6 },
  fill: { sky: "#c6dcf0", ground: "#645c4b", intensity: 0.45 },
  fog: { color: "#b5bfc1", density: 0.004 },
};
export const OVERCAST_RAIN_SKY: SkyLook = {
  sky: "./assets/environment/overcast-sky.hdr",
  backgroundIntensity: 0.42,
  environmentIntensity: 0.62,
  sun: { color: "#c3d0dc", intensity: 0.55 },
  fill: { sky: "#9fb0bf", ground: "#3f3d38", intensity: 0.5 },
  fog: { color: "#6f7b83", density: 0.0075 },
};
/**
 * A tiled hall under panel lights. The sky image only feeds reflections: a ceiling hides it.
 * Light comes mostly from above and from every side, so shadows stay faint.
 */
export const POOL_HALL: SkyLook = {
  sky: "./assets/environment/overcast-sky.hdr",
  // Kept dim on purpose: on a bright white deck the danger tiles and placement marks wash out.
  backgroundIntensity: 0.5,
  environmentIntensity: 0.45,
  sun: { color: "#eaf6fb", intensity: 0.4 },
  fill: { sky: "#dff3f6", ground: "#4f8f98", intensity: 0.55 },
  fog: { color: "#8fb1b5", density: 0.0105 },
};
/**
 * A windowless office floor under fluorescent panels. Dim and yellow on purpose: the walls are
 * already loud, and the danger tiles and placement marks have to stay the brightest things on
 * the carpet. The lamp pools themselves are painted by the surface shader.
 */
export const OFFICE_FLOOR: SkyLook = {
  sky: "./assets/environment/overcast-sky.hdr",
  backgroundIntensity: 0.12,
  environmentIntensity: 0.36,
  sun: { color: "#fff0c4", intensity: 0.32 },
  fill: { sky: "#fff1c2", ground: "#7a6634", intensity: 0.62 },
  fog: { color: "#6f6435", density: 0.013 },
};
export const JUNGLE_RAIN_SKY: SkyLook = {
  sky: "./assets/environment/overcast-sky.hdr",
  backgroundIntensity: 0.5,
  environmentIntensity: 0.7,
  sun: { color: "#dfe6cf", intensity: 0.85 },
  fill: { sky: "#a9bfae", ground: "#3d4631", intensity: 0.55 },
  fog: { color: "#7d8f84", density: 0.0085 },
};
