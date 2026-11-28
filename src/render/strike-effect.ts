import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PERKS } from "../core/content";
import { strikeRevealed, strikeWarning } from "../core/systems/strikes";
import type { GameSnapshot, Strike, Vec2 } from "../core/types";
import { TILE_SIZE, world } from "./arena";
import type { MaterialLibrary } from "./materials";

/** Seconds before impact at which the missile itself comes into view. */
const FLIGHT = 1.25;
/** Height the missile is first seen at, and how far it leans off vertical. */
const ENTRY_HEIGHT = 78;
const LEAN = new THREE.Vector3(-0.22, -1, -0.12).normalize();
/** Length of the missile model, tail to nose. */
const MISSILE_LENGTH = 4.2;
const TRAIL_PUFFS = 14;
/** Seconds the explosion plays for; the scorch mark outlasts it. */
const BURST = 2.4;
const SCORCH = 9;
const SPARKS = 90;
const COLUMN_PUFFS = 16;

const HASH = /* glsl */ `
float sxHash(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float sxNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(sxHash(i), sxHash(i + vec3(1, 0, 0)), f.x), mix(sxHash(i + vec3(0, 1, 0)), sxHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(sxHash(i + vec3(0, 0, 1)), sxHash(i + vec3(1, 0, 1)), f.x), mix(sxHash(i + vec3(0, 1, 1)), sxHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sxFbm(vec3 p) { return .55 * sxNoise(p) + .3 * sxNoise(p * 2.1) + .15 * sxNoise(p * 4.3); }`;

/** Ground marker, shown to the caller from launch and to everyone else late: the blast radius, a rotating reticle, and rings that close in as the missile nears. */
const markerMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    vertexShader: `varying vec2 p; void main() { p = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      uniform float progress, time; varying vec2 p;
      void main() {
        float r = length(p), a = atan(p.y, p.x);
        float edge = smoothstep(.93, .955, r) * (1. - smoothstep(.985, 1., r));
        float dashes = step(.5, fract(a * 3.8197 + time * .6)) * smoothstep(.8, .82, r) * (1. - smoothstep(.9, .92, r));
        float closing = 1. - progress;
        float sweep = smoothstep(.035, 0., abs(r - closing * .93)) * step(r, .93);
        float hair = (smoothstep(.02, 0., abs(p.x)) + smoothstep(.02, 0., abs(p.y))) * step(r, .3) * step(.07, r);
        float fill = (1. - smoothstep(.0, .95, r)) * (.1 + .22 * progress) * step(r, .95);
        float blink = .65 + .35 * sin(time * (6. + 22. * progress * progress));
        float alpha = (edge + .7 * dashes + sweep + hair) * blink + fill;
        vec3 color = mix(vec3(1., .42, .12), vec3(1., .12, .08), progress);
        gl_FragColor = vec4(color, clamp(alpha, 0., .95));
        #include <colorspace_fragment>
      }`,
  });

/** Engine plume: an additive cone that flickers along its length. */
const plumeMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 q; void main() { q = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      uniform float time; varying vec2 q;
      void main() {
        // Brightest at the nozzle, fading towards the tip of the cone.
        float along = 1. - q.y;
        float flicker = .75 + .25 * sin(along * 26. - time * 70.) * sin(q.x * 31. + time * 23.);
        vec3 color = mix(vec3(1., .35, .08), vec3(1., .95, .75), pow(along, 2.2));
        gl_FragColor = vec4(color * flicker, pow(along, 1.4));
        #include <colorspace_fragment>
      }`,
  });

/** Fireball: a noise-displaced sphere that cools from white through orange into soot. */
const fireballMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { age: { value: 0 }, seed: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float age, seed; varying float heat; varying vec3 n, viewPos;
      ${HASH}
      void main() {
        float swell = sxFbm(normal * 2.4 + vec3(seed, age * 1.6, -age));
        heat = swell;
        vec3 at = position * (1. + (swell - .45) * (.5 + .5 * age));
        vec4 v = modelViewMatrix * vec4(at, 1.);
        viewPos = v.xyz; n = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * v;
      }`,
    fragmentShader: /* glsl */ `
      uniform float age; varying float heat; varying vec3 n, viewPos;
      void main() {
        float core = abs(dot(normalize(n), normalize(-viewPos)));
        float cool = clamp(age * 1.25 + (1. - heat) * .7 - core * .35, 0., 1.6);
        vec3 color = mix(vec3(2.6, 2.3, 1.7), vec3(2.2, .95, .16), smoothstep(0., .45, cool));
        color = mix(color, vec3(.5, .1, .03), smoothstep(.45, .85, cool));
        color = mix(color, vec3(.045, .04, .04), smoothstep(.8, 1.25, cool));
        float alpha = (1. - smoothstep(.55, 1., age)) * (.55 + .45 * core);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }`,
  });

/** Ground shockwave and the scorch it leaves; `mode` 0 is the wave, 1 the scorch. */
const groundMaterial = (mode: 0 | 1) =>
  new THREE.ShaderMaterial({
    uniforms: { age: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: mode ? THREE.NormalBlending : THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: mode ? -2 : -4,
    vertexShader: `varying vec2 p; void main() { p = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      uniform float age; varying vec2 p;
      ${HASH}
      void main() {
        float r = length(p);
        #if ${mode} == 0
          float front = 1. - pow(1. - clamp(age, 0., 1.), 3.);
          float ring = smoothstep(.16, 0., abs(r - front)) * step(r, 1.);
          float inner = (1. - smoothstep(0., front, r)) * .35;
          gl_FragColor = vec4(vec3(1., .78, .45) * (ring * 1.6 + inner), (ring + inner) * (1. - age));
        #else
          float rough = sxNoise(vec3(p * 7., 3.));
          float burn = (1. - smoothstep(.25, .95 + .1 * rough, r)) * (.55 + .3 * rough);
          float embers = pow(sxNoise(vec3(p * 22., 9.)), 5.) * (1. - smoothstep(0., .5, age)) * (1. - r);
          gl_FragColor = vec4(vec3(.02, .017, .015) + vec3(1.8, .5, .1) * embers * 3., burn * (1. - smoothstep(.6, 1., age)));
        #endif
        #include <colorspace_fragment>
      }`,
  });

/** Sparks thrown outward on ballistic arcs, integrated in the vertex shader. */
const sparkMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { age: { value: 0 }, scale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float age, scale; attribute vec3 velocity; attribute float life; varying float glow;
      void main() {
        float t = age * ${BURST.toFixed(2)};
        vec3 at = velocity * t + vec3(0., -11. * t * t, 0.);
        at.y = max(at.y, .05);
        glow = clamp(1. - t / life, 0., 1.);
        vec4 v = modelViewMatrix * vec4(at, 1.);
        gl_PointSize = scale * (.35 + .65 * glow) / max(.5, -v.z);
        gl_Position = projectionMatrix * v;
      }`,
    fragmentShader: /* glsl */ `
      varying float glow;
      void main() {
        float d = length(gl_PointCoord - .5);
        if (d > .5 || glow <= 0.) discard;
        gl_FragColor = vec4(mix(vec3(1., .3, .05), vec3(1., .9, .6), glow) * 1.8, (1. - d * 2.) * glow);
        #include <colorspace_fragment>
      }`,
  });

interface Flight {
  group: THREE.Group;
  marker: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  body: THREE.Group;
  plume: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  trail: THREE.Sprite[];
  strike: Strike;
}
interface Burst {
  group: THREE.Group;
  at: number;
  radius: number;
  flash: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  fireball: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  wave: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  scorch: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  sparks: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  column: THREE.Sprite[];
}

/**
 * Missile Strike: the ground marker, the missile and its smoke trail, and the explosion
 * (flash, fireball, ground shockwave, sparks, smoke column, scorch). Everything follows simulation
 * time, so a paused match freezes it. All geometry, textures and shader programs exist before the
 * first match: the model loads through the shared manager and `warm` compiles the programs.
 */
export class StrikeEffect {
  readonly root = new THREE.Group();
  private model?: THREE.Object3D;
  private flights = new Map<number, Flight>();
  private bursts: Burst[] = [];
  private disc = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  private cone = new THREE.ConeGeometry(0.34, 3.4, 14, 1, true).rotateX(Math.PI).translate(0, -1.7, 0);
  private ball = new THREE.IcosahedronGeometry(1, 5);
  private sparkGeometry = new THREE.BufferGeometry();
  private prototypes = {
    marker: markerMaterial(),
    plume: plumeMaterial(),
    fireball: fireballMaterial(),
    wave: groundMaterial(0),
    scorch: groundMaterial(1),
    sparks: sparkMaterial(),
  };
  private smoke: THREE.SpriteMaterial;
  private flashMaterial = new THREE.MeshBasicMaterial({
    color: "#fff1cf",
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });

  constructor(manager: THREE.LoadingManager, materials: MaterialLibrary, smokeMap: THREE.Texture) {
    const model = PERKS.find((perk) => perk.strikeModel)?.strikeModel;
    if (model)
      new GLTFLoader(manager).load(
        model,
        ({ scene }) => {
          materials.applyPalette(scene);
          scene.traverse((o) => {
            if (o instanceof THREE.Mesh) o.castShadow = true;
          });
          this.model = scene;
          for (const flight of this.flights.values())
            if (!flight.body.children.length) flight.body.add(scene.clone());
        },
        undefined,
        (error) => console.error("Cannot load the missile model", error),
      );
    this.smoke = new THREE.SpriteMaterial({ map: smokeMap, depthWrite: false, transparent: true });
    // Deterministic spark fan: mostly outward and low, a few thrown high.
    const velocity = new Float32Array(SPARKS * 3),
      life = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) {
      const angle = i * 2.39996,
        lift = ((i * 37) % 100) / 100,
        speed = 7 + ((i * 53) % 100) / 9;
      velocity.set([Math.cos(angle) * speed, 5 + lift * lift * 22, Math.sin(angle) * speed], i * 3);
      life[i] = 0.7 + ((i * 29) % 100) / 70;
    }
    this.sparkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    this.sparkGeometry.setAttribute("velocity", new THREE.BufferAttribute(velocity, 3));
    this.sparkGeometry.setAttribute("life", new THREE.BufferAttribute(life, 1));
    this.sparkGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
  }

  /**
   * One of everything a strike draws. Strikes clone these materials and dispose the clones, so
   * the prototypes have to hold the programs, compiled in the scene the match is drawn in.
   */
  warmObjects(): THREE.Object3D[] {
    const p = this.prototypes;
    return [
      new THREE.Mesh(this.disc, p.marker),
      new THREE.Mesh(this.cone, p.plume),
      new THREE.Mesh(this.ball, p.fireball),
      new THREE.Mesh(this.disc, p.wave),
      new THREE.Mesh(this.disc, p.scorch),
      new THREE.Points(this.sparkGeometry, p.sparks),
      new THREE.Mesh(this.ball, this.flashMaterial),
      new THREE.Sprite(this.smoke),
      ...(this.model ? [this.model.clone()] : []),
    ];
  }

  private launch(strike: Strike, size: number): Flight {
    const group = new THREE.Group();
    const marker = new THREE.Mesh(this.disc, this.prototypes.marker.clone());
    marker.scale.setScalar(strike.radius * TILE_SIZE + TILE_SIZE * 0.5);
    marker.position.set(world(strike.x, size), 0.06, world(strike.z, size));
    marker.renderOrder = 4;
    const body = new THREE.Group();
    if (this.model) body.add(this.model.clone());
    // The model points up; turn its nose along the dive.
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), LEAN);
    const plume = new THREE.Mesh(this.cone, this.prototypes.plume.clone());
    body.add(plume);
    const trail = Array.from({ length: TRAIL_PUFFS }, () => {
      const puff = new THREE.Sprite(this.smoke.clone());
      puff.material.color.set("#cfd0cc");
      return puff;
    });
    group.add(marker, body, ...trail);
    this.root.add(group);
    return { group, marker, body, plume, trail, strike };
  }

  private explode(strike: Strike, size: number, time: number) {
    const group = new THREE.Group();
    group.position.set(world(strike.x, size), 0, world(strike.z, size));
    const radius = strike.radius * TILE_SIZE;
    const p = this.prototypes;
    const flash = new THREE.Mesh(this.ball, this.flashMaterial.clone());
    const fireball = new THREE.Mesh(this.ball, p.fireball.clone());
    fireball.material.uniforms.seed.value = strike.id * 1.37;
    fireball.renderOrder = 7;
    const wave = new THREE.Mesh(this.disc, p.wave.clone());
    wave.position.y = 0.09;
    wave.renderOrder = 5;
    const scorch = new THREE.Mesh(this.disc, p.scorch.clone());
    scorch.position.y = 0.045;
    scorch.scale.setScalar(radius * 0.95);
    scorch.renderOrder = 1;
    const sparks = new THREE.Points(this.sparkGeometry, p.sparks.clone());
    sparks.renderOrder = 8;
    const column = Array.from({ length: COLUMN_PUFFS }, () => {
      const puff = new THREE.Sprite(this.smoke.clone());
      puff.renderOrder = 6;
      return puff;
    });
    group.add(scorch, wave, fireball, flash, sparks, ...column);
    this.root.add(group);
    this.bursts.push({ group, at: time, radius, flash, fireball, wave, scorch, sparks, column });
  }

  /** Returns the cells hit since the last call, for camera shake. */
  update(state: Readonly<GameSnapshot>, pixelRatio: number, viewerId: string): Vec2[] {
    const impacts: Vec2[] = [];
    const live = new Set((state.strikes ?? []).map((s) => s.id));
    for (const [id, flight] of this.flights) {
      if (live.has(id)) continue;
      this.release(flight.group);
      this.flights.delete(id);
      // A strike that left the snapshot at its landing time has hit; anything else was cancelled.
      if (state.time >= flight.strike.landsAt - 0.05) {
        this.explode(flight.strike, state.size, flight.strike.landsAt);
        impacts.push(flight.strike);
      }
    }
    for (const strike of state.strikes ?? []) {
      let flight = this.flights.get(strike.id);
      if (!flight) this.flights.set(strike.id, (flight = this.launch(strike, state.size)));
      this.fly(flight, state, viewerId);
    }
    this.bursts = this.bursts.filter((burst) => {
      const age = state.time - burst.at;
      if (age >= 0 && age < SCORCH) {
        this.burn(burst, age, pixelRatio);
        return true;
      }
      this.release(burst.group);
      return false;
    });
    return impacts;
  }

  private fly(
    { marker, body, plume, trail, strike }: Flight,
    state: Readonly<GameSnapshot>,
    viewerId: string,
  ) {
    const total = strike.landsAt - strike.launchedAt;
    const left = strike.landsAt - state.time;
    // The rings close over the warning this viewer gets, so a late marker still plays in full.
    marker.visible = strikeRevealed(strike, state.time, viewerId);
    marker.material.uniforms.progress.value = THREE.MathUtils.clamp(
      1 - left / strikeWarning(strike, viewerId),
      0,
      1,
    );
    marker.material.uniforms.time.value = state.time;
    const dive = THREE.MathUtils.clamp(1 - left / Math.min(FLIGHT, total), 0, 1);
    const visible = dive > 0;
    body.visible = visible;
    for (const puff of trail) puff.visible = visible;
    if (!visible) return;
    const target = marker.position;
    const path = ENTRY_HEIGHT / -LEAN.y;
    // Nose position: the remaining distance back up the dive line.
    const along = (t: number) => (1 - t) * path;
    const place = (out: THREE.Vector3, t: number, offset = 0) =>
      out.copy(target).addScaledVector(LEAN, -(along(t) + offset));
    place(body.position, dive, MISSILE_LENGTH);
    plume.material.uniforms.time.value = state.time;
    plume.scale.set(1, 0.85 + 0.3 * Math.sin(state.time * 61), 1);
    trail.forEach((puff, i) => {
      const lag = (i + 1) * 0.035;
      const t = dive - lag;
      puff.visible = t > 0;
      if (!puff.visible) return;
      place(puff.position, t, MISSILE_LENGTH + 1.2);
      const grown = 1.4 + lag * 26;
      puff.scale.set(grown, grown, 1);
      puff.material.opacity = 0.5 * (1 - i / TRAIL_PUFFS);
      puff.material.rotation = i * 1.7;
    });
  }

  private burn(burst: Burst, age: number, pixelRatio: number) {
    const t = Math.min(1, age / BURST);
    const { radius } = burst;
    const playing = age < BURST;
    burst.flash.visible = age < 0.4;
    if (burst.flash.visible) {
      const grow = Math.min(1, age / 0.1);
      burst.flash.scale.setScalar(radius * (0.35 + 0.95 * grow));
      burst.flash.material.opacity = 0.95 * (1 - age / 0.4) ** 2;
    }
    burst.fireball.visible = playing && t < 1;
    if (burst.fireball.visible) {
      const swell = 1 - Math.exp(-age * 5.5);
      burst.fireball.scale.set(
        radius * 0.78 * swell,
        radius * (0.6 + 0.35 * t) * swell,
        radius * 0.78 * swell,
      );
      burst.fireball.position.y = radius * (0.22 + 0.9 * t);
      burst.fireball.material.uniforms.age.value = Math.min(1, age / 1.5);
    }
    burst.wave.visible = age < 0.75;
    if (burst.wave.visible) {
      burst.wave.scale.setScalar(radius * 1.9);
      burst.wave.material.uniforms.age.value = age / 0.75;
    }
    burst.sparks.visible = playing;
    burst.sparks.material.uniforms.age.value = t;
    burst.sparks.material.uniforms.scale.value = pixelRatio * 110;
    burst.scorch.material.uniforms.age.value = age / SCORCH;
    burst.column.forEach((puff, i) => {
      const start = 0.12 + (i / COLUMN_PUFFS) * 0.5;
      const life = (age - start) / (BURST - start);
      puff.visible = playing && life > 0 && life < 1;
      if (!puff.visible) return;
      const angle = i * 2.39996,
        spread = radius * (0.12 + 0.3 * ((i * 7) % 5) * 0.2) * (0.4 + life);
      const rise = radius * (0.3 + (1.5 + (i % 4) * 0.35) * (1 - (1 - life) ** 2));
      puff.position.set(Math.cos(angle) * spread, rise, Math.sin(angle) * spread);
      const grown = radius * (0.55 + 0.9 * life);
      puff.scale.set(grown, grown, 1);
      puff.material.rotation = angle + life * 0.6;
      // Lit from below at first, then soot.
      puff.material.color.setRGB(0.5 - 0.38 * life, 0.26 - 0.18 * life, 0.12 - 0.05 * life);
      puff.material.opacity = 0.82 * Math.min(1, life * 6) * (1 - life) ** 1.3;
    });
  }

  /** Drops one flight or burst and the per-instance materials cloned for it. */
  private release(group: THREE.Group) {
    group.removeFromParent();
    group.traverse((o) => {
      if (!(o instanceof THREE.Sprite || o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
      const material = o.material;
      // The missile's own surfaces belong to the shared palette and stay.
      if (
        material instanceof THREE.ShaderMaterial ||
        material instanceof THREE.SpriteMaterial ||
        material instanceof THREE.MeshBasicMaterial
      )
        material.dispose();
    });
  }

  clear() {
    for (const flight of this.flights.values()) this.release(flight.group);
    for (const burst of this.bursts) this.release(burst.group);
    this.flights.clear();
    this.bursts = [];
  }

  dispose() {
    this.clear();
    this.disc.dispose();
    this.cone.dispose();
    this.ball.dispose();
    this.sparkGeometry.dispose();
    Object.values(this.prototypes).forEach((m) => m.dispose());
    this.smoke.dispose();
    this.flashMaterial.dispose();
    this.model?.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
