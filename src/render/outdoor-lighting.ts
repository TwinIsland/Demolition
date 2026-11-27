import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { Sky } from "three/addons/objects/Sky.js";

import { CLEAR_SKY, type SkyLook, type SkyRig } from "./environment/sky-look";

const HIGH_SUN = [-35, 42, 25] as const;
interface LoadedSky {
  texture: THREE.DataTexture;
  reflection: THREE.WebGLRenderTarget;
}

/** Real HDR sky supplies both the visible sky and matching surface reflections. */
export class OutdoorLighting implements SkyRig {
  private skies = new Map<string, LoadedSky | "loading">();
  private fallback = new Sky();
  private sun = new THREE.DirectionalLight("#ffedcf", 2.6);
  private fill = new THREE.HemisphereLight("#c6dcf0", "#645c4b", 0.45);
  private fog = new THREE.FogExp2("#b5bfc1", 0.004);
  private look = CLEAR_SKY;
  private disposed = false;
  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private manager = THREE.DefaultLoadingManager,
  ) {
    scene.background = new THREE.Color("#aebec6");
    scene.fog = this.fog;
    this.fallback.scale.setScalar(180);
    const uniforms = this.fallback.material.uniforms;
    uniforms.turbidity.value = 4;
    uniforms.rayleigh.value = 1.5;
    uniforms.mieCoefficient.value = 0.004;
    uniforms.mieDirectionalG.value = 0.8;
    uniforms.sunPosition.value.set(-35, 42, 25);
    scene.add(this.fallback);
    scene.add(this.fill);
    const sun = this.sun;
    sun.position.set(-35, 42, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
    sun.shadow.camera.right = sun.shadow.camera.top = 25;
    sun.shadow.camera.far = 110;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0001;
    sun.shadow.radius = 3;
    scene.add(sun);
    this.apply(CLEAR_SKY);
  }
  /** Switch weather. The sky image is loaded on first use and kept for later matches. */
  apply(look: SkyLook) {
    this.look = look;
    this.sun.color.set(look.sun.color);
    // Keep the distance: the shadow camera's depth range is set for it.
    this.sun.position.set(...(look.sun.from ?? HIGH_SUN)).setLength(60);
    this.fill.color.set(look.fill.sky);
    this.fill.groundColor.set(look.fill.ground);
    this.fog.color.set(look.fog.color);
    this.fog.density = look.fog.density;
    this.flash(0);
    const loaded = this.skies.get(look.sky);
    if (loaded && loaded !== "loading") this.show(loaded);
    else this.preload(look);
  }
  preload(look: SkyLook) {
    if (this.skies.has(look.sky)) return;
    this.skies.set(look.sky, "loading");
    new RGBELoader(this.manager).load(
      look.sky,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const generator = new THREE.PMREMGenerator(this.renderer);
        const sky = { texture, reflection: generator.fromEquirectangular(texture) };
        generator.dispose();
        this.skies.set(look.sky, sky);
        if (this.look.sky === look.sky) this.show(sky);
      },
      undefined,
      (error) => {
        this.skies.delete(look.sky);
        console.error("HDR sky unavailable; using physical sky", error);
      },
    );
  }
  flash(amount: number) {
    const look = this.look;
    this.sun.intensity = look.sun.intensity * (1 + amount * 3);
    this.fill.intensity = look.fill.intensity * (1 + amount * 2.4);
    this.scene.backgroundIntensity = look.backgroundIntensity * (1 + amount * 1.6);
    this.scene.environmentIntensity = look.environmentIntensity * (1 + amount * 1.2);
  }
  private show(sky: LoadedSky) {
    this.scene.background = sky.texture;
    this.scene.backgroundBlurriness = 0;
    this.scene.environment = sky.reflection.texture;
    this.scene.remove(this.fallback);
  }
  /** Stretch the sun's shadow frustum over an arena `half` world units from centre to edge. */
  shadowCoverage(half: number) {
    const camera = this.sun.shadow.camera,
      reach = Math.max(25, half);
    if (camera.right === reach) return;
    camera.left = camera.bottom = -reach;
    camera.right = camera.top = reach;
    camera.far = 70 + reach * 1.6;
    camera.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }
  shadowResolution(size: number) {
    this.sun.castShadow = size > 0;
    const shadow = this.sun.shadow;
    if (size && shadow.mapSize.x === size) return;
    shadow.map?.dispose();
    shadow.map = null;
    if (size) shadow.mapSize.set(size, size);
    shadow.needsUpdate = true;
  }
  dispose() {
    this.disposed = true;
    this.sun.shadow.dispose();
    for (const sky of this.skies.values())
      if (sky !== "loading") {
        sky.texture.dispose();
        sky.reflection.dispose();
      }
    this.fallback.geometry.dispose();
    this.fallback.material.dispose();
  }
}
