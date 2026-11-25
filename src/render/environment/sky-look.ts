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
