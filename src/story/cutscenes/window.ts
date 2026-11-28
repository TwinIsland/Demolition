import * as THREE from "three";
import { pick, playFilm, ramp, type Cutscene, type FilmKit } from "./kit";

/** The block he lives in: windows across, floors up, and the spacing between them. */
const COLUMNS = 9,
  FLOORS = 7,
  ACROSS = 1.6,
  UP = 1.7;
/** His window: a little right of the middle, a few floors up. Nothing marks it but the curtains. */
const HIS = { column: 5, floor: 4 };
const at = (column: number, floor: number) =>
  [(column - (COLUMNS - 1) / 2) * ACROSS, 1.3 + floor * UP] as const;
const [HIS_X, HIS_Y] = at(HIS.column, HIS.floor);

/** The two hours the block is seen at: the evening the story opens on, and the morning he comes home to. */
const HOURS = {
  dusk: {
    // Top of the sky to the horizon.
    sky: ["#1b1740", "#3a2460", "#7a3470", "#c8506a", "#f08a5a", "#ffc27a"],
    sun: { color: "#ffd9a0", at: [-17, 3.2] },
    cloud: "#e8788a",
    ambient: ["#8676b8", 1.15],
    key: ["#ff9460", 1.7, [-9, 4, 10]],
    wall: "#6d5876",
    trim: "#8a7390",
    far: "#3c2c58",
    haze: "#a05a78",
    leaf: ["#3f6a66", "#4a7a6e", "#35585e"],
    ground: "#2e2244",
    glass: ["#2a2238", "#322a44"],
    curtain: "#4b3b6a",
  },
  morning: {
    sky: ["#6fb2e6", "#8cc6ee", "#aad8f2", "#cbe8f4", "#eaf3ea", "#fff1d2"],
    sun: { color: "#fffbe6", at: [15, 11] },
    cloud: "#ffffff",
    ambient: ["#d5deee", 1.5],
    key: ["#fff2d6", 1.9, [9, 11, 10]],
    wall: "#cfc5ba",
    trim: "#e4dcd2",
    far: "#9fb4c8",
    haze: "#c4d6e2",
    leaf: ["#5d9a58", "#70ad62", "#4c8650"],
    ground: "#8fa3b0",
    glass: ["#86b6d6", "#a4cde4"],
    curtain: "#6a5a94",
  },
} as const;
type Hour = keyof typeof HOURS;

const LAMPS = ["#ffcf7a", "#ffb35c", "#ffe2a0", "#ffd08c"];
const WASHING = ["#e8e4da", "#d86a6a", "#6a9ad8", "#e8c860", "#8ac89a"];

function sky(kit: FilmKit, colors: readonly string[]) {
  // Bands of flat colour, never blended: the sky is drawn with as few inks as the rooms are.
  // The bands crowd together towards the horizon, as they do on a real evening.
  const rows = colors.map((_, band) => Math.max(2, Math.round(10 / (band + 1))));
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = rows.reduce((sum, count) => sum + count, 0);
  const ink = canvas.getContext("2d")!;
  let top = 0;
  colors.forEach((color, band) => {
    ink.fillStyle = color;
    ink.fillRect(0, top, 4, rows[band]);
    top += rows[band];
  });
  const texture = kit.keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  const mesh = new THREE.Mesh(
    kit.keep(new THREE.PlaneGeometry(260, 160)),
    kit.keep(new THREE.MeshBasicMaterial({ map: texture })),
  );
  mesh.position.set(0, 50, -60);
  kit.scene.add(mesh);
}

/**
 * The block of flats from across the street. `dusk` opens the story: a summer evening, every
 * kitchen lit, and the camera goes slowly to the one window with its curtains shut. `morning`
 * closes the way home: the same window from the same place, the curtains are pulled open, and the
 * camera leaves it for the sky.
 */
export function playWindow(canvas: HTMLCanvasElement, hour: Hour): Cutscene {
  const dusk = hour === "dusk";
  return playFilm(canvas, dusk ? 10.5 : 11, (kit) => {
    const { scene, camera } = kit;
    const look = HOURS[hour];
    scene.background = new THREE.Color(look.sky[look.sky.length - 1]);
    scene.add(new THREE.AmbientLight(look.ambient[0], look.ambient[1]));
    const key = new THREE.DirectionalLight(look.key[0], look.key[1]);
    key.position.fromArray(look.key[2]);
    scene.add(key);
    camera.far = 200;
    sky(kit, look.sky);

    // The sun, square-cornered, and a few long clouds.
    const sun = new THREE.Mesh(
      kit.keep(new THREE.CircleGeometry(dusk ? 5 : 3.2, 8)),
      kit.keep(new THREE.MeshBasicMaterial({ color: look.sun.color })),
    );
    sun.position.set(look.sun.at[0], look.sun.at[1] + 6, -58);
    scene.add(sun);
    const clouds = Array.from({ length: 7 }, (_, i) => {
      const cloud = kit.box(
        [9 + pick(i, 1) * 14, 0.7 + pick(i, 2) * 0.6, 0.2],
        [-48 + pick(i, 3) * 96, 20 + pick(i, 4) * 30, -55],
        look.cloud,
        true,
      );
      const material = cloud.material as THREE.MeshBasicMaterial;
      material.transparent = true;
      material.opacity = dusk ? 0.55 : 0.8;
      return cloud;
    });

    // The rest of the town: a skyline in the haze, and a neighbour on either side.
    for (let i = 0; i < 16; i++) {
      const wide = 5 + pick(i, 5) * 6,
        tall = 7 + pick(i, 6) * 16;
      kit.box([wide, tall, 4], [-62 + i * 8.2 + pick(i, 7) * 3, tall / 2 - 2, -40], look.haze, true);
    }
    // The ground they all stand on, and the low roofs between here and the skyline.
    kit.box([260, 2, 120], [0, -1, -10], look.ground, true);
    for (let i = 0; i < 30; i++) {
      const wide = 4 + pick(i, 22) * 5,
        tall = 2.5 + pick(i, 23) * 5;
      kit.box(
        [wide, tall, 4],
        [-58 + pick(i, 24) * 116, tall / 2, -14 - pick(i, 25) * 20],
        i % 3 ? look.far : look.haze,
        true,
      );
    }
    const neighbours: [number, number, number, number, number][] = [
      [-17, 19, 9, -12, 11],
      [16.5, 12, 10, -9, 7],
      [-30, 11, 9, -18, 6],
      [31, 16, 9, -20, 9],
    ];
    neighbours.forEach(([x, tall, wide, z, floors], n) => {
      kit.box([wide, tall, 6], [x, tall / 2, z], look.far);
      for (let floor = 0; floor < floors; floor++)
        for (let column = 0; column < 5; column++) {
          const on = dusk && pick(n * 97 + floor * 7 + column, 8) < 0.5;
          kit.box(
            [0.8, 0.9, 0.1],
            [x + (column - 2) * (wide / 5.6), 1.6 + floor * 1.6, z + 3.02],
            on ? LAMPS[(floor + column) % LAMPS.length] : look.glass[(floor + column) % 2],
            true,
          );
        }
    });

    // His block: the wall, the roof and what stands on it.
    const width = COLUMNS * ACROSS + 1.6,
      height = FLOORS * UP + 1.1;
    kit.box([width, height, 6], [0, height / 2, -3.02], look.wall);
    kit.box([width + 0.4, 0.35, 6.4], [0, height + 0.17, -3], look.trim);
    kit.box([1.5, 1.3, 1.5], [-4.6, height + 1, -2.6], look.trim);
    for (const x of [-5.1, -4.1]) kit.box([0.12, 0.5, 0.12], [x, height + 0.25, -2.1], look.far);
    kit.box([2.4, 1.6, 2.2], [3.4, height + 0.95, -3], look.wall);
    kit.box([0.06, 2.6, 0.06], [5.6, height + 1.5, -2.4], look.far);
    for (const y of [2.1, 2.5]) kit.box([0.9, 0.05, 0.05], [5.6, height + y, -2.4], look.far);
    // A downpipe, and the stair windows one above another.
    kit.box([0.14, height, 0.14], [-width / 2 + 0.5, height / 2, 0.08], look.trim);

    // Every window: a frame, the glass, a sill; an air conditioner under some, washing under others.
    const tellies: { pane: THREE.MeshBasicMaterial; seed: number }[] = [];
    const late: { pane: THREE.MeshBasicMaterial; lamp: THREE.Color; dark: THREE.Color; when: number }[] = [];
    const lines: { group: THREE.Group; seed: number }[] = [];
    for (let floor = 0; floor < FLOORS; floor++)
      for (let column = 0; column < COLUMNS; column++) {
        const i = floor * COLUMNS + column,
          [x, y] = at(column, floor),
          his = column === HIS.column && floor === HIS.floor,
          beside = Math.abs(column - HIS.column) + Math.abs(floor - HIS.floor) === 1;
        kit.box([1.12, 1.22, 0.08], [x, y, 0.02], look.far);
        kit.box([1.24, 0.08, 0.26], [x, y - 0.65, 0.12], look.trim);
        if (his) continue;
        const kind = pick(i, 9),
          dark = look.glass[i % 2];
        const pane = kit.box([0.96, 1.06, 0.06], [x, y, 0.06], dark, true)
          .material as THREE.MeshBasicMaterial;
        kit.box([0.04, 1.06, 0.07], [x, y, 0.07], look.far);
        if (dusk) {
          // The ones round his are all lit: that is what makes his the dark one.
          const lamp = LAMPS[i % LAMPS.length];
          if (beside || kind < 0.42) pane.color.set(lamp);
          else if (kind < 0.54) tellies.push({ pane, seed: i });
          else if (kind < 0.7)
            late.push({
              pane,
              lamp: new THREE.Color(lamp),
              dark: new THREE.Color(dark),
              when: 1.5 + pick(i, 10) * 7,
            });
        }
        if (pick(i, 11) < 0.34)
          kit.box([0.5, 0.36, 0.3], [x + 0.22, y - 0.92, 0.2], dusk ? "#8d8298" : "#e9e6df");
        else if (pick(i, 12) < 0.4 && !beside) {
          const group = new THREE.Group();
          group.position.set(x, y - 0.86, 0.55);
          scene.add(group);
          group.add(kit.box([1.3, 0.03, 0.03], [0, 0, 0], look.far));
          for (let item = 0; item < 3; item++)
            group.add(
              kit.box(
                [0.24, 0.3 + pick(i * 3 + item, 13) * 0.14, 0.02],
                [-0.42 + item * 0.42, -0.2, 0],
                WASHING[Math.floor(pick(i * 3 + item, 14) * WASHING.length)],
              ),
            );
          lines.push({ group, seed: i });
        }
      }

    // His window. Behind the curtains is the room the story is played in.
    const room = kit.box([0.96, 1.06, 0.06], [HIS_X, HIS_Y, 0.06], dusk ? "#17122a" : "#fff0c4", true)
      .material as THREE.MeshBasicMaterial;
    const curtains = [-1, 1].map((side) =>
      kit.box([0.47, 1.06, 0.05], [HIS_X + side * 0.24, HIS_Y, 0.1], look.curtain),
    );
    kit.box([0.5, 0.36, 0.3], [HIS_X - 0.24, HIS_Y - 0.92, 0.2], dusk ? "#8d8298" : "#e9e6df");

    // The street side of the picture: tree tops, a pole, and the wires that cross every summer sky.
    for (let i = 0; i < 90; i++) {
      const side = 0.9 + pick(i, 15) * 1.5;
      kit.box(
        [side, side, side],
        [-34 + pick(i, 16) * 68, pick(i, 17) * 2.4, 1.6 + pick(i, 18) * 3],
        look.leaf[i % look.leaf.length],
      );
    }
    kit.box([0.22, 13, 0.22], [10.4, 5.5, 7.5], look.far);
    kit.box([1.8, 0.14, 0.14], [10.4, 10.9, 7.5], look.far);
    for (const [y, lean] of [
      [10.75, 0.012],
      [10.45, -0.008],
      [9.6, 0.02],
    ]) {
      const wire = kit.box([60, 0.035, 0.035], [0, y, 7.5], "#15101f", true);
      wire.rotation.z = lean;
    }

    // Swifts, or whatever they are: a few specks that cross once.
    const birds = kit.swarm(5, dusk ? "#1b1430" : "#3c4a5c", 0.16);
    const speck = new THREE.Vector3();

    // The picture comes up out of black.
    const shade = new THREE.Mesh(
      kit.keep(new THREE.PlaneGeometry(4, 3)),
      kit.keep(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, depthTest: false })),
    );
    shade.position.z = -0.5;
    shade.renderOrder = 9;
    camera.add(shade);

    const wide = new THREE.Vector3(-7, 11, 36),
      close = new THREE.Vector3(HIS_X + 1.1, HIS_Y + 0.25, 6.4),
      aim = new THREE.Vector3(),
      middle = new THREE.Vector3(0, 10.5, 0),
      his = new THREE.Vector3(HIS_X, HIS_Y, 0),
      above = new THREE.Vector3(-2, 40, -40);

    return (time) => {
      (shade.material as THREE.MeshBasicMaterial).opacity = 1 - ramp(0.1, 1.3, time);
      for (const { pane, seed } of tellies) {
        const beat = Math.floor(time * (5 + pick(seed, 19) * 5) + seed);
        pane.color.setHSL(0.6, 0.55, 0.42 + pick(beat, 20) * 0.28);
      }
      for (const { pane, lamp, dark, when } of late) pane.color.copy(time > when ? lamp : dark);
      for (const { group, seed } of lines) group.rotation.x = Math.sin(time * 1.3 + seed) * 0.12;
      clouds.forEach((cloud, i) => (cloud.position.x += (0.004 + pick(i, 21) * 0.004) * (dusk ? 1 : -1)));
      for (let i = 0; i < 5; i++) {
        const along = time * 5.5 - 14 - i * 0.9;
        speck.set(
          (dusk ? -1 : 1) * (along - Math.abs(i - 2) * 0.7),
          17 + (i - 2) * 0.45 + Math.sin(time * 9 + i) * 0.12 + along * 0.12,
          -6,
        );
        birds.place(i, speck, 1);
      }

      if (dusk) {
        // From the whole evening down to one window, without a cut and without hurry.
        const approach = ramp(0.4, 10.2, time);
        const eased = approach * approach * (3 - 2 * approach);
        camera.position.lerpVectors(wide, close, eased);
        camera.lookAt(aim.lerpVectors(middle, his, ramp(0.4, 7.5, time)));
        camera.fov = 48 - 9 * eased;
      } else {
        // The curtains go first, by hand, one after the other; only then does the camera let go.
        const [left, right] = curtains;
        left.scale.x = 1 - 0.68 * ramp(1.3, 2.2, time);
        left.position.x = HIS_X - 0.24 - 0.24 * 0.68 * ramp(1.3, 2.2, time);
        right.scale.x = 1 - 0.68 * ramp(2.5, 3.3, time);
        right.position.x = HIS_X + 0.24 + 0.24 * 0.68 * ramp(2.5, 3.3, time);
        room.color.set("#fff0c4").multiplyScalar(0.55 + 0.45 * ramp(1.3, 3.3, time));
        const leave = ramp(4.2, 11, time);
        camera.position.lerpVectors(close, wide, leave);
        aim.lerpVectors(his, middle, ramp(4.2, 8, time)).lerp(above, ramp(6.2, 11, time));
        camera.lookAt(aim);
        camera.fov = 39 + 9 * leave;
      }
      camera.updateProjectionMatrix();
    };
  });
}
