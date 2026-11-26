import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** What the badge commemorates; the metal follows the placement, the emblem follows the result. */
export type BadgeKind = "victory" | "defeat" | "draw";

const METALS = [
  { metal: "#f2c261", enamel: "#3a1d08", glow: "#ffd98a" },
  { metal: "#cfd6da", enamel: "#12222b", glow: "#bfe4ff" },
  { metal: "#c98a55", enamel: "#2a130a", glow: "#ffb37a" },
  { metal: "#6f7679", enamel: "#1c1210", glow: "#ff6a3d" },
] as const;

const IDLE_SPIN = 0.55;
const ENTRANCE = 0.9;
const SPARKS = 90;

function starShape(points: number, outer: number, inner: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? inner : outer,
      angle = Math.PI / 2 + (i * Math.PI) / points;
    shape[i ? "lineTo" : "moveTo"](Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return shape;
}

/** One half of a five-pointed star split down a jagged crack. `side` is -1 for left, 1 for right. */
function brokenStarHalf(side: number, outer: number, inner: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, outer);
  for (let i = 1; i <= 5; i++) {
    const radius = i % 2 ? inner : outer,
      angle = Math.PI / 2 + (side * i * Math.PI) / 5;
    shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  // Back up the crack; both halves share these points so they would close up exactly.
  for (const [x, y] of [
    [0.07, -0.12],
    [-0.06, 0.12],
    [0.05, 0.38],
  ])
    shape.lineTo(x * outer * 2, y * outer * 2);
  shape.closePath();
  return shape;
}

const extrude = (shape: THREE.Shape, depth: number, bevel: number) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  }).translate(0, 0, -depth / 2);

function raysMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color() }, rays: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float time, rays;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float r = length(vUv), a = atan(vUv.y, vUv.x);
        float beams = pow(0.5 + 0.5 * sin(a * 9.0 + time * 0.5), 3.0) * 0.6
                    + pow(0.5 + 0.5 * sin(a * 14.0 - time * 0.33), 4.0) * 0.4;
        float halo = exp(-r * r * 5.0);
        float glow = halo * 0.55 + rays * beams * smoothstep(1.0, 0.25, r) * smoothstep(0.1, 0.4, r) * 0.5;
        glow *= 0.85 + 0.15 * sin(time * 2.3);
        gl_FragColor = vec4(color * glow, glow);
      }`,
  });
}

function sparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color() },
      rise: { value: 1 },
      scale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float time, rise, scale;
      varying float vLife;
      void main() {
        float life = fract(seed.w + time * (0.18 + 0.22 * seed.z));
        vLife = life;
        float angle = seed.x * 6.2832 + time * (seed.z - 0.5) * 0.8;
        float radius = 0.55 + seed.y * 0.95 + life * 0.25;
        // Victory sparks climb; defeat embers sink and drift.
        vec3 p = vec3(cos(angle) * radius, mix(-1.3, 1.5, life) * rise + sin(angle * 3.0) * 0.1, sin(angle) * radius * 0.5);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = scale * (2.0 + 5.0 * seed.z) * sin(3.1416 * life) / -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * sin(3.1416 * vLife);
        gl_FragColor = vec4(color * a * 1.6, a);
      }`,
  });
}

/**
 * The medal on the result screen: a small scene of its own that the player can grab and spin.
 * One instance serves every match. The renderer and both emblems are built and compiled up
 * front, so showing the badge costs nothing at the end of a match.
 */
export class OutcomeBadge {
  readonly canvas = document.createElement("canvas");
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  private medal = new THREE.Group();
  private metal = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.24 });
  private enamel = new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.3 });
  private emblems = { whole: new THREE.Group(), broken: new THREE.Group(), bar: new THREE.Group() };
  private rays = raysMaterial();
  private sparks = sparkMaterial();
  private key = new THREE.PointLight("#ffffff", 0, 12);
  private frame = 0;
  private shownAt = 0;
  private last = 0;
  private yaw = 0;
  private pitch = 0;
  private spin = IDLE_SPIN;
  private tilt = 0;
  private grabbed?: { x: number; y: number; at: number };
  private still = false;

  constructor() {
    this.canvas.className = "outcome-badge";
    this.canvas.setAttribute("aria-hidden", "true");
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    } catch {
      // No second WebGL context to spare: the dialog simply shows without a badge.
      return;
    }
    const renderer = this.renderer;
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();

    this.camera.position.set(0, 0, 6.2);
    this.build();
    const lamp = new THREE.DirectionalLight("#fff4e0", 2.2);
    lamp.position.set(-2.5, 3, 4);
    this.key.position.set(1.6, 1.2, 2.6);
    this.scene.add(lamp, this.key, this.medal);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), this.rays);
    glow.position.z = -1.2;
    const seeds = new Float32Array(SPARKS * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = (Math.sin(i * 127.1 + 3.7) * 43758.5453) % 1;
    const points = new THREE.BufferGeometry();
    points.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    points.setAttribute("seed", new THREE.BufferAttribute(seeds.map(Math.abs), 4));
    const cloud = new THREE.Points(points, this.sparks);
    cloud.frustumCulled = false;
    this.scene.add(glow, cloud);
    renderer.compile(this.scene, this.camera);

    this.canvas.addEventListener("pointerdown", (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.grabbed = { x: e.clientX, y: e.clientY, at: performance.now() };
      this.spin = this.tilt = 0;
      this.canvas.dataset.grabbed = "";
      // The dialog must not treat a grab as a click on itself.
      e.stopPropagation();
    });
    this.canvas.addEventListener("pointermove", (e) => {
      const grab = this.grabbed;
      if (!grab) return;
      const now = performance.now(),
        dt = Math.max(1, now - grab.at) / 1000;
      const dx = (e.clientX - grab.x) * 0.012,
        dy = (e.clientY - grab.y) * 0.012;
      this.yaw += dx;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -1.1, 1.1);
      // The release speed is a short average, so a flick carries on and a slow drag stops dead.
      this.spin = THREE.MathUtils.lerp(this.spin, dx / dt, 0.4);
      this.tilt = THREE.MathUtils.lerp(this.tilt, dy / dt, 0.4);
      this.grabbed = { x: e.clientX, y: e.clientY, at: now };
    });
    const release = () => {
      this.grabbed = undefined;
      delete this.canvas.dataset.grabbed;
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
  }

  private build() {
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      return mesh;
    };
    // The body: a sunburst plate, a raised rim with studs, and an enamel field on both faces.
    this.medal.add(
      part(extrude(starShape(16, 1, 0.87), 0.1, 0.02), this.metal),
      part(new THREE.CylinderGeometry(0.74, 0.74, 0.17, 64).rotateX(Math.PI / 2), this.enamel),
    );
    for (const z of [0.07, -0.07]) {
      this.medal.add(part(new THREE.TorusGeometry(0.76, 0.045, 16, 72), this.metal, z));
      this.medal.add(part(new THREE.TorusGeometry(0.6, 0.012, 8, 72), this.metal, z + Math.sign(z) * 0.02));
    }
    const stud = new THREE.SphereGeometry(0.035, 12, 8);
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      for (const z of [0.09, -0.09]) {
        const mesh = part(stud, this.metal, z);
        mesh.position.x = Math.cos(angle) * 0.9;
        mesh.position.y = Math.sin(angle) * 0.9;
        this.medal.add(mesh);
      }
    }
    // Emblems are mirrored onto the back so the medal reads from either side.
    const both = (group: THREE.Group, make: (face: number) => THREE.Object3D[]) => {
      for (const face of [1, -1]) {
        const side = new THREE.Group();
        side.add(...make(face));
        side.position.z = face * 0.115;
        side.rotation.y = face > 0 ? 0 : Math.PI;
        group.add(side);
      }
      this.medal.add(group);
    };
    both(this.emblems.whole, () => [part(extrude(starShape(5, 0.52, 0.215), 0.07, 0.025), this.metal)]);
    both(this.emblems.broken, () =>
      [-1, 1].map((side) => {
        const half = part(extrude(brokenStarHalf(side, 0.52, 0.215), 0.07, 0.02), this.metal);
        half.position.set(side * 0.045, side * 0.02, 0);
        half.rotation.z = -side * 0.11;
        return half;
      }),
    );
    both(this.emblems.bar, () =>
      [0.12, -0.12].map((y) => {
        const bar = part(new THREE.BoxGeometry(0.72, 0.13, 0.08), this.metal);
        bar.position.y = y;
        return bar;
      }),
    );
  }

  /** Puts the badge into `host` and plays its entrance. `placement` is 1 for the winner. */
  show(host: HTMLElement, kind: BadgeKind, placement: number) {
    if (!this.renderer) return;
    const look = kind === "draw" ? METALS[1] : METALS[Math.min(METALS.length, Math.max(1, placement)) - 1];
    this.metal.color.set(look.metal);
    this.enamel.color.set(look.enamel);
    this.rays.uniforms.color.value.set(look.glow);
    this.sparks.uniforms.color.value.set(look.glow);
    this.rays.uniforms.rays.value = kind === "victory" ? 1 : 0.15;
    this.sparks.uniforms.rise.value = kind === "defeat" ? -0.7 : 1;
    this.key.color.set(look.glow);
    this.emblems.whole.visible = kind === "victory";
    this.emblems.broken.visible = kind === "defeat";
    this.emblems.bar.visible = kind === "draw";

    host.prepend(this.canvas);
    const size = this.canvas.clientWidth || 220,
      ratio = Math.min(2, devicePixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(size, size, false);
    this.sparks.uniforms.scale.value = size * ratio * 0.5;
    this.still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.yaw = this.pitch = this.tilt = 0;
    this.spin = IDLE_SPIN;
    this.grabbed = undefined;
    this.shownAt = this.last = performance.now();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.draw);
  }

  private draw = (now: number) => {
    // The dialog was closed: stop until the next match ends.
    if (!this.canvas.isConnected || !this.renderer) return;
    this.frame = requestAnimationFrame(this.draw);
    const dt = Math.min(0.05, (now - this.last) / 1000),
      age = (now - this.shownAt) / 1000;
    this.last = now;
    if (!this.grabbed) {
      // Momentum from a flick decays back into the idle spin; the tilt springs level.
      this.spin += (IDLE_SPIN * Math.sign(this.spin || 1) - this.spin) * Math.min(1, dt * 1.6);
      this.tilt *= Math.max(0, 1 - dt * 4);
      this.yaw += this.spin * dt;
      this.pitch += this.tilt * dt - this.pitch * Math.min(1, dt * 2.2);
    }
    const arrive = this.still ? 1 : Math.min(1, age / ENTRANCE),
      eased = 1 - (1 - arrive) ** 3;
    // It lands spinning: two extra turns that unwind as it grows to size with a slight overshoot.
    const overshoot = 1 + 0.16 * Math.sin(Math.PI * arrive) * (1 - arrive);
    this.medal.scale.setScalar(Math.max(0.001, eased * overshoot));
    this.medal.rotation.set(this.pitch, (this.still ? 0.35 : this.yaw) + (1 - eased) * Math.PI * 4, 0);
    this.medal.position.y = this.still ? 0 : Math.sin(age * 1.4) * 0.04;
    this.key.intensity = 14 + 60 * Math.max(0, 1 - age / 1.2) ** 2;
    this.rays.uniforms.time.value = this.sparks.uniforms.time.value = this.still ? 0 : age;
    this.renderer.render(this.scene, this.camera);
  };
}
