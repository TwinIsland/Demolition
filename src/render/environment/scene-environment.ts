import * as THREE from "three";
import { TILE_SIZE } from "../../core/geometry";
import { motionScale } from "../../feel/settings";
import { GroundReflection } from "./ground-reflection";
import { Rain } from "./rain";
import {
  CLEAR_SKY,
  JUNGLE_RAIN_SKY,
  OFFICE_FLOOR,
  OVERCAST_RAIN_SKY,
  POOL_HALL,
  type SkyLook,
  type SkyRig,
} from "./sky-look";
import { SurfaceWeathering, createWeatherUniforms, type DetailLevel } from "./surface-weathering";

export type WeatherKind = "clear" | "rain" | "monsoon" | "indoor" | "office";
/** The part of a map definition that decides how its scene looks. */
export interface MapLook {
  theme: "garden" | "midnight" | "rainforest" | "poolrooms" | "backrooms";
  weather?: WeatherKind;
}
/** The graphics options this module reads. */
export interface EnvironmentQuality {
  /** Surface weathering, rain density and ripple quality. */
  detail: "low" | "medium" | "high";
  /** Mirror the scene in wet ground. Renders the arena a second time at quarter resolution. */
  reflections: boolean;
}
interface Weather {
  sky: SkyLook;
  /** 0 dry, 1 soaked. */
  wet: number;
  /** 0 none, 1 steady rain. */
  rain: number;
  /** Ground mist: extinction per metre at ground level, and its falloff per metre of height. */
  groundFog: [number, number];
  lightning: boolean;
  /** Wet paving is wide enough to be worth a planar reflection pass. */
  mirror: boolean;
}
const WEATHER: Record<WeatherKind, Weather> = {
  clear: { sky: CLEAR_SKY, wet: 0, rain: 0, groundFog: [0, 0.5], lightning: false, mirror: false },
  rain: {
    sky: OVERCAST_RAIN_SKY,
    wet: 1,
    rain: 1,
    groundFog: [0.02, 0.4],
    lightning: true,
    mirror: true,
  },
  // The rain is easing off under a forest canopy: everything is soaked, a drizzle still falls
  // through the sunlight and mist hangs over the ground.
  monsoon: {
    sky: JUNGLE_RAIN_SKY,
    wet: 1,
    rain: 0.5,
    groundFog: [0.024, 0.2],
    lightning: false,
    // Grass and mud do not mirror, and a second pass over a large arena costs too much.
    mirror: false,
  },
  // No rain and no sky, but the tiles never dry: a film of water with standing sheets on the deck.
  indoor: { sky: POOL_HALL, wet: 0.45, rain: 0, groundFog: [0.004, 0.25], lightning: false, mirror: true },
  // Nothing falls and nothing shines: the damp only shows as dark patches soaked into the carpet.
  office: { sky: OFFICE_FLOOR, wet: 0.3, rain: 0, groundFog: [0, 0.5], lightning: false, mirror: false },
};
/** How much grime, streaking, moss and cracking each map theme shows. */
const WEAR: Record<MapLook["theme"], [number, number, number, number]> = {
  garden: [1, 0.9, 1, 0.9],
  midnight: [0.8, 1, 0.35, 1],
  rainforest: [0.9, 1, 1, 0.7],
  // Tile profiles ignore wear; props in the hall stay nearly clean.
  poolrooms: [0.15, 0.2, 0, 0.1],
  // Wallpaper and carpet carry their own stains; the office furniture stays as it was left.
  backrooms: [0.2, 0.25, 0, 0.15],
};
const DETAIL: Record<EnvironmentQuality["detail"], { level: DetailLevel; density: number }> = {
  low: { level: 0, density: 0.3 },
  medium: { level: 1, density: 0.6 },
  high: { level: 2, density: 1 },
};

export interface ThunderCue {
  /** Seconds until the sound should arrive. */
  delay: number;
  /** 0..1, louder for closer strokes. */
  strength: number;
}

/**
 * Weather and surface detail for the match scene: weathered, non-repeating materials,
 * rain, wet ground with a planar reflection, and the sky and fog that go with them.
 */
export class SceneEnvironment {
  /** Called when lightning strikes so the audio layer can schedule thunder. */
  onThunder?: (cue: ThunderCue) => void;
  private uniforms = createWeatherUniforms();
  private weathering = new SurfaceWeathering(this.uniforms);
  private rain = new Rain(this.uniforms);
  private reflection = new GroundReflection(this.uniforms);
  private weather = WEATHER.clear;
  private detail: EnvironmentQuality["detail"] = "high";
  private reflections = false;
  private size = new THREE.Vector2();
  private nextStrike = Infinity;
  private strikeAt = -Infinity;
  private strikeStrength = 0;
  private flashing = false;
  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private lighting: SkyRig,
  ) {
    this.uniforms.wxTile.value = TILE_SIZE;
    scene.add(this.rain.root);
    // Every sky is requested up front so the loading screen covers it; nothing loads mid-match.
    for (const weather of Object.values(WEATHER)) lighting.preload(weather.sky);
  }

  /** 0..1 rain loudness for the ambience loop of the current map. */
  get rainLevel() {
    return this.weather.rain;
  }

  /** Brightness of an office floor's ceiling panels, 0 to 1, for when they stutter. */
  set lampLevel(level: number) {
    this.uniforms.wxLampLevel.value = level;
  }

  /**
   * Work lamps whose pools of light the surface shader paints: world position and strength.
   * Up to four; a map without lamps passes none.
   */
  setWorkLamps(lamps: readonly { x: number; y: number; z: number; strength: number }[]) {
    this.uniforms.wxWorkLamps.value.forEach((slot, index) => {
      const lamp = lamps[index];
      if (lamp) slot.set(lamp.x, lamp.y, lamp.z, lamp.strength);
      else slot.set(0, 0, 0, 0);
    });
  }

  /** Call when permanent walls moved, so rain keeps landing on their tops. */
  updateField(tiles: readonly (readonly number[])[]) {
    this.rain.setField(tiles, TILE_SIZE);
  }

  /** Call after the arena for a map has been built. */
  applyMap(map: MapLook, tiles: readonly (readonly number[])[], arenaRoot: THREE.Object3D) {
    this.weather = WEATHER[map.weather ?? "clear"];
    this.lighting.apply(this.weather.sky);
    this.weathering.apply(arenaRoot);
    this.rain.setField(tiles, TILE_SIZE);
    const u = this.uniforms;
    u.wxWet.value = this.weather.wet;
    u.wxRain.value = this.weather.rain;
    u.wxAmount.value.fromArray(WEAR[map.theme]);
    u.wxFog.value.fromArray(this.weather.groundFog);
    this.nextStrike = Infinity;
    this.refresh();
  }

  /** Patch materials of objects created after the arena, such as props added during a match. */
  include(root: THREE.Object3D) {
    this.weathering.apply(root);
  }

  setQuality(settings: EnvironmentQuality) {
    this.detail = settings.detail;
    this.reflections = settings.reflections;
    this.refresh();
  }

  private refresh() {
    const detail = DETAIL[this.detail];
    const mirror = this.reflections && this.weather.mirror;
    this.weathering.setDetail(detail.level, mirror);
    this.rain.set(this.weather.rain, detail.density);
    if (!mirror) this.reflection.disable();
  }

  /**
   * Advance the weather and, when enabled, render the floor reflection. Call once per frame
   * after the camera is final and before the scene is drawn. `exclude` lists objects that
   * must stay out of the reflection, typically the first-person viewmodel.
   */
  update(camera: THREE.Camera, time: number, exclude: THREE.Object3D[] = []) {
    this.uniforms.wxTime.value = time;
    this.renderer.getDrawingBufferSize(this.size);
    this.rain.update(camera, this.size.y);
    this.lightning(time);
    if (this.reflections && this.weather.mirror) {
      // Rain streaks are too thin to survive the mip blur and would only add noise.
      this.reflection.render(this.renderer, this.scene, camera, [this.rain.root, ...exclude]);
    }
  }

  private lightning(time: number) {
    if (!this.weather.lightning || motionScale() === 0) {
      if (this.flashing) this.lighting.flash(0);
      this.flashing = false;
      return;
    }
    if (this.nextStrike === Infinity) this.nextStrike = time + 9 + Math.random() * 14;
    if (time >= this.nextStrike) {
      this.strikeAt = time;
      this.strikeStrength = 0.35 + Math.random() * 0.65;
      this.nextStrike = time + 16 + Math.random() * 26;
      this.onThunder?.({ delay: 0.5 + (1 - this.strikeStrength) * 2.6, strength: this.strikeStrength });
    }
    // Two short pulses, the second one weaker, like a return stroke.
    const age = time - this.strikeAt;
    const pulse = (start: number, length: number) =>
      age >= start && age < start + length ? 1 - (age - start) / length : 0;
    const flash = Math.max(pulse(0, 0.12), 0.6 * pulse(0.19, 0.22)) * this.strikeStrength * motionScale();
    if (flash > 0 || this.flashing) this.lighting.flash(flash * 0.55);
    this.flashing = flash > 0;
  }

  dispose() {
    this.scene.remove(this.rain.root);
    this.rain.dispose();
    this.reflection.dispose();
  }
}
