import * as THREE from "three";
import { film, ramp, scatter, type Film } from "./kit";

const LENGTH = 5.4;
const RINGS = 5;
const SHARDS = 90;
/** When the bar under the figure starts and finishes filling: the update being installed. */
const REFILL = { from: 1.5, to: 3.9 };
const BLOCKS = 16;

const BACKDROP_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
/** Rays turning behind the figure, through every colour the old tube can make, and closing in. */
const BACKDROP_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  vec3 hue(float h) {
    return 0.5 + 0.5 * cos(6.2831853 * (h + vec3(0.0, 0.33, 0.67)));
  }
  void main() {
    vec2 p = (vUv - vec2(0.5, 0.56)) * vec2(16.0 / 9.0, 1.0);
    float r = length(p), a = atan(p.y, p.x);
    float rays = pow(0.5 + 0.5 * sin(a * 14.0 + uTime * 1.3 + sin(r * 9.0 - uTime * 2.0)), 3.0);
    float rings = 0.5 + 0.5 * sin(r * 26.0 - uTime * 7.0);
    vec3 color = hue(a / 6.2831853 + r * 0.6 - uTime * 0.22) * (0.25 + 0.9 * rays);
    color += hue(uTime * 0.1 + 0.55) * rings * 0.22;
    // White heat in the middle, where the figure stands, and night at the edges.
    color = mix(color, vec3(1.0), smoothstep(0.42, 0.0, r) * (0.55 + 0.45 * uPower));
    color *= smoothstep(1.15, 0.2, r) * (0.3 + 0.7 * uPower);
    // The same scanlines as the sky outside.
    color *= 0.86 + 0.14 * step(0.5, fract(vUv.y * 180.0));
    gl_FragColor = vec4(color, 1.0);
  }`;

/**
 * The last of the three gets up. Whoever it is, it is drawn as a black figure against the light:
 * it rises off the ground with its arms opening, rings go out from it, the bar under it fills
 * to the end again, and the picture goes white. `color` tints the bar and the rings.
 */
export function playApocalypse(canvas: HTMLCanvasElement, color: string): Film {
  return film(canvas, "stage", (shot) => {
    const { scene, camera, keep } = shot;
    scene.background = new THREE.Color("#000000");
    camera.fov = 44;
    const tint = new THREE.Color(color);

    const sky = keep(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
        vertexShader: BACKDROP_VERTEX,
        fragmentShader: BACKDROP_FRAGMENT,
        depthWrite: false,
      }),
    );
    const backdrop = new THREE.Mesh(keep(new THREE.PlaneGeometry(64, 36)), sky);
    backdrop.position.set(0, 2, -14);
    scene.add(backdrop);

    // The figure: the game's own blocky body, with nothing on it but black.
    const body = new THREE.Group();
    scene.add(body);
    const part = (size: readonly [number, number, number], at: readonly [number, number, number]) => {
      const pivot = new THREE.Group();
      pivot.position.set(...at);
      body.add(pivot);
      // Hung from its top, so a limb swings from the shoulder or the hip.
      shot.box(size, [0, -size[1] / 2, 0], "#000000", { parent: pivot, unlit: true });
      return pivot;
    };
    part([0.5, 0.5, 0.5], [0, 2, 0]);
    part([0.5, 0.75, 0.25], [0, 1.5, 0]);
    const arms = [-1, 1].map((side) => part([0.25, 0.75, 0.25], [side * 0.375, 1.5, 0]));
    const legs = [-1, 1].map((side) => part([0.25, 0.75, 0.25], [side * 0.125, 0.75, 0]));
    // Two eyes are all that is lit of it.
    const eyes = [-1, 1].map((side) =>
      shot.box([0.09, 0.05, 0.02], [side * 0.11, 1.76, 0.26], "#ffffff", { parent: body, unlit: true }),
    );

    const ringShape = keep(new THREE.RingGeometry(0.94, 1, 64));
    const rings = Array.from({ length: RINGS }, () => {
      const material = keep(
        new THREE.MeshBasicMaterial({
          color: tint,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(ringShape, material);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      return mesh;
    });

    // Pieces of the ground let go and rise past it.
    const shards = Array.from({ length: SHARDS }, (_, i) => {
      const size = 0.05 + scatter(i, 1) * 0.16;
      const mesh = shot.box([size, size * (1 + scatter(i, 2) * 3), size], [0, 0, 0], "#000000", {
        unlit: true,
      });
      return mesh;
    });

    // The bar: a frame of white, and blocks that fill it from the left.
    const bar = new THREE.Group();
    bar.position.set(0, 0.05, 1.2);
    scene.add(bar);
    const wide = 3.2,
      step = wide / BLOCKS;
    for (const [w, h, x, y] of [
      [wide + 0.16, 0.03, 0, 0.14],
      [wide + 0.16, 0.03, 0, -0.14],
      [0.03, 0.31, -wide / 2 - 0.08, 0],
      [0.03, 0.31, wide / 2 + 0.08, 0],
    ] as const)
      shot.box([w, h, 0.02], [x, y, 0], "#ffffff", { parent: bar, unlit: true });
    const blocks = Array.from({ length: BLOCKS }, (_, i) =>
      shot.box([step * 0.76, 0.18, 0.02], [-wide / 2 + (i + 0.5) * step, 0, 0], tint, {
        parent: bar,
        unlit: true,
      }),
    );

    const flash = keep(
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthTest: false }),
    );
    const sheet = new THREE.Mesh(keep(new THREE.PlaneGeometry(8, 5)), flash);
    sheet.position.z = -1;
    sheet.renderOrder = 10;
    camera.add(sheet);

    return (t) => {
      const power = ramp(0.3, 3.9, t);
      sky.uniforms.uTime.value = t;
      sky.uniforms.uPower.value = power;

      // Up off the ground, arms out, head back; then held there, shaking with what it holds.
      const risen = ramp(0.5, 3.2, t);
      const tremble = power * 0.02;
      body.position.set(
        Math.sin(t * 71) * tremble,
        risen * 1.15 + Math.sin(t * 2.1) * 0.05,
        Math.sin(t * 59) * tremble,
      );
      arms.forEach((arm, i) => (arm.rotation.z = (i ? 1 : -1) * ramp(0.9, 3, t) * 2.2));
      legs.forEach((leg, i) => (leg.rotation.x = (i ? 1 : -1) * risen * 0.12));
      for (const eye of eyes) eye.visible = t > 1.1 && Math.sin(t * 40) > -0.85;

      rings.forEach((ring, i) => {
        const life = (t * 0.55 + i / RINGS) % 1;
        ring.scale.setScalar(0.6 + life * 9);
        ring.position.y = 0.04;
        ring.material.opacity = (1 - life) * power * 0.9;
      });
      shards.forEach((shard, i) => {
        const turn = scatter(i, 3) * Math.PI * 2,
          reach = 0.9 + scatter(i, 4) * 5.5,
          life = (t * (0.25 + scatter(i, 5) * 0.4) + scatter(i, 6)) % 1;
        shard.position.set(Math.cos(turn) * reach, life * 6.5 * power, Math.sin(turn) * reach - 0.5);
        shard.rotation.set(t * (1 + scatter(i, 7) * 3), turn, t * 2);
        shard.visible = power > 0.05;
      });

      const filled = ramp(REFILL.from, REFILL.to, t) * BLOCKS;
      blocks.forEach((block, i) => (block.visible = i < Math.floor(filled)));
      bar.visible = t > REFILL.from - 0.4;

      // A slow push in from below, so the figure stands over whoever is watching.
      const push = ramp(0, LENGTH, t);
      camera.position.set(Math.sin(t * 0.5) * 0.25, 0.75 - push * 0.1, 7.2 - push * 2.1);
      camera.lookAt(0, 1.35 + risen * 1.05, 0);
      flash.opacity = ramp(LENGTH - 0.75, LENGTH - 0.15, t);
      return t >= LENGTH;
    };
  });
}
