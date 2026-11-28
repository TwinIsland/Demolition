import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pick, playFilm, ramp, type Cutscene, type FilmKit } from "./kit";

/** The ones in front wear what players of the game wear: they were players of the game. */
const SKINS = [
  new URL("../../modules/skins/medic/skin.png", import.meta.url).href,
  new URL("../../modules/skins/sapper/skin.png", import.meta.url).href,
  new URL("../../modules/skins/scout/skin.png", import.meta.url).href,
  new URL("../../modules/skins/assault/skin.png", import.meta.url).href,
  new URL("../../modules/skins/engineer/skin.png", import.meta.url).href,
  new URL("../../modules/skins/sapper/skin.png", import.meta.url).href,
];
/** Where each of the six stands, when their lamp comes on, and what they try. */
const FRONT = [
  { at: [0, 0], lit: 0.2, says: "" },
  { at: [-3.3, -2.3], lit: 4.9, says: "属性面板？" },
  { at: [3.3, -2.3], lit: 5.3, says: "芝麻开门！" },
  { at: [-6.2, -4.8], lit: 5.7, says: "喂？有人吗" },
  { at: [0, -5], lit: 6.1, says: "状态栏……" },
  { at: [6.2, -4.8], lit: 6.5, says: "客服？客服！" },
] as const;
/** The first one tries three times, a little quieter each time. It is what Zero did. */
const TRIES = [
  { from: 0.9, to: 2.05, text: "状态栏，打开！", arm: 1 },
  { from: 2.25, to: 3.25, text: "Status, open!", arm: 0.72 },
  { from: 3.45, to: 4.4, text: "ステータス、オープン。", arm: 0.42 },
  { from: 4.6, to: 10.6, text: "……", arm: 0 },
] as const;
/** The one in the middle of the back row, who is still standing when nobody else is. */
const LAST = 4;
const TIMES = { crowd: 7.3, window: 8.3, count: 9.7, fall: 11.3, ask: 12.9, give: 14.8, end: 16.6 };
const CROWD = 640;
const DARK = "#07060f";

const pop = (from: number, to: number, time: number) =>
  ramp(from, from + 0.12, time) *
  (1 + 0.25 * (1 - ramp(from, from + 0.3, time))) *
  (1 - ramp(to, to + 0.1, time));

/** A speech bubble: white, square-cornered, with its words in the story's pixel font. */
function bubble(kit: FilmKit, text: string, height = 0.36) {
  const group = new THREE.Group();
  const words = kit.label(text, height, "#1a1430");
  const wide = (words.geometry as THREE.PlaneGeometry).parameters.width;
  const pane = kit.box([wide + 0.3, height + 0.26, 0.04], [0, 0, 0], "#ffffff", true);
  const tail = kit.box([0.16, 0.16, 0.04], [-wide * 0.2, -height / 2 - 0.18, 0], "#ffffff", true);
  for (const part of [pane, tail]) (part.material as THREE.MeshBasicMaterial).fog = false;
  words.position.z = 0.04;
  group.add(pane, tail, words);
  group.scale.setScalar(0);
  kit.scene.add(group);
  return group;
}

/** One of the crowd: a head, a body, two legs as one block, an arm down and an arm up. */
function someone(kit: FilmKit) {
  const part = (size: [number, number, number], at: [number, number, number]) =>
    new THREE.BoxGeometry(...size).translate(...at);
  const parts = [
    part([0.5, 0.75, 0.26], [0, 0.375, 0]),
    part([0.5, 0.75, 0.26], [0, 1.125, 0]),
    part([0.5, 0.5, 0.5], [0, 1.75, 0]),
    part([0.22, 0.75, 0.22], [-0.37, 1.125, 0]),
    part([0.22, 0.75, 0.22], [0.37, 1.8, 0]),
  ];
  const merged = kit.keep(mergeGeometries(parts));
  for (const piece of parts) piece.dispose();
  return merged;
}

/**
 * "Every one of them called for it." A dark stage and one lamp: somebody strikes the pose and
 * calls for a status window, three times, the way Zero did. Then the other lamps come on, and
 * there is a whole hall of them, all with a hand up, under a window in the sky that says there is
 * no response. They take it the way he would have: face down, all at once. One asks where the
 * quit button is.
 */
export function playStatusQueue(canvas: HTMLCanvasElement): Cutscene {
  return playFilm(canvas, TIMES.end, (kit) => {
    const { scene, camera } = kit;
    scene.background = new THREE.Color(DARK);
    scene.fog = new THREE.Fog(DARK, 26, 92);
    camera.far = 160;
    scene.add(new THREE.AmbientLight("#5a56a0", 1.1));
    const moon = new THREE.DirectionalLight("#6f7ad0", 0.5);
    moon.position.set(-4, 10, 6);
    scene.add(moon);
    kit.box([400, 0.2, 400], [0, -0.1, 0], "#16142a");

    // The six in front, each under a lamp of their own.
    const cone = kit.keep(new THREE.CylinderGeometry(0.2, 2, 7, 12, 1, true));
    const beam = kit.keep(
      new THREE.MeshBasicMaterial({
        color: "#fff2c0",
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    const pool = kit.keep(new THREE.CircleGeometry(2, 12).rotateX(-Math.PI / 2));
    const lit = kit.keep(new THREE.MeshBasicMaterial({ color: "#3b3668" }));
    const front = FRONT.map((spot, i) => {
      const [x, z] = spot.at;
      const figure = kit.figure(SKINS[i]);
      figure.group.position.set(x, 1, z);
      const lamp = new THREE.PointLight("#fff0c8", 0, 9);
      lamp.position.set(x, 5, z + 1.2);
      const shaft = new THREE.Mesh(cone, beam);
      shaft.position.set(x, 3.5, z);
      const floor = new THREE.Mesh(pool, lit);
      floor.position.set(x, 0.02, z);
      scene.add(lamp, shaft, floor);
      const says = spot.says ? bubble(kit, spot.says, 0.58) : undefined;
      says?.position.set(x + 0.4, 3.15, z);
      return { ...figure, x, z, lamp, shaft, floor, says, on: spot.lit };
    });
    const tries = TRIES.map((attempt) => {
      const says = bubble(kit, attempt.text, attempt.text === "……" ? 0.3 : 0.4);
      says.position.set(0.7, 3, 0);
      return says;
    });
    const asks = bubble(kit, "那……退出键呢？", 0.44);
    asks.position.set(front[LAST].x + 0.6, 2.95, front[LAST].z);

    // Everyone else who ever arrived here.
    const crowd = new THREE.InstancedMesh(
      someone(kit),
      kit.keep(new THREE.MeshStandardMaterial({ roughness: 1 })),
      CROWD,
    );
    crowd.frustumCulled = false;
    scene.add(crowd);
    const tint = new THREE.Color();
    const people = Array.from({ length: CROWD }, (_, i) => {
      const row = Math.floor(i / 32),
        column = i % 32,
        wide = 13 + row * 1.5;
      const x = ((column + 0.5) / 32 - 0.5) * 2 * wide + (pick(i, 1) - 0.5) * 1.1,
        z = -9.5 - row * 3.4 - pick(i, 2) * 1.6;
      crowd.setColorAt(i, tint.setHSL(0.62 + pick(i, 3) * 0.16, 0.22, 0.3 + pick(i, 4) * 0.22));
      return { x, z, away: Math.hypot(x, z), turn: (pick(i, 5) - 0.5) * 0.5, seed: pick(i, 6) };
    });
    const pops = kit.swarm(CROWD, "#f4f0ff", 1);
    const matrix = new THREE.Matrix4(),
      spot = new THREE.Vector3(),
      turn = new THREE.Quaternion(),
      euler = new THREE.Euler(0, 0, 0, "YXZ"),
      size = new THREE.Vector3();

    // The window they are all calling for, as big as the back wall and just as helpful.
    const board = new THREE.Group();
    board.position.set(0, 17, -84);
    const panel = (dims: [number, number, number], at: [number, number, number], color: string) => {
      const mesh = kit.box(dims, at, color, true);
      (mesh.material as THREE.MeshBasicMaterial).fog = false;
      board.add(mesh);
      return mesh;
    };
    panel([52, 27, 0.4], [0, 0, 0], "#3d8bff");
    panel([50.4, 25.4, 0.5], [0, 0, 0.1], "#081030");
    panel([50.4, 3.2, 0.6], [0, 11.1, 0.2], "#2f6fe0");
    const words = (text: string, height: number, color: string, at: [number, number]) => {
      const label = kit.label(text, height, color);
      const ink = label.material as THREE.MeshBasicMaterial;
      ink.fog = false;
      // Written on the window, so whatever stands in front of the window covers it.
      ink.depthTest = true;
      label.renderOrder = 0;
      label.position.set(at[0], at[1], 0.8);
      board.add(label);
      return label;
    };
    words("状态栏", 2.1, "#ffffff", [-20, 11.1]);
    words("×", 2.1, "#ffffff", [23.4, 11.1]);
    words("没有反应。", 5.4, "#bcd8ff", [0, 1.6]);
    const count = words("× 3,000,000", 4.4, "#8fb4ff", [0, -5.4]);
    scene.add(board);

    const shade = new THREE.Mesh(
      kit.keep(new THREE.PlaneGeometry(4, 3)),
      kit.keep(
        new THREE.MeshBasicMaterial({ color: "#000", transparent: true, depthTest: false, fog: false }),
      ),
    );
    shade.position.z = -0.5;
    shade.renderOrder = 9;
    camera.add(shade);

    const eye = new THREE.Vector3(),
      aim = new THREE.Vector3();
    const views: [number, THREE.Vector3, THREE.Vector3][] = [
      [0, new THREE.Vector3(0.9, 1.75, 6.4), new THREE.Vector3(0.15, 1.85, 0)],
      [4.5, new THREE.Vector3(0.5, 1.75, 5.5), new THREE.Vector3(0.15, 1.85, 0)],
      [7.2, new THREE.Vector3(0, 3.3, 11.4), new THREE.Vector3(0, 2.1, -2.4)],
      [10.4, new THREE.Vector3(0, 10.5, 22), new THREE.Vector3(0, 4.2, -24)],
      [TIMES.fall + 0.9, new THREE.Vector3(0, 11, 22.6), new THREE.Vector3(0, 4.2, -24)],
      // Down among them, to the one who is still on his feet.
      [TIMES.ask - 0.1, new THREE.Vector3(1.7, 2.1, 0.4), new THREE.Vector3(0.3, 1.95, -5)],
      [TIMES.end, new THREE.Vector3(1.5, 1.9, 0), new THREE.Vector3(0.3, 1.7, -5)],
    ];

    return (time) => {
      (shade.material as THREE.MeshBasicMaterial).opacity =
        1 - ramp(0, 0.7, time) + ramp(TIMES.end - 0.7, TIMES.end - 0.1, time);

      front.forEach((one, i) => {
        const on = time >= one.on,
          // Lamps of that age do not come on at once.
          flicker = on && (time - one.on > 0.3 || Math.floor(time * 30) % 2 === 0) ? 1 : 0,
          down = ramp(0, 0.45, time - (TIMES.fall + Math.hypot(one.x, one.z) * 0.035)),
          { head, leftArm, rightArm } = one.rig.skin;
        one.lamp.intensity = 42 * flicker;
        one.shaft.visible = one.floor.visible = one.group.visible = flicker > 0;
        const up = on ? ramp(0.1, 0.4, time - one.on) : 0,
          tired = ramp(9.4, 10.6, time),
          keen = up * (1 - tired);
        one.group.rotation.set(0, 0, 0);
        head.rotation.set(0.45 * tired, 0, 0);
        leftArm.rotation.set(0, 0, 0);
        rightArm.rotation.set(0, 0, 0);
        if (i === 0) {
          // One hand over the eye, the other thrown at the sky: lower with every try.
          const attempt = [...TRIES].reverse().find((each) => time >= each.from) ?? TRIES[0],
            arm = attempt.arm * ramp(attempt.from, attempt.from + 0.15, time);
          rightArm.rotation.x = -2.9 * arm;
          leftArm.rotation.set(-2.3 * Math.min(1, arm * 2), 0, -0.75 * Math.min(1, arm * 2));
          head.rotation.x = -0.25 * arm + 0.5 * ramp(4.6, 5.2, time);
        } else if (i === 1) {
          // Arms straight out: if it is a matter of standing right, this must be it.
          leftArm.rotation.z = 1.5 * keen;
          rightArm.rotation.z = -1.5 * keen;
        } else if (i === 2) {
          leftArm.rotation.x = rightArm.rotation.x = -3 * keen;
          head.rotation.x += -0.4 * keen;
        } else if (i === 3) {
          // Knocking on the air.
          rightArm.rotation.x = (-1.5 + Math.sin(time * 14) * 0.25) * keen;
        } else if (i === LAST) {
          rightArm.rotation.x = -2.6 * keen - 1.3 * ramp(TIMES.ask, TIMES.ask + 0.4, time);
        } else {
          // Leaning into it, one hand on the hip.
          one.group.rotation.z = -0.3 * keen;
          rightArm.rotation.x = -2.8 * keen;
          leftArm.rotation.z = 0.7 * keen;
        }
        if (i === LAST) {
          // He does not fall with the others. He looks round, asks, and then lies down on his back.
          head.rotation.y =
            0.9 *
            Math.sin((time - TIMES.fall) * 2.2) *
            ramp(TIMES.fall + 0.5, TIMES.fall + 1, time) *
            (1 - ramp(TIMES.ask - 0.3, TIMES.ask, time));
          const back = ramp(TIMES.give, TIMES.give + 0.7, time);
          one.group.rotation.x = -1.5 * back * back;
          one.group.position.y = 1 - 0.72 * back;
        } else {
          // Face first, without putting a hand out.
          one.group.rotation.x = 1.52 * down * down;
          one.group.position.y = 1 - 0.72 * down;
        }
        one.says?.scale.setScalar(on ? pop(one.on + 0.45, i === LAST ? 9.2 : 9.6, time) : 0);
      });
      tries.forEach((says, i) => says.scale.setScalar(pop(TRIES[i].from, TRIES[i].to, time)));
      asks.scale.setScalar(pop(TIMES.ask, TIMES.give - 0.2, time));

      // The hall fills from the front, and empties the same way.
      people.forEach((one, i) => {
        const up = ramp(0, 0.25, time - (TIMES.crowd + one.away * 0.022)),
          down = ramp(0, 0.4, time - (TIMES.fall + one.away * 0.035 + one.seed * 0.12)) ** 2;
        euler.set(1.52 * down, one.turn, 0);
        crowd.setMatrixAt(
          i,
          matrix.compose(spot.set(one.x, 0.14 * down, one.z), turn.setFromEuler(euler), size.set(1, up, 1)),
        );
        // Their bubbles, going off like corn in a pan.
        const loud =
          up * (1 - ramp(10.4, 11, time)) * (pick(i + Math.floor(time * 4 + one.seed * 9), 7) < 0.3 ? 1 : 0);
        pops.place(i, spot.set(one.x + 0.5, 2.7, one.z), 0.55 * loud);
      });
      crowd.instanceMatrix.needsUpdate = true;

      // It comes on like an old monitor, and then it adds the count.
      const since = time - TIMES.window;
      board.visible = since > 0 && (since > 0.5 || Math.floor(time * 24) % 3 !== 0);
      count.visible = time > TIMES.count;

      let leg = views.findIndex(([at]) => at > time);
      if (leg < 1) leg = views.length - 1;
      const [from, eyeA, aimA] = views[leg - 1],
        [to, eyeB, aimB] = views[leg],
        u = ramp(from, to, time);
      camera.position.copy(eye.lerpVectors(eyeA, eyeB, u));
      camera.lookAt(aim.lerpVectors(aimA, aimB, u));
      camera.fov = 40;
      camera.updateProjectionMatrix();
    };
  });
}
