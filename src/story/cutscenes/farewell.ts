import * as THREE from "three";
import { STORY_SKINS } from "../assets";
import { pick, playFilm, ramp, type Cutscene, type FilmKit } from "./kit";

/** The pictures of the goodbye: their faces, the sky over their backs, the island, his hand. */
export type FarewellShot = "faces" | "sky" | "island" | "ribbon";
export interface Farewell extends Cutscene {
  /** Changes the picture at once; whoever calls covers the cut. */
  cut(shot: FarewellShot): void;
  /** What the writing in the sky reads. */
  percent(value: 97 | 98): void;
}

/** Side of a paving stone, and stones from the well to the edge of what is left. */
const STONE = 1.5,
  REACH = 8;
/** Top of the well's rim, which is what they sit on, and how far south of its middle. */
const RIM = 0.9,
  SEAT = 1.05;
/** Stones out from the well that hold when the film opens, and when everything else has gone. */
const HOLD = { first: 7.2, last: 4.9 };
/** Seconds a picture's one slow move takes; it rests on its last frame after that. */
const MOVE: Record<FarewellShot, number> = { faces: 30, sky: 30, island: 40, ribbon: 16 };
const SKY = ["#05041a", "#0a0828", "#151040", "#2a1658", "#4a1c66", "#7a2468", "#b83a5c", "#f0703c"];

const AURORA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
/** Curtains of light hung all the way round, folding slowly; green into violet into gold. */
const AURORA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float turn = vUv.x * 6.2831853, up = vUv.y;
    float sway = sin(turn * 3.0 + uTime * 0.2 + sin(up * 6.0 + uTime * 0.45) * 1.4);
    float fold = sin(turn * 7.0 - uTime * 0.3 + sin(up * 10.0 - uTime * 0.6) * 0.9);
    float veil = smoothstep(0.1, 1.0, sway) * 0.85 + smoothstep(0.35, 1.0, fold) * 0.55;
    // Rays: the curtain is made of threads.
    veil *= 0.7 + 0.3 * sin(turn * 90.0 + sin(up * 3.0) * 4.0);
    veil *= smoothstep(0.0, 0.25, up) * smoothstep(1.0, 0.35, up);
    vec3 light = mix(vec3(0.15, 1.0, 0.7), vec3(0.95, 0.3, 0.95), 0.5 + 0.5 * sin(turn * 2.0 + up * 4.0 + uTime * 0.25));
    light = mix(light, vec3(1.0, 0.85, 0.4), 0.35 + 0.35 * sin(turn * 5.0 - uTime * 0.37));
    gl_FragColor = vec4(light * veil, veil);
  }`;

function bands(kit: FilmKit, colors: readonly string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = colors.length * 4;
  const ink = canvas.getContext("2d")!;
  // The top takes half the height: the colour is all down by the horizon.
  colors.forEach((color, band) => {
    ink.fillStyle = color;
    const top = band ? canvas.height / 2 + ((band - 1) * canvas.height) / 2 / (colors.length - 1) : 0;
    ink.fillRect(0, Math.floor(top), 2, canvas.height);
  });
  const texture = kit.keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return texture;
}

/**
 * The goodbye before the choice, on a set of its own: the last piece of the village, a square of
 * paving round the well with the gate still standing on it, afloat in the night the shutdown has
 * made of the sky. Stars, curtains of light, the system's message written over the gate; other
 * pieces with a house each drift off and come apart, and the paving goes stone by stone from the
 * outside in. The two of them sit on the rim of the well. The film runs until it is disposed;
 * `cut` chooses the picture.
 */
export function playFarewell(canvas: HTMLCanvasElement): Farewell {
  let shot: FarewellShot = "faces",
    now = 0,
    since = 0,
    /** When the island was first looked at from outside, and when he let the bandage go. */
    crumbling = -1,
    released = -1,
    reading: 97 | 98 = 97;
  const film = playFilm(canvas, 3600, (kit) => {
    const { scene, camera } = kit;
    camera.far = 320;
    camera.updateProjectionMatrix();
    scene.add(new THREE.AmbientLight("#8f86d8", 1.25));
    const key = new THREE.DirectionalLight("#9ff0e0", 1.5);
    key.position.set(-4, 9, 8);
    const rim = new THREE.DirectionalLight("#ff7ad0", 0.9);
    rim.position.set(6, 5, -8);
    scene.add(key, rim);
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, child: T) => (parent.add(child), child);
    const place = new THREE.Vector3();

    // The sky: a night that is red at the bottom, stars, and the light hung round it.
    const dome = new THREE.Mesh(
      kit.keep(new THREE.CylinderGeometry(260, 260, 420, 24, 1, true)),
      kit.keep(new THREE.MeshBasicMaterial({ map: bands(kit, SKY), side: THREE.BackSide, fog: false })),
    );
    dome.position.y = 30;
    scene.add(dome);
    const aurora = kit.keep(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: AURORA_VERTEX,
        fragmentShader: AURORA_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const curtain = new THREE.Mesh(kit.keep(new THREE.CylinderGeometry(170, 230, 190, 48, 1, true)), aurora);
    curtain.position.y = 96;
    scene.add(curtain);
    const stars = kit.swarm(120, "#fff6d8", 0.9);
    const sparkle = Array.from({ length: 120 }, (_, i) => {
      const turn = pick(i, 1) * Math.PI * 2,
        lift = 0.12 + pick(i, 2) * 1.1;
      return new THREE.Vector3(
        Math.cos(turn) * 240 * Math.cos(lift),
        240 * Math.sin(lift),
        Math.sin(turn) * 240 * Math.cos(lift),
      );
    });

    // What the system wrote, hung over the gate, with the number it has reached.
    const notice = kit.label("正在关机。请勿关闭电源。", 3, "#f4fbff");
    // Turned to face the well, so its left is to the east.
    notice.position.set(4, 27, 60);
    const figures = ([97, 98] as const).map((value) => {
      const label = kit.label(`${value}%`, 3, "#7df0ff");
      label.position.set(-16.5, 27, 60);
      return label;
    });
    for (const label of [notice, ...figures]) {
      label.rotation.y = Math.PI;
      // Behind everything on the island: it is a long way off.
      (label.material as THREE.MeshBasicMaterial).depthTest = true;
      label.renderOrder = 0;
    }

    // The paving, stone by stone, so that it can leave stone by stone.
    const side = REACH * 2 + 1;
    const stones = [kit.swarm(side * side, "#8a86a8", STONE), kit.swarm(side * side, "#757196", STONE)];
    const grit = kit.swarm(260, "#c9f7ff", 0.11);

    // The well: four sides of a rim, dark water, a post and a bucket.
    const rimColor = "#a8a4c0";
    kit.box([2.6, RIM, 0.45], [0, RIM / 2, SEAT + 0.02], rimColor);
    kit.box([2.6, RIM, 0.45], [0, RIM / 2, -SEAT - 0.02], rimColor);
    kit.box([0.45, RIM, 1.7], [-1.075, RIM / 2, 0], rimColor);
    kit.box([0.45, RIM, 1.7], [1.075, RIM / 2, 0], rimColor);
    kit.box([1.7, 0.1, 1.7], [0, RIM - 0.25, 0], "#2a6a8a", true);
    kit.box([0.16, 2.4, 0.16], [-1.08, RIM + 1.2, -0.9], "#6a4a3a");
    kit.box([0.9, 0.12, 0.12], [-0.7, RIM + 2.3, -0.9], "#6a4a3a");
    kit.box([0.03, 0.9, 0.03], [-0.32, RIM + 1.85, -0.9], "#d8d0c0", true);
    kit.box([0.3, 0.32, 0.3], [-0.32, RIM + 1.3, -0.9], "#7a5a42");
    // The gate they came to this village through, south of the well; and lanterns either side.
    for (const x of [-2.2, 2.2]) kit.box([0.4, 4.6, 0.4], [x, 2.3, 6.2], "#c8382e");
    kit.box([6.4, 0.4, 0.55], [0, 4.7, 6.2], "#c8382e");
    kit.box([5.4, 0.28, 0.4], [0, 3.8, 6.2], "#a82c26");
    kit.box([7, 0.22, 0.75], [0, 5.02, 6.2], "#2a1c30");
    const lamps = [
      [-3.4, 3],
      [3.4, 3],
      [-3.4, -3],
      [3.4, -3],
    ].map(([x, z]) => {
      kit.box([0.16, 1.9, 0.16], [x, 0.95, z], "#3a3048");
      kit.box([0.5, 0.1, 0.5], [x, 2.35, z], "#3a3048");
      const light = add(scene, new THREE.PointLight("#ffc880", 7, 9));
      light.position.set(x, 2, z);
      return { light, glass: kit.box([0.36, 0.42, 0.36], [x, 2.1, z], "#ffd27a", true) };
    });

    // Other pieces of the village, each with a house on it, drifting off and coming apart.
    const roof = kit.keep(new THREE.CylinderGeometry(0.02, 1, 1, 4, 1));
    roof.rotateY(Math.PI / 4);
    const tiles = kit.keep(
      new THREE.MeshStandardMaterial({ color: "#4a2c58", roughness: 1, flatShading: true }),
    );
    const pieces = Array.from({ length: 11 }, (_, i) => {
      const piece = add(scene, new THREE.Group());
      const wide = 3.4 + pick(i, 3) * 2.6,
        tall = 2.4 + pick(i, 4) * 1.8;
      add(piece, kit.box([wide + 2.4, 1.1, wide + 2.4], [0, -0.55, 0], "#6a6488"));
      add(piece, kit.box([wide + 1.2, 0.9, wide + 1.2], [0, -1.5, 0], "#4a4466"));
      add(piece, kit.box([wide, tall, wide * 0.8], [0, tall / 2, 0], i % 2 ? "#7a6890" : "#86709a"));
      const top = add(piece, new THREE.Mesh(roof, tiles));
      top.scale.set(wide * 0.84, tall * 0.7, wide * 0.7);
      top.position.y = tall * 1.35;
      add(piece, kit.box([0.7, 0.8, 0.1], [0, tall * 0.5, wide * 0.4 + 0.03], "#ffd27a", true));
      const turn = (i / 11) * Math.PI * 2 + pick(i, 5) * 0.4;
      return { piece, turn, far: 24 + pick(i, 6) * 30, low: -6 + pick(i, 7) * 14, seed: i };
    });
    const dust = kit.swarm(pieces.length * 10, "#c9f7ff", 0.3);

    // The two of them on the south rim, facing the gate: he on the left of the picture from in front.
    const zero = kit.figure(STORY_SKINS["story-zero"]),
      lulu = kit.figure(STORY_SKINS["story-lulu"]);
    const seat = (who: typeof zero, x: number) => {
      // Hips on the rim: the figure's origin is a quarter of a unit above them.
      who.group.position.set(x, RIM + 0.25, SEAT + 0.1);
      who.rig.skin.leftLeg.rotation.x = who.rig.skin.rightLeg.rotation.x = -Math.PI / 2;
    };
    seat(zero, -0.48);
    seat(lulu, 0.48);
    // The bandage, once it is off his arm: two strips, one trailing the other.
    const ribbon = add(scene, new THREE.Group());
    add(ribbon, kit.box([0.34, 0.07, 0.02], [0, 0, 0], "#f6f1e4", true));
    const tail = add(ribbon, kit.box([0.34, 0.07, 0.02], [0.32, 0, 0], "#f6f1e4", true));
    ribbon.visible = false;
    const hand = new THREE.Vector3(-0.86, RIM + 1.3, SEAT + 0.75);

    const eye = new THREE.Vector3(),
      aim = new THREE.Vector3();
    return (time) => {
      now = time;
      const t = time - since,
        k = ramp(0, MOVE[shot], t);
      aurora.uniforms.uTime.value = time;
      sparkle.forEach((star, i) =>
        stars.place(i, star, pick(i + Math.floor(time * 2 + pick(i, 8) * 9), 9) < 0.85 ? 1 : 0.3),
      );
      figures.forEach((label, i) => (label.visible = (i ? 98 : 97) === reading));
      lamps.forEach(({ light, glass }, i) => {
        const flicker = 0.85 + 0.15 * Math.sin(time * 7 + i * 2.1);
        light.intensity = 7 * flicker;
        glass.scale.setScalar(0.94 + 0.06 * flicker);
      });

      // How much of the paving holds: a little less all the time, and faster once it is being watched.
      const worn = time * 0.012 + (crumbling < 0 ? 0 : (time - crumbling) * 0.035);
      const hold = Math.max(HOLD.last, HOLD.first - worn);
      for (let row = 0; row < side; row++)
        for (let column = 0; column < side; column++) {
          const i = row * side + column,
            x = column - REACH,
            z = row - REACH;
          // Round rather than square, and ragged: each stone has its own moment.
          const out = Math.hypot(x, z) + (pick(i, 10) - 0.5) * 1.6 - hold;
          const gone = Math.min(1, Math.max(0, out) * 0.55);
          place.set(x * STONE, -STONE / 2 + gone * gone * 16, z * STONE);
          const size = out > 0 ? (1 - gone) * 0.9 : 1;
          stones[(row + column) % 2].place(i, place, size);
          stones[(row + column + 1) % 2].place(i, place, 0);
        }
      for (let i = 0; i < 260; i++) {
        const turn = pick(i, 11) * Math.PI * 2,
          far = (hold - 0.5 + pick(i, 12) * 4.5) * STONE,
          up = (time * (0.04 + pick(i, 13) * 0.07) + pick(i, 14)) % 1;
        place.set(Math.cos(turn) * far, up * 15, Math.sin(turn) * far);
        grit.place(i, place, (1 - up) * 1.3);
      }
      pieces.forEach(({ piece, turn, far, low, seed }, p) => {
        const drift = time * 0.06,
          left = Math.max(0, 1 - Math.max(0, time - 20 - seed * 9) / 50);
        piece.position.set(
          Math.cos(turn) * (far + drift * 6),
          low + drift * 3 + Math.sin(time * 0.3 + seed) * 0.4,
          Math.sin(turn) * (far + drift * 6),
        );
        piece.rotation.set(
          Math.sin(time * 0.11 + seed) * 0.12,
          turn + time * 0.02,
          Math.cos(time * 0.09 + seed) * 0.1,
        );
        piece.scale.setScalar(left);
        for (let i = 0; i < 10; i++) {
          const up = (time * 0.12 + i / 10 + pick(seed, 15)) % 1;
          place.set(
            piece.position.x + (pick(p * 10 + i, 16) - 0.5) * 6,
            piece.position.y + up * 9,
            piece.position.z + (pick(p * 10 + i, 17) - 0.5) * 6,
          );
          dust.place(p * 10 + i, place, left < 1 && left > 0 ? 1 - up : 0);
        }
      });

      // She swings her feet; he does not. Each looks at the other now and then, never at once.
      const swing = Math.sin(time * 1.6) * 0.22;
      lulu.rig.skin.leftLeg.rotation.x = -Math.PI / 2 + swing;
      lulu.rig.skin.rightLeg.rotation.x = -Math.PI / 2 - swing;
      const hers = Math.max(0, Math.sin(time * 0.23 + 1)) ** 3,
        his = Math.max(0, Math.sin(time * 0.23 + 4.1)) ** 3,
        skyward = shot === "sky" ? 0.35 : 0.12;
      lulu.rig.skin.head.rotation.set(-skyward * (1 - hers), 0.75 * hers, 0);
      zero.rig.skin.head.rotation.set(-skyward * (1 - his) - (shot === "ribbon" ? 0.4 : 0), -0.75 * his, 0);
      lulu.group.position.y = RIM + 0.25 + Math.sin(time * 1.3) * 0.012;
      zero.group.position.y = RIM + 0.25 + Math.sin(time * 1.1 + 2) * 0.012;

      // He holds the arm out, and what was on it goes up on the wind.
      const since0 = released < 0 ? -1 : time - released;
      zero.rig.skin.rightArm.rotation.x = -1.45 * (ramp(0, 1.4, since0) - ramp(5, 8, since0));
      zero.rig.skin.rightArm.rotation.z = -0.15 * ramp(0, 1.4, since0);
      ribbon.visible = since0 > 1.6;
      const flight = Math.max(0, since0 - 1.6);
      ribbon.position.set(
        hand.x + Math.sin(flight * 1.2) * 0.5 + flight * 0.12,
        hand.y + 0.22 * flight ** 1.45,
        hand.z + flight * 0.35 + Math.sin(flight * 0.8) * 0.3,
      );
      ribbon.rotation.set(Math.sin(flight * 2.3) * 0.8, flight * 1.1, Math.sin(flight * 1.7) * 0.6);
      tail.rotation.z = Math.sin(flight * 4.1) * 0.7;

      if (shot === "faces") {
        // From the gate's side, a little to one side of them, closing in.
        eye.set(0.9, 2.0, 5.9 - 1.1 * k);
        aim.set(0, 1.85, SEAT);
      } else if (shot === "sky") {
        // Across the well at their backs: two heads, the gate, the writing, and the rest is sky.
        eye.set(1.5 - 0.5 * k, 2.2, -4.9 + 0.8 * k);
        aim.set(0, 5.2 + 2.6 * k, 14);
      } else if (shot === "island") {
        // From outside and above, going slowly round: how little there is left to sit on.
        const round = 0.7 + 0.55 * k;
        eye.set(Math.sin(round) * (27 - 4 * k), 13 + 4 * k, Math.cos(round) * (27 - 4 * k));
        aim.set(0, 1.2, 0);
      } else {
        // Close on his side, turning up after the strip of cloth.
        eye.set(-2.9, 1.9, 3.6);
        aim.set(hand.x, hand.y, hand.z).lerp(ribbon.position, ramp(1.6, 4, since0));
      }
      camera.position.copy(eye);
      camera.lookAt(aim);
    };
  });
  return Object.assign(film, {
    cut(next: FarewellShot) {
      shot = next;
      since = now;
      if (next === "island" && crumbling < 0) crumbling = now;
      if (next === "ribbon" && released < 0) released = now;
    },
    percent(value: 97 | 98) {
      reading = value;
    },
  });
}
