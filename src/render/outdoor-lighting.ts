import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { Sky } from "three/addons/objects/Sky.js";

/** Real HDR sky supplies both the visible sky and matching surface reflections. */
export class OutdoorLighting {
  private skyTexture?: THREE.DataTexture;
  private reflection?: THREE.WebGLRenderTarget;
  private fallback = new Sky();
  private sun = new THREE.DirectionalLight("#ffedcf", 2.6);
  private disposed = false;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, manager = THREE.DefaultLoadingManager) {
    scene.background = new THREE.Color("#aebec6");
    scene.fog = new THREE.FogExp2("#b5bfc1", 0.004);
    this.fallback.scale.setScalar(180);
    const uniforms = this.fallback.material.uniforms;
    uniforms.turbidity.value = 4;
    uniforms.rayleigh.value = 1.5;
    uniforms.mieCoefficient.value = 0.004;
    uniforms.mieDirectionalG.value = 0.8;
    uniforms.sunPosition.value.set(-35, 42, 25);
    scene.add(this.fallback);
    scene.add(new THREE.HemisphereLight("#c6dcf0", "#645c4b", 0.45));
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
    new RGBELoader(manager).load(
      "./assets/sky.hdr",
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        this.skyTexture = texture;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const generator = new THREE.PMREMGenerator(renderer);
        this.reflection = generator.fromEquirectangular(texture);
        generator.dispose();
        scene.background = texture;
        scene.backgroundIntensity = 0.8;
        scene.backgroundBlurriness = 0;
        scene.environment = this.reflection.texture;
        scene.environmentIntensity = 0.7;
        scene.remove(this.fallback);
      },
      undefined,
      (error) =>
        console.error("HDR sky unavailable; using physical sky", error),
    );
  }
  shadowResolution(size: number) {
    this.sun.castShadow = size > 0;
    const shadow = this.sun.shadow;
    if (size && shadow.mapSize.x === size) return;
    shadow.map?.dispose();
    shadow.map = null;
    if (size) shadow.mapSize.set(size,size);
    shadow.needsUpdate = true;
  }
  dispose() {
    this.disposed = true;
    this.sun.shadow.dispose();
    this.skyTexture?.dispose();
    this.reflection?.dispose();
    this.fallback.geometry.dispose();
    this.fallback.material.dispose();
  }
}
