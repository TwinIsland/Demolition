import * as THREE from "three";
import { PlayerObject } from "skinview3d";
import { AvatarMotion } from "./avatar-motion";
import type { MinecraftSkin } from "./minecraft-skins";

/**
 * Optical-camo look, compiled into every avatar material up front so that switching it on never
 * builds a shader mid-match. Waves travel up the body: bands of it drop out through a screen-door
 * pattern and the surviving bands glow at their crests, while each limb sways sideways.
 */
function patchCloak(material: THREE.MeshStandardMaterial, uniforms: CloakUniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCloak = uniforms.amount;
    shader.uniforms.uCloakTime = uniforms.time;
    shader.uniforms.uHurt = uniforms.hurt;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uCloak, uCloakTime;\nvarying vec3 vCloakWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 cloakAt = (modelMatrix * vec4(transformed, 1.)).xyz;
          float sway = sin(cloakAt.y * 7. - uCloakTime * 6.5) + .5 * sin(cloakAt.y * 15. + uCloakTime * 9.);
          transformed.x += sway * .55 * uCloak;
          transformed.z += cos(cloakAt.y * 9. - uCloakTime * 5.) * .35 * uCloak;
          vCloakWorld = cloakAt;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uCloak, uCloakTime, uHurt;\nvarying vec3 vCloakWorld;",
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        if (uHurt > 0.) {
          // Hurt overlay: the whole body is washed red, keeping only the shading of the skin.
          float hurtShade = dot(gl_FragColor.rgb, vec3(.299, .587, .114));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1., .13, .1) * (.3 + .9 * hurtShade), .62 * uHurt);
        }
        if (uCloak > 0.) {
          float bend = sin(vCloakWorld.x * 6. + uCloakTime * 2.3) + sin(vCloakWorld.z * 6. - uCloakTime * 1.7);
          float wave = .5 + .5 * sin(vCloakWorld.y * 16. + bend * 1.3 - uCloakTime * 7.);
          float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
          float keep = mix(1., .12 + .62 * smoothstep(.35, 1., wave), uCloak);
          if (grain > keep) discard;
          vec3 sheen = vec3(.42, .92, 1.) * (.25 + .75 * pow(wave, 6.));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * .55 + sheen, .7 * uCloak);
        }`,
      );
  };
  // One program serves every avatar; the per-avatar state lives in the uniforms.
  material.customProgramCacheKey = () => "avatar-cloak";
}
interface CloakUniforms {
  amount: { value: number };
  time: { value: number };
  /** Red hurt overlay, 0 to 1. It shares the cloak's program so it costs no extra shader. */
  hurt: { value: number };
}

/** Minecraft's six rigid body parts retain their original UVs and joint pivots. */
export class MinecraftAvatar extends THREE.Group {
  readonly rig = new PlayerObject();
  readonly motion = new AvatarMotion();
  private readonly grip = new THREE.Group();
  private readonly cloak: CloakUniforms = {
    amount: { value: 0 },
    time: { value: 0 },
    hurt: { value: 0 },
  };
  constructor() {
    super();
    this.rig.scale.setScalar(1.8 / 32);
    this.rig.position.y = 0.9;
    this.rig.rotation.y = Math.PI;
    this.rig.cape.visible = false;
    this.rig.elytra.visible = false;
    this.rig.ears.visible = false;
    this.rig.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        for (const material of Array.isArray(o.material) ? o.material : [o.material])
          if (material instanceof THREE.MeshStandardMaterial && !material.userData.cloak) {
            material.userData.cloak = true;
            patchCloak(material, this.cloak);
          }
      }
    });
    this.grip.rotation.set(0.77, 0.22, 0.24);
    this.grip.scale.setScalar(8);
    this.rig.skin.rightArm.add(this.grip);
    this.add(this.rig);
  }
  hold(model: THREE.Object3D, kind: "bomb" | "item" | "melee") {
    this.grip.clear();
    // The bomb mesh starts at its base. Seat that end inside the palm.
    if (kind === "bomb") this.grip.position.set(-0.65, -9.25, 1.15);
    else if (kind === "melee") {
      this.grip.position.set(-0.75, -9.3, 1.3);
      model.position.y -= 0.45;
      model.rotation.y = 0.7;
      model.rotation.x = -0.28;
    } else this.grip.position.set(-1.9, -9.1, 3.65);
    this.grip.add(model);
  }
  /** Light the texels marked in `glow`, such as eyes, independently of scene lighting. */
  setGlow(glow: MinecraftSkin, intensity: number) {
    this.rig.skin.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.emissive.set("#ffffff");
        material.emissiveMap = glow.texture;
        material.emissiveIntensity = intensity;
        material.needsUpdate = true;
      }
    });
  }
  /** Optical camo, 0 (off) to 1. `time` drives the travelling waves. */
  setCloak(amount: number, time: number) {
    this.cloak.amount.value = amount;
    this.cloak.time.value = time;
  }
  /** Red wash shown for a moment after taking damage, 0 (off) to 1. */
  setHurt(amount: number) {
    this.cloak.hurt.value = amount;
  }
  setSkin(skin: MinecraftSkin) {
    this.rig.skin.modelType = skin.model;
    this.rig.skin.map = skin.texture;
  }
  dispose() {
    this.grip.clear();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.rig.traverse((o) => {
      // Attachments marked as shared belong to the model library.
      if (o instanceof THREE.Mesh && !o.userData.shared) {
        geometries.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
