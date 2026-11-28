import * as THREE from "three";
import { STORY_SKINS } from "../assets";
import { pick, playFilm, ramp, type Cutscene, type FilmKit } from "./kit";

/** The three pictures of the evening: beside them on the road, behind them, and at the table. */
export type EveningShot = "road" | "away" | "table";
export interface Evening extends Cutscene {
  /** Changes the picture at once; whoever calls covers the cut. */
  cut(shot: EveningShot): void;
  /** At the table: the two glasses go up and meet. */
  cheers(): void;
}

/** Where the sun goes down, as a direction on the ground: west and a little north. */
const WEST = new THREE.Vector3(-0.89, 0, -0.45).normalize();
/** The top of the dyke road, which is what they walk on. */
const ROAD = 0.4;
/** Units a second: nobody is in a hurry. */
const PACE = 1.05;
/** The table stands in the fields south of the road, a long way down it from the walk. */
const TABLE = new THREE.Vector3(300, 0, 15);
/** Turn of the table's own frame: its far side faces the sun, and they sit across it, left and right. */
const TABLE_TURN = Math.atan2(-WEST.x, -WEST.z);

const HOURS: Record<
  EveningShot,
  {
    sky: readonly string[];
    sun: number;
    ambient: [string, number];
    key: [string, number];
    ground: string;
  }
> = {
  road: {
    sky: ["#2b2466", "#4f2f7a", "#8a3c7c", "#c94e68", "#f27a52", "#ffb054", "#ffe08a"],
    sun: 15,
    ambient: ["#a58cd0", 1.45],
    key: ["#ffa864", 2.3],
    ground: "#5d5148",
  },
  away: {
    sky: ["#1f1b58", "#3d2670", "#72307a", "#b5426e", "#ea6340", "#ff9642", "#ffc96c"],
    sun: 9,
    ambient: ["#9a7cc8", 1.3],
    key: ["#ff8c4c", 2.5],
    ground: "#544640",
  },
  table: {
    sky: ["#0f1238", "#1a1b52", "#2c2468", "#4b2a72", "#8a3868", "#d05a48", "#f59a50"],
    sun: 1.5,
    ambient: ["#7a70bc", 1.2],
    key: ["#ff7848", 1.1],
    ground: "#3a3340",
  },
};

function bands(kit: FilmKit, colors: readonly string[]) {
  // Flat bands, crowding together towards the horizon.
  const rows = colors.map((_, band) => Math.max(2, Math.round(10 / (band + 1))));
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = rows.reduce((sum, count) => sum + count, 0);
  const ink = canvas.getContext("2d")!;
  let top = 0;
  colors.forEach((color, band) => {
    ink.fillStyle = color;
    ink.fillRect(0, top, 2, rows[band]);
    top += rows[band];
  });
  const texture = kit.keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return texture;
}

/**
 * The evening of the day he stayed, on a set of its own: a dyke road through the fields outside
 * the village, a canal that holds the sky, poles and wires, and the sun going down at the end of
 * it. They walk it side by side; then there is a table outside the tavern, a plate between them
 * and a glass each. The film runs until it is disposed; `cut` chooses the picture.
 */
export function playEvening(canvas: HTMLCanvasElement): Evening {
  let shot: EveningShot = "road",
    now = 0,
    since = 0,
    toast = -100;
  const film = playFilm(canvas, 3600, (kit) => {
    const { scene, camera } = kit;
    camera.far = 420;
    const ambient = new THREE.AmbientLight();
    const key = new THREE.DirectionalLight();
    scene.add(ambient, key, key.target);

    // Everything too far away to pass: it goes along with the camera.
    const far = new THREE.Group();
    scene.add(far);
    const skies: Record<EveningShot, THREE.Texture> = {
      road: bands(kit, HOURS.road.sky),
      away: bands(kit, HOURS.away.sky),
      table: bands(kit, HOURS.table.sky),
    };
    const dome = new THREE.Mesh(
      kit.keep(new THREE.CylinderGeometry(200, 200, 150, 24, 1, true)),
      kit.keep(new THREE.MeshBasicMaterial({ map: skies.road, side: THREE.BackSide, fog: false })),
    );
    dome.position.y = 69;
    far.add(dome);
    const sun = new THREE.Group();
    for (const [radius, color, opacity] of [
      [34, "#ff9a5a", 0.14],
      [24, "#ffb86a", 0.3],
      [15, "#fff0b8", 1],
    ] as const) {
      const disc = new THREE.Mesh(
        kit.keep(new THREE.CircleGeometry(radius, 10)),
        kit.keep(
          new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false }),
        ),
      );
      disc.position.z = radius * 0.01;
      sun.add(disc);
    }
    far.add(sun);
    const add = (parent: THREE.Object3D, ...meshes: THREE.Object3D[]) => (parent.add(...meshes), meshes[0]);
    // Hills on the horizon, darkest where the sun sits behind them.
    for (let i = 0; i < 30; i++) {
      const turn = -0.4 + (i / 30) * 3.4 + pick(i, 1) * 0.08,
        tall = 7 + pick(i, 2) * 17,
        wide = 34 + pick(i, 3) * 30;
      const hill = add(
        far,
        kit.box([wide, tall, 6], [0, tall / 2 - 1, 0], i % 2 ? "#4a2f5e" : "#553466", true),
      );
      hill.position.set(Math.cos(turn) * -172, tall / 2 - 1, Math.sin(turn) * -172);
      hill.lookAt(0, hill.position.y, 0);
    }
    const clouds = Array.from({ length: 12 }, (_, i) => {
      const turn = 0.5 + (pick(i, 4) - 0.5) * 2.2;
      const cloud = add(
        far,
        kit.box(
          [22 + pick(i, 5) * 40, 1.2 + pick(i, 6) * 1.6, 0.3],
          [0, 0, 0],
          i % 3 ? "#ff8f7a" : "#ffc38a",
          true,
        ),
      );
      cloud.position.set(Math.cos(turn) * -186, 18 + pick(i, 7) * 52, Math.sin(turn) * -186);
      cloud.lookAt(0, cloud.position.y, 0);
      const material = (cloud as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.transparent = true;
      material.opacity = 0.75;
      return material;
    });
    const stars = kit.swarm(60, "#fff6d8", 0.5);
    const birds = kit.swarm(5, "#1d1430", 0.22);

    // The land: fields in furrows, the road on its dyke, the canal beside it.
    const ground = kit.box([1400, 1, 900], [100, -0.5, 0], "#5d5148").material as THREE.MeshStandardMaterial;
    for (let row = 0; row < 26; row++)
      kit.box([1400, 0.2, 0.7], [100, 0.1, 5 + row * 1.9], row % 2 ? "#8c7a3c" : "#766632");
    kit.box([1400, ROAD, 3.6], [100, ROAD / 2, 0], "#b08062");
    kit.box([1400, 0.12, 0.5], [100, ROAD + 0.02, -1.5], "#8a9a5a");
    kit.box([1400, 0.12, 0.5], [100, ROAD + 0.02, 1.5], "#8a9a5a");
    const water = kit.box([1400, 0.06, 6], [100, 0.04, -9.5], "#ff9e6a", true)
      .material as THREE.MeshBasicMaterial;
    const glints = kit.swarm(70, "#fff2c8", 0.3);
    const tufts = kit.swarm(420, "#b08a48", 0.16);
    const place = new THREE.Vector3();
    for (let i = 0; i < 420; i++) {
      const side = i % 2 ? 1 : -1;
      place.set(-170 + pick(i, 8) * 520, 0.2 + pick(i, 9) * 0.35, side * (2.1 + pick(i, 10) * 1.6));
      tufts.place(i, place, 0.6 + pick(i, 11));
    }
    // Poles and wires along the north side: every summer evening has them.
    for (let x = -180; x <= 360; x += 17) {
      kit.box([0.26, 7.4, 0.26], [x, 3.7, -5.2], "#1a1226", true);
      kit.box([0.14, 0.14, 2], [x, 6.7, -5.2], "#1a1226", true);
    }
    for (const z of [-6, -5.2, -4.4]) kit.box([1400, 0.045, 0.045], [100, 6.6, z], "#1a1226", true);

    // The village, across the canal: roofs, lit windows, smoke, and the windmill.
    const smoke: { x: number; y: number; z: number; seed: number }[] = [];
    const roof = kit.keep(new THREE.CylinderGeometry(0.02, 1, 1, 4, 1));
    roof.rotateY(Math.PI / 4);
    const tiles = kit.keep(
      new THREE.MeshStandardMaterial({ color: "#4a2c48", roughness: 1, flatShading: true }),
    );
    const house = (x: number, z: number, wide: number, tall: number, deep: number, seed: number) => {
      kit.box([wide, tall, deep], [x, tall / 2, z], seed % 2 ? "#7a5868" : "#86606a");
      const top = new THREE.Mesh(roof, tiles);
      top.scale.set(wide * 0.82, tall * 0.7, deep * 0.82);
      top.position.set(x, tall + tall * 0.35, z);
      scene.add(top);
      for (let i = 0; i < 3; i++)
        if (pick(seed * 5 + i, 12) < 0.7)
          kit.box(
            [0.7, 0.8, 0.1],
            [x - wide * 0.3 + i * wide * 0.3, tall * 0.5, z + deep / 2 + 0.03],
            pick(seed + i, 13) < 0.5 ? "#ffd27a" : "#ffb85c",
            true,
          );
      if (seed % 3 === 0) {
        kit.box([0.5, 1.2, 0.5], [x + wide * 0.22, tall * 1.5, z], "#5a3c4c");
        smoke.push({ x: x + wide * 0.22, y: tall * 1.5 + 0.7, z, seed });
      }
    };
    for (let i = 0; i < 46; i++)
      house(
        -175 + i * 12.4 + pick(i, 14) * 6,
        -17 - pick(i, 15) * 26,
        4 + pick(i, 16) * 3,
        2.6 + pick(i, 17) * 2,
        4 + pick(i, 18) * 2,
        i,
      );
    const puffs = kit.swarm(60, "#b88aa0", 0.5);
    const mills = [-52, 268].map((x) => {
      kit.box([2.6, 9, 2.6], [x, 4.5, -30], "#6a4a5e");
      const cap = new THREE.Mesh(roof, tiles);
      cap.scale.set(2.6, 2.4, 2.6);
      cap.position.set(x, 10.2, -30);
      scene.add(cap);
      const sails = new THREE.Group();
      sails.position.set(x, 8.6, -28.4);
      for (let blade = 0; blade < 4; blade++) {
        const arm = kit.box([0.9, 6.4, 0.1], [0, 3.2, 0], "#2a1c36", true);
        const hub = new THREE.Group();
        hub.rotation.z = (blade * Math.PI) / 2;
        hub.add(arm);
        sails.add(hub);
      }
      scene.add(sails);
      return sails;
    });
    for (let i = 0; i < 40; i++) {
      const x = -170 + pick(i, 19) * 520,
        z = -13 - pick(i, 20) * 6,
        tall = 1.6 + pick(i, 21) * 1.6;
      kit.box([0.3, tall, 0.3], [x, tall / 2, z], "#2c2030", true);
      kit.box([tall * 1.1, tall * 1.1, tall * 1.1], [x, tall + tall * 0.3, z], i % 2 ? "#3c4a44" : "#34403e");
    }

    // The two of them, and the long shadows the low sun gives them.
    const walkers = [
      { ...kit.figure(STORY_SKINS["story-zero"]), side: 0.5, swing: 0.16, beat: 0 },
      { ...kit.figure(STORY_SKINS["story-lulu"]), side: -0.5, swing: 0.62, beat: 2.7 },
    ];
    const shadows = walkers.map(() => {
      const shadow = kit.box([6.4, 0.02, 0.62], [0, 0, 0], "#2a1630", true);
      const material = shadow.material as THREE.MeshBasicMaterial;
      material.transparent = true;
      material.opacity = 0.42;
      shadow.rotation.y = Math.atan2(WEST.z, -WEST.x);
      return shadow;
    });

    // The table outside the tavern, in its own frame: +x is her side, -z is the sun.
    const set = new THREE.Group();
    set.position.copy(TABLE);
    set.rotation.y = TABLE_TURN;
    scene.add(set);
    const put = (size: [number, number, number], at: [number, number, number], color: string, glow = false) =>
      add(set, kit.box(size, at, color, glow)) as THREE.Mesh;
    put([11, 0.5, 9], [0, 0.05, 0.5], "#6e4a3c");
    put([1.6, 0.12, 1.15], [0, 1.36, 0], "#9a6a48");
    for (const x of [-0.65, 0.65])
      for (const z of [-0.45, 0.45]) put([0.12, 1, 0.12], [x, 0.8, z], "#6a452e");
    for (const x of [-1.2, 1.2]) {
      put([0.6, 0.1, 1.2], [x, 0.93, 0], "#8a5c3e");
      for (const z of [-0.5, 0.5]) put([0.1, 0.6, 0.1], [x, 0.6, z], "#6a452e");
    }
    // Supper: the braised pork, two bowls of rice, chopsticks.
    put([0.6, 0.05, 0.5], [0, 1.45, -0.08], "#f2ece0");
    for (let i = 0; i < 7; i++)
      put(
        [0.17, 0.14, 0.17],
        [-0.2 + (i % 4) * 0.13, 1.54 + (i > 3 ? 0.12 : 0), -0.18 + (i % 2) * 0.18],
        i % 3 ? "#8a3520" : "#a8482a",
      );
    for (const x of [-0.56, 0.56]) {
      put([0.26, 0.16, 0.26], [x, 1.5, -0.3], "#e8e2d8");
      put([0.2, 0.06, 0.2], [x, 1.6, -0.3], "#ffffff");
      put([0.03, 0.02, 0.4], [x, 1.44, 0.02], "#3a2418");
      put([0.03, 0.02, 0.4], [x + 0.06, 1.44, 0.02], "#3a2418");
    }
    const steam = kit.swarm(10, "#f4e6e0", 0.09);
    // His glass of juice with a straw, her mug with a head on it.
    const juice = new THREE.Group();
    juice.add(
      kit.box([0.18, 0.28, 0.18], [0, 0.14, 0], "#ff9a3a", true),
      kit.box([0.03, 0.26, 0.03], [0.04, 0.36, 0], "#f2f2f2", true),
    );
    const mug = new THREE.Group();
    mug.add(
      kit.box([0.24, 0.3, 0.24], [0, 0.15, 0], "#e8a83a", true),
      kit.box([0.26, 0.09, 0.26], [0, 0.34, 0], "#fff8e8", true),
      kit.box([0.06, 0.18, 0.06], [0.16, 0.15, 0], "#c98a2a", true),
    );
    set.add(juice, mug);
    const sparks = kit.swarm(8, "#fff4c0", 0.07);
    // The tavern's corner, its curtain and its window, on her side of the picture.
    put([0.5, 4.6, 6.4], [5, 2.3, 0.4], "#5c3a42");
    put([1.6, 0.16, 6.8], [4.5, 4.4, 0.4], "#4a2c48");
    put([0.1, 1.5, 1.5], [4.72, 2.4, 1.6], "#ffcf7a", true);
    put([0.12, 0.08, 1.7], [4.7, 3.2, 1.6], "#3a2430");
    for (let strip = 0; strip < 4; strip++)
      put([0.06, 1.1, 0.42], [4.7, 3.3, -1.5 + strip * 0.46], strip % 2 ? "#e8e0d4" : "#5a4a94");
    put([0.14, 3.9, 0.14], [-4.4, 1.95, -1.4], "#3a2430");
    put([0.14, 3.9, 0.14], [4.3, 1.95, -1.4], "#3a2430");
    put([8.8, 0.04, 0.04], [0, 3.86, -1.4], "#2a1c26", true);
    const lanterns = Array.from({ length: 7 }, (_, i) => {
      const hang = new THREE.Group();
      hang.position.set(-3.6 + i * 1.2, 3.84, -1.4);
      hang.add(
        kit.box([0.03, 0.2, 0.03], [0, -0.1, 0], "#2a1c26", true),
        kit.box([0.34, 0.44, 0.34], [0, -0.42, 0], i % 2 ? "#ffcf7a" : "#ff9a5c", true),
        kit.box([0.38, 0.05, 0.38], [0, -0.19, 0], "#5a2c30", true),
      );
      set.add(hang);
      return hang;
    });
    const glow = new THREE.PointLight("#ffb468", 0, 14);
    glow.position.set(0, 2.9, 1.6);
    set.add(glow);

    const eye = new THREE.Vector3(),
      aim = new THREE.Vector3(),
      rest = new THREE.Vector3();
    /** Poses one of them walking at `x`, `side` of the middle of the road. */
    const stride = (walker: (typeof walkers)[number], x: number, lean: number) => {
      const { group, rig, swing, beat, side } = walker,
        step = now * 5 + beat,
        { head, leftArm, rightArm, leftLeg, rightLeg } = rig.skin;
      group.position.set(x, ROAD + 1 + Math.abs(Math.sin(step)) * 0.05, side * (1 - lean * 0.45));
      group.rotation.order = "YXZ";
      group.rotation.set(0, -Math.PI / 2, 0);
      leftLeg.rotation.x = Math.sin(step) * 0.55;
      rightLeg.rotation.x = -Math.sin(step) * 0.55;
      leftArm.rotation.x = -Math.sin(step) * swing;
      rightArm.rotation.x = Math.sin(step) * swing;
      leftArm.rotation.z = rightArm.rotation.z = 0;
      head.rotation.set(0, 0, 0);
    };

    return (time) => {
      now = time;
      const local = time - since,
        hour = HOURS[shot];
      (dome.material as THREE.MeshBasicMaterial).map = skies[shot];
      ambient.color.set(hour.ambient[0]);
      ambient.intensity = hour.ambient[1];
      key.color.set(hour.key[0]);
      key.intensity = hour.key[1];
      ground.color.set(hour.ground);
      water.color.set(hour.sky[hour.sky.length - 2]);
      glow.intensity = shot === "table" ? 55 : 0;
      clouds.forEach((cloud, i) =>
        cloud.color.set(shot === "table" ? "#b0506a" : i % 3 ? "#ff8f7a" : "#ffc38a"),
      );

      // The walk goes on under every picture of it, so a cut never puts them back.
      const x = 24 - time * PACE,
        close = shot === "away" ? ramp(4, 12, local) : 0;
      walkers.forEach((walker, i) => {
        stride(walker, x, close);
        shadows[i].position.set(
          walker.group.position.x - WEST.x * 3.5,
          ROAD + 0.02,
          walker.group.position.z - WEST.z * 3.5,
        );
        walker.group.visible = shadows[i].visible = shot !== "table";
      });
      const [zero, lulu] = walkers;
      // She looks at him now and then; he looks at the sky.
      lulu.rig.skin.head.rotation.y = -0.6 * ramp(0.55, 0.75, Math.sin(time * 0.7));
      zero.rig.skin.head.rotation.x = -0.22 * ramp(0.2, 0.6, Math.sin(time * 0.45 + 1));

      if (shot === "road") {
        // Beside them and a little ahead, low, so they are two shapes against the sky.
        const settle = ramp(0, 7, local);
        eye.set(x + 9 - 4.8 * settle - local * 0.03, 4.6 - 3.2 * settle, 14 - 7.4 * settle);
        aim.set(x - 2.2, 1.85, 0);
        camera.fov = 42;
      } else if (shot === "away") {
        // Behind them on the road as they go towards it, and slowly up.
        const rise = 1 - Math.exp(-local / 14);
        eye.set(x + 6.6 + 3.5 * rise, 1.15 + 3.2 * rise, 2.3);
        aim.set(x - 14, 2.7 + 0.6 * rise, -4.6);
        camera.fov = 40;
      } else {
        const push = 1 - Math.exp(-local / 9);
        eye
          .set(0.4 - 0.4 * push, 2.25 - 0.2 * push, 6.6 - 2.2 * push)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, TABLE_TURN)
          .add(TABLE);
        aim.set(0, 1.95, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, TABLE_TURN).add(TABLE);
        camera.fov = 38;
      }
      camera.position.copy(eye);
      camera.lookAt(aim);
      camera.updateProjectionMatrix();

      // The far things keep their distance from the camera; the sun keeps its place in the west.
      far.position.set(eye.x, 0, eye.z);
      sun.position.copy(WEST).multiplyScalar(180).setY(hour.sun);
      sun.lookAt(eye.x, hour.sun, eye.z);
      key.position.copy(eye).addScaledVector(WEST, 60).setY(14);
      key.target.position.copy(eye);
      for (let i = 0; i < 60; i++) {
        const turn = pick(i, 22) * Math.PI * 2;
        place.set(eye.x + Math.cos(turn) * 190, 46 + pick(i, 23) * 80, eye.z + Math.sin(turn) * 190);
        stars.place(i, place, shot === "table" ? 0.6 + 0.8 * pick(i + Math.floor(time * 3), 24) : 0);
      }
      for (let i = 0; i < 5; i++) {
        const along = ((time * 4 + i * 1.1) % 90) - 45;
        place.set(
          eye.x - 30 + along * WEST.z * -1,
          15 + i * 0.5 + Math.sin(time * 8 + i) * 0.2,
          eye.z - 40 + along * WEST.x,
        );
        birds.place(i, place, 1);
      }
      for (let i = 0; i < 70; i++) {
        place.set(eye.x - 60 + pick(i, 25) * 120, 0.09, -7 - pick(i, 26) * 5);
        glints.place(i, place, pick(i + Math.floor(time * 5), 27) < 0.35 ? 1 : 0);
      }
      smoke.forEach((chimney, c) => {
        for (let i = 0; i < 4 && c * 4 + i < 60; i++) {
          const up = (time * 0.35 + i / 4 + pick(chimney.seed, 28)) % 1;
          place.set(chimney.x + up * 1.6, chimney.y + up * 4, chimney.z);
          puffs.place(c * 4 + i, place, (0.5 + up) * (1 - up));
        }
      });
      for (const sails of mills) sails.rotation.z = time * 0.45;
      lanterns.forEach((hang, i) => (hang.rotation.z = Math.sin(time * 1.3 + i * 0.9) * 0.07));

      // At the table. He sits on the left facing her; the hands nearer the camera hold the drinks.
      if (shot !== "table") return;
      const since0 = time - toast,
        reach = ramp(0, 0.9, since0) - ramp(5.2, 6.2, since0),
        meet = ramp(0.9, 1.6, since0) - ramp(2.3, 2.9, since0),
        sip = ramp(2.9, 3.5, since0) - ramp(4.6, 5.2, since0),
        bite = Math.max(0, Math.sin(time * 0.9)) ** 6 * (1 - reach);
      [zero, lulu].forEach(({ group, rig }, i) => {
        const turn = i ? -1 : 1,
          { head, leftArm, rightArm, leftLeg, rightLeg } = rig.skin,
          holding = i ? leftArm : rightArm,
          eating = i ? rightArm : leftArm;
        group.visible = true;
        // Hips on the bench: the figure's origin is a quarter of a unit above them.
        group.position.set(-1.2 * turn, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, TABLE_TURN);
        group.position.add(TABLE).setY(1.23 + 0.02 * Math.sin(time * 1.7 + i));
        // Leaning in over the table for the toast.
        group.rotation.order = "YXZ";
        group.rotation.set(0.3 * meet, TABLE_TURN + (turn * Math.PI) / 2, 0);
        leftLeg.rotation.x = rightLeg.rotation.x = -Math.PI / 2;
        holding.rotation.x = -0.75 * reach - 1.05 * meet - 1.5 * sip;
        holding.rotation.z = 0;
        // The other hand goes to the plate, his more often than hers.
        eating.rotation.x = -1.15 * (i ? Math.max(0, Math.sin(time * 0.9 + 2.2)) ** 6 * (1 - reach) : bite);
        head.rotation.set(-0.3 * sip + 0.12 * (i ? 0 : bite), 0, 0.06 * Math.sin(time * 1.1 + i * 2));
      });
      const hand = (side: number) =>
        rest
          .set(side * 0.45, 1.42, 0.38)
          .lerp(aim.set(side * 0.12, 2.02, 0.38), meet)
          .lerp(aim.set(side * 0.92, 2.02, 0.34), sip);
      juice.position.copy(hand(-1));
      mug.position.copy(hand(1));
      mug.rotation.z = 0.5 * sip;
      juice.rotation.z = -0.5 * sip;
      for (let i = 0; i < 8; i++) {
        const out = ramp(1.55, 2.1, since0),
          turn = (i / 8) * Math.PI * 2;
        place.set(Math.cos(turn) * out * 0.5, 2.32 + Math.sin(turn) * out * 0.5, 0.38);
        set.localToWorld(place);
        sparks.place(i, place, since0 > 1.55 && since0 < 2.1 ? 1.4 * (1 - out) : 0);
      }
      for (let i = 0; i < 10; i++) {
        const up = (time * 0.4 + i / 10) % 1;
        place.set(
          -0.18 + pick(i, 29) * 0.36 + Math.sin(time * 2 + i) * 0.04,
          1.7 + up * 0.9,
          -0.05 + pick(i, 30) * 0.2,
        );
        set.localToWorld(place);
        steam.place(i, place, (1 - up) * 1.1);
      }
    };
  });
  return Object.assign(film, {
    cut(next: EveningShot) {
      shot = next;
      since = now;
    },
    cheers() {
      toast = now;
    },
  });
}
