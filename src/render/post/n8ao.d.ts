// n8ao ships no typings; this covers the subset the post pipeline uses.
declare module "n8ao" {
  import type { Camera, Color, Scene } from "three";
  import { Pass } from "postprocessing";

  export type N8AOQualityMode =
    | "Performance"
    | "Low"
    | "Medium"
    | "High"
    | "Ultra"
    | "Neural-Performance"
    | "Neural-Low"
    | "Neural-Medium"
    | "Neural-High";

  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    aoTones: number;
    denoiseSamples: number;
    denoiseRadius: number;
    denoiseIterations: number;
    distanceFalloff: number;
    intensity: number;
    color: Color;
    gammaCorrection: boolean;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    colorMultiply: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
    neuralDenoise: boolean;
    biasOffset: number;
    biasMultiplier: number;
  }

  /** Composites AO onto the colour written by a preceding postprocessing RenderPass. */
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    readonly configuration: N8AOConfiguration;
    setQualityMode(mode: N8AOQualityMode): void;
    setDisplayMode(mode: "Combined" | "AO" | "No AO" | "Split" | "Split AO"): void;
  }
}
