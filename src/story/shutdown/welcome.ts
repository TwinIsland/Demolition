import * as THREE from "three";
import { STORY_SKINS } from "../assets";
import { film, ramp, scatter, type Film } from "./kit";

const FALL = 3.6;
const EYE = 1.62;
const PIXELS = 220;
const PETALS = 90;
const COLD = new THREE.Color("#63e6ff");

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SKY_FRAGMENT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    float up = clamp(vDir.y, 0.0, 1.0);
    vec3 color = mix(vec3(0.8, 0.94, 1.0), vec3(0.16, 0.46, 0.9), pow(up, 0.55));
    gl_FragColor = vec4(color, 1.0);
  }`;

/**
 * The "stay" ending, seen by whoever comes next: the camera is the new player, falling down a
 * shaft of light into the village plaza, where two guides are waiting instead of one. The film
 * is done at the landing and goes on idling after it, for the lines spoken over it.
 */
export function playWelcome(canvas: HTMLCanvasElement): Film {
  return film(canvas, "stage", (shot) => {
    const { scene, camera, keep } = shot;
    camera.fov = 62;
    scene.fog = new THREE.Fog("#cfeeff", 40, 150);
    const dome = new THREE.Mesh(
      keep(new THREE.SphereGeometry(300, 24, 12)),
      keep(
        new THREE.ShaderMaterial({
          vertexShader: SKY_VERTEX,
          fragmentShader: SKY_FRAGMENT,
          side: THREE.BackSide,
          fog: false,
        }),
      ),
    );
    scene.add(dome);
    scene.add(new THREE.HemisphereLight("#dff2ff", "#6f9a62", 1.1));
    const sun = new THREE.DirectionalLight("#fff3d6", 1.6);
    sun.position.set(-6, 10, 7);
    scene.add(sun);

    // The village, as few boxes as it takes: lawn, a paved plaza, a gate, cherry trees, clouds.
    shot.box([240, 0.2, 240], [0, -0.1, 0], "#79b765");
    const slabs = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(1.16, 0.12, 1.16)),
      keep(new THREE.MeshStandardMaterial({ roughness: 0.95 })),
      15 * 15,
    );
    const matrix = new THREE.Matrix4(),
      shade = new THREE.Color();
    for (let i = 0; i < 15 * 15; i++) {
      matrix.setPosition(((i % 15) - 7) * 1.2, 0.02, (Math.floor(i / 15) - 7) * 1.2 - 3);
      slabs.setMatrixAt(i, matrix);
      slabs.setColorAt(i, shade.set("#a9a6b2").multiplyScalar(0.82 + 0.3 * scatter(i, 1)));
    }
    scene.add(slabs);
    const gate = new THREE.Group();
    gate.position.set(0, 0, -13);
    scene.add(gate);
    for (const x of [-2.6, 2.6]) shot.box([0.5, 5.6, 0.5], [x, 2.8, 0], "#c8382e", { parent: gate });
    shot.box([7.4, 0.5, 0.8], [0, 5.8, 0], "#2a2530", { parent: gate });
    shot.box([6.2, 0.36, 0.5], [0, 4.7, 0], "#c8382e", { parent: gate });
    const blossom = keep(new THREE.BoxGeometry(1, 1, 1));
    const pink = keep(new THREE.MeshStandardMaterial({ color: "#f6b4cc", roughness: 1 }));
    const white = keep(new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }));
    [
      [-9, -6],
      [9, -7],
      [-11, -15],
      [11, -16],
      [-7, 3],
      [8, 4],
    ].forEach(([x, z], tree) => {
      shot.box([0.7, 3.2, 0.7], [x, 1.6, z], "#5a3b2e");
      for (let i = 0; i < 9; i++) {
        const puff = new THREE.Mesh(blossom, pink);
        puff.position.set(
          x + (scatter(tree * 9 + i, 1) - 0.5) * 3.4,
          3.6 + scatter(tree * 9 + i, 2) * 2,
          z + (scatter(tree * 9 + i, 3) - 0.5) * 3.4,
        );
        puff.scale.setScalar(1.1 + scatter(tree * 9 + i, 4) * 1.1);
        scene.add(puff);
      }
    });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Mesh(blossom, white);
      const angle = scatter(i, 5) * Math.PI * 2;
      cloud.position.set(Math.cos(angle) * 120, 34 + scatter(i, 6) * 30, Math.sin(angle) * 120);
      cloud.scale.set(18 + scatter(i, 7) * 26, 5 + scatter(i, 8) * 5, 12 + scatter(i, 9) * 12);
      scene.add(cloud);
    }

    // The guides: the old one, and the one who insisted.
    const zero = shot.figure(STORY_SKINS["story-zero"]);
    zero.root.position.set(-0.8, 0.08, -2.1);
    const lulu = shot.figure(STORY_SKINS["story-lulu"], 0.62);
    lulu.root.position.set(0.95, 0.08, -1.9);

    // The shaft the newcomer falls down, and the pixels that fall with them.
    const shaftMaterial = keep(
      new THREE.MeshBasicMaterial({
        color: COLD,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const shaft = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.2, 2.2, 160, 24, 1, true)), shaftMaterial);
    shaft.position.set(0, 80, 1.2);
    scene.add(shaft);
    const pixels = new THREE.InstancedMesh(
      keep(new THREE.BoxGeometry(0.12, 0.12, 0.12)),
      keep(new THREE.MeshBasicMaterial({ color: "#bff8ff", fog: false })),
      PIXELS,
    );
    pixels.frustumCulled = false;
    scene.add(pixels);
    const petals = new THREE.InstancedMesh(
      keep(new THREE.PlaneGeometry(0.14, 0.1)),
      keep(new THREE.MeshBasicMaterial({ color: "#ffd3e2", side: THREE.DoubleSide })),
      PETALS,
    );
    petals.frustumCulled = false;
    scene.add(petals);

    const place = new THREE.Vector3(),
      turn = new THREE.Quaternion(),
      axis = new THREE.Euler(),
      size = new THREE.Vector3(),
      look = new THREE.Vector3();
    return (t) => {
      const fall = ramp(0, FALL, t) ** 1.6,
        arrive = ramp(FALL, FALL + 0.9, t),
        pose = ramp(FALL + 0.3, FALL + 1.3, t);
      const height = EYE + 70 * (1 - fall);
      const thud = Math.sin(Math.PI * ramp(FALL, FALL + 0.35, t)) * 0.22;
      camera.position.set(Math.sin(t * 29) * 0.03 * (1 - arrive), height - thud, 1.2);
      // Looking down the shaft at first, then up at who is standing there.
      camera.lookAt(
        look.set(0, THREE.MathUtils.lerp(height - 30, 1.35, ramp(FALL * 0.45, FALL + 0.6, t)), -2.0),
      );
      shaftMaterial.opacity = 0.2 * (1 - ramp(FALL + 0.2, FALL + 1.6, t));
      for (let i = 0; i < PIXELS; i++) {
        const angle = scatter(i, 1) * Math.PI * 2,
          radius = 0.6 + scatter(i, 2) * 1.5;
        const y = height + 14 - ((t * (10 + 16 * scatter(i, 3)) + scatter(i, 4) * 40) % 40);
        place.set(Math.cos(angle) * radius, y, 1.2 + Math.sin(angle) * radius);
        matrix.compose(place, turn, size.setScalar(arrive < 1 ? 0.6 + scatter(i, 5) : 0));
        pixels.setMatrixAt(i, matrix);
      }
      pixels.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < PETALS; i++) {
        const drift = (t * (0.5 + scatter(i, 6) * 0.6) + scatter(i, 7) * 9) % 9;
        place.set((scatter(i, 8) - 0.5) * 22 + drift * 0.6, 8 - drift, (scatter(i, 9) - 0.6) * 20);
        axis.set(t * (1 + scatter(i, 10)), t * 0.7, drift);
        matrix.compose(place, turn.setFromEuler(axis), size.setScalar(1));
        petals.setMatrixAt(i, matrix);
      }
      petals.instanceMatrix.needsUpdate = true;

      // Zero's welcome is a pose he has practised: one hand over the eye, the other thrown wide.
      const breath = Math.sin(t * 2) * 0.03;
      const z = zero.rig.skin;
      z.rightArm.rotation.set(-2.5 * pose, 0, -0.75 * pose - breath);
      z.leftArm.rotation.set(-0.4 * pose, 0, 1.25 * pose + breath);
      z.head.rotation.set(-0.12 * pose, 0, 0.14 * pose);
      zero.root.rotation.y = 0.2 * pose;
      // Lulu folds her arms and looks the other way. She stands very close all the same.
      const l = lulu.rig.skin;
      l.leftArm.rotation.set(-0.9, 0, -0.55);
      l.rightArm.rotation.set(-0.9, 0, 0.55);
      l.head.rotation.set(-0.1, 0.35 + 0.5 * pose, 0);
      lulu.root.position.y = 0.08 + Math.abs(Math.sin(t * 2.4)) * 0.02;
      return t >= FALL + 1.4;
    };
  });
}
