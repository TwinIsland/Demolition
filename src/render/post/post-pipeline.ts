import * as THREE from "three";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type Effect,
} from "postprocessing";
import { N8AOPostPass } from "n8ao";
import type { GraphicsSettings } from "../graphics-settings";
import { ReplayGradeEffect } from "./replay-grade";

/** The post-processing features derived from the player's graphics settings. */
export interface PostQuality {
  occlusion: "off" | "half";
  bloom: boolean;
  grain: boolean;
  /** MSAA samples on the composer buffers. */
  multisampling: number;
  /** Morphological anti-aliasing in the effect pass, for when MSAA is off and pixels are large. */
  smaa: boolean;
}

/** Render scale doubles as the quality tier: 70% is the performance preset, 100% the high one. */
/** Above this many device pixels per CSS pixel, edges are fine enough without anti-aliasing. */
const DENSE_PIXEL_RATIO = 1.5;

export function postQuality(settings: GraphicsSettings, pixelRatio: number): PostQuality {
  const lowest = settings.scale <= 0.7;
  const multisampling = settings.occlusion ? 0 : lowest ? 2 : 4;
  return {
    // Half resolution with depth-aware upsampling: full-resolution AO costs four times as much
    // and the difference disappears under the blur.
    occlusion: settings.occlusion ? "half" : "off",
    bloom: !lowest,
    grain: settings.grain,
    // N8AO darkens the resolved image, which would re-alias MSAA edges, so AO pairs with SMAA.
    multisampling,
    smaa: multisampling === 0 && pixelRatio < DENSE_PIXEL_RATIO,
  };
}

// World units; a tile is 2.4 wide, so this shades contact creases without haloing whole cells.
const AO_RADIUS = 0.7;
const AO_INTENSITY = 2.5;
// Just under display white, so LDR blast cores and HDR highlights glow but lit surfaces do not.
const BLOOM_THRESHOLD = 0.9;
const BLOOM_SMOOTHING = 0.2;
const BLOOM_INTENSITY = 0.3;
const GRAIN_OPACITY = 0.035;
const VIGNETTE_OFFSET = 0.3;
const VIGNETTE_DARKNESS = 0.3;

/**
 * Scene -> N8AO -> one merged effect pass (SMAA, bloom, grain, ACES, vignette) on half-float buffers.
 * Tone mapping and sRGB encoding happen once, in the final pass.
 */
export class PostPipeline {
  private composer: EffectComposer;
  private occlusion?: N8AOPostPass;
  private effects?: EffectPass;
  private occlusionActive = true;
  /** The killcam's lens. Its pass joins the chain only while a replay runs, so play pays nothing. */
  private replayGrade!: ReplayGradeEffect;
  private replayPass!: EffectPass;
  private replaying = false;
  private replayWarm = false;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private quality: PostQuality,
  ) {
    const autoClear = renderer.autoClear;
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: quality.multisampling,
    });
    // The composer switches auto clear off for good; draws that bypass it still rely on it.
    renderer.autoClear = autoClear;
    this.composer.addPass(new RenderPass(scene, camera));
    this.build();
  }

  /**
   * Strength (0..1) and focus distance of the killcam lens; 0 takes its pass out of the chain.
   * It works on the scene-linear image, ahead of the pass that tone-maps to the screen.
   */
  setReplay(strength: number, focus = 5) {
    this.replayGrade.set(strength, focus);
    const wanted = strength > 0.001;
    if (wanted === this.replaying) return;
    this.replaying = wanted;
    if (wanted) this.composer.addPass(this.replayPass, this.composer.passes.indexOf(this.effects!));
    else this.composer.removePass(this.replayPass);
  }

  /** Compiles the killcam lens behind the loading screen with one frame drawn through it. */
  warmReplay() {
    if (this.replayWarm) return;
    this.replayWarm = true;
    this.setReplay(1);
    this.render();
    this.setReplay(0);
  }

  setQuality(quality: PostQuality) {
    const before = this.quality;
    this.quality = quality;
    if (
      before.occlusion === quality.occlusion &&
      before.bloom === quality.bloom &&
      before.grain === quality.grain &&
      before.multisampling === quality.multisampling &&
      before.smaa === quality.smaa
    )
      return;
    // The merged shader is compiled per effect set, so a settings change rebuilds the tail.
    this.setReplay(0);
    for (const pass of [this.effects, this.occlusion])
      if (pass) {
        this.composer.removePass(pass);
        pass.dispose();
      }
    this.occlusion = this.effects = undefined;
    this.replayPass.dispose();
    this.composer.multisampling = quality.multisampling;
    this.build();
  }

  /** Lets the caller skip AO for frames whose projection it cannot reconstruct depth from. */
  setOcclusionActive(active: boolean) {
    this.occlusionActive = active;
    if (this.occlusion) this.occlusion.enabled = active;
  }

  /** Call after the renderer's size or pixel ratio changes; buffers follow its drawing buffer. */
  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }

  render() {
    const { renderer } = this;
    const toneMapping = renderer.toneMapping;
    const autoClear = renderer.autoClear;
    // ToneMappingEffect owns tone mapping here; draws that bypass the composer keep the renderer's.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    try {
      this.composer.render();
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.autoClear = autoClear;
    }
  }

  dispose() {
    this.setReplay(0);
    this.replayPass.dispose();
    this.composer.dispose();
  }

  private build() {
    const { quality } = this;
    // Scene depth reaches the effects only from buffers that are not multisampled.
    this.replayGrade = new ReplayGradeEffect(quality.multisampling === 0);
    this.replayPass = new EffectPass(this.camera, this.replayGrade);
    this.replayWarm = false;
    if (quality.occlusion !== "off") {
      const pass = new N8AOPostPass(this.scene, this.camera);
      pass.configuration.aoRadius = AO_RADIUS;
      pass.configuration.distanceFalloff = 1;
      pass.configuration.intensity = AO_INTENSITY;
      pass.setQualityMode("Low");
      pass.configuration.halfRes = true;
      pass.enabled = this.occlusionActive;
      this.composer.addPass(pass);
      this.occlusion = pass;
    }
    const effects: Effect[] = [];
    if (quality.smaa) effects.push(new SMAAEffect({ preset: SMAAPreset.MEDIUM }));
    if (quality.bloom)
      effects.push(
        new BloomEffect({
          // The mip chain starts at half resolution; six levels are enough for this radius.
          mipmapBlur: true,
          levels: 6,
          luminanceThreshold: BLOOM_THRESHOLD,
          luminanceSmoothing: BLOOM_SMOOTHING,
          intensity: BLOOM_INTENSITY,
        }),
      );
    if (quality.grain) {
      // Luminance-scaled additive grain in scene-linear space, like the film pass it replaces.
      const grain = new NoiseEffect({ blendFunction: BlendFunction.ADD, premultiply: true });
      grain.blendMode.opacity.value = GRAIN_OPACITY;
      effects.push(grain);
    }
    // Exposure comes from renderer.toneMappingExposure, which three feeds to the shared ACES chunk.
    effects.push(
      new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
      new VignetteEffect({ offset: VIGNETTE_OFFSET, darkness: VIGNETTE_DARKNESS }),
    );
    this.effects = new EffectPass(this.camera, ...effects);
    this.composer.addPass(this.effects);
  }
}
