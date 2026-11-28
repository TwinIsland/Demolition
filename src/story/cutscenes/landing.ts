import * as THREE from "three";
import { SIZE, SPOTS, featureAt, groundAt, symbolAt } from "../../modules/maps/flatland-story/layout.js";
import { STORY_SKINS } from "../assets";
import { pick, playFilm, ramp, type Cutscene } from "./kit";

const LENGTH = 5.8;
const SPARKS = 160;
const CLOUDS = 16;
const DUST = 56;
/** When the fall ends on the map. */
const IMPACT = 3.5;

/** Pixels to a cell of the painted map, and world units to a cell: he is two units tall. */
const PX = 16;
const CELL = 2;
const ROOF: Record<string, readonly [string, string, string]> = {
  dojo: ["#b5523c", "#8f3b2c", "#5e241b"],
  shop: ["#c98a3a", "#a56c27", "#6b4316"],
  shrine: ["#6d7fa8", "#536289", "#35405c"],
  tavern: ["#a8623c", "#84492b", "#562d1a"],
  smithy: ["#6b6b76", "#51515b", "#33333a"],
  windmill: ["#d8cfb4", "#b3a98c", "#7a715a"],
  house: ["#b86a4a", "#935138", "#5f3122"],
  cottage: ["#9c8a58", "#7b6c42", "#4e4429"],
};

/**
 * The story's own village as the overhead game shows it, painted cell by cell from the map's plan:
 * the same roads, plaza, fields, buildings and crates he is about to wake up among, all flat.
 */
function paintVillage() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE * PX;
  const c = canvas.getContext("2d")!;
  const dot = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const road = (x: number, z: number) => ",+F".includes(symbolAt(x, z)) || groundAt(x, z) === "stone";
  for (let z = 0; z < SIZE; z++)
    for (let x = 0; x < SIZE; x++) {
      const symbol = symbolAt(x, z),
        ox = x * PX,
        oz = z * PX,
        seed = x * 31 + z * 17;
      // The ground under whatever stands here.
      const ground = symbol === "+" || symbol === "F" ? "plaza" : groundAt(x, z);
      if (ground === "plaza") {
        dot(ox, oz, PX, PX, "#9a9aa6");
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 4; j++)
            dot(
              ox + i * 4 + (j % 2 ? 2 : 0),
              oz + j * 4,
              3,
              3,
              pick(seed + i * 4 + j, 1) < 0.5 ? "#b4b4c0" : "#a6a6b3",
            );
      } else if (ground === "stone") {
        dot(ox, oz, PX, PX, "#c2a26c");
        for (let i = 0; i < 7; i++)
          dot(
            ox + Math.floor(pick(seed + i, 2) * 15),
            oz + Math.floor(pick(seed + i, 3) * 15),
            2,
            1,
            i % 2 ? "#a98a58" : "#d6b983",
          );
        // A darker lip where the road meets the grass.
        if (!road(x, z - 1)) dot(ox, oz, PX, 1, "#8f7447");
        if (!road(x, z + 1)) dot(ox, oz + PX - 1, PX, 1, "#8f7447");
        if (!road(x - 1, z)) dot(ox, oz, 1, PX, "#8f7447");
        if (!road(x + 1, z)) dot(ox + PX - 1, oz, 1, PX, "#8f7447");
      } else if (ground === "mud") {
        dot(ox, oz, PX, PX, "#7a5632");
        for (let row = 1; row < PX; row += 4) dot(ox, oz + row, PX, 2, "#5f4126");
        for (let i = 0; i < 3; i++)
          dot(ox + 2 + Math.floor(pick(seed + i, 4) * 12), oz + 4 * i + 3, 1, 2, "#7fc35a");
      } else {
        dot(ox, oz, PX, PX, (x + z) % 2 ? "#5fae54" : "#67b65b");
        for (let i = 0; i < 6; i++)
          dot(
            ox + Math.floor(pick(seed + i, 5) * 15),
            oz + Math.floor(pick(seed + i, 6) * 14),
            1,
            2,
            i % 3 ? "#4c9746" : "#86cf70",
          );
      }

      const feature = featureAt(x, z);
      const building = feature?.match(/^(\w+):(\d+)x(\d+):(\d+),(\d+):(\w)$/);
      if (symbol === "#") {
        dot(ox, oz, PX, PX, "#5a5d6b");
        for (let j = 0; j < 4; j++)
          for (let i = -1; i < 2; i++) dot(ox + i * 8 + (j % 2 ? 4 : 0) + 1, oz + j * 4 + 1, 7, 3, "#787c8c");
        if (feature === "gate") dot(ox + 3, oz + 3, PX - 6, PX - 6, "#6b4a2a");
      } else if (building) {
        const [, kind, w, d, col, row, front] = building;
        const [light, dark, line] = ROOF[kind] ?? ROOF.house;
        const wide = Number(w) * PX,
          deep = Number(d) * PX,
          bx = ox - Number(col) * PX,
          bz = oz - Number(row) * PX;
        // The whole roof is painted from its first cell: two slopes, a ridge, tiles, an outline.
        if (col === "0" && row === "0") {
          dot(bx + 2, bz + 3, wide - 2, deep - 2, "#00000055");
          dot(bx + 1, bz + 1, wide - 2, deep - 2, line);
          const along = wide >= deep;
          dot(bx + 2, bz + 2, wide - 4, deep - 4, dark);
          if (along) dot(bx + 2, bz + 2, wide - 4, (deep - 4) / 2, light);
          else dot(bx + 2, bz + 2, (wide - 4) / 2, deep - 4, light);
          for (let i = 4; i < (along ? wide : deep) - 4; i += 4)
            if (along) dot(bx + i, bz + 2, 1, deep - 4, "#00000022");
            else dot(bx + 2, bz + i, wide - 4, 1, "#00000022");
          if (along) dot(bx + 2, bz + deep / 2 - 1, wide - 4, 2, line);
          else dot(bx + wide / 2 - 1, bz + 2, 2, deep - 4, line);
          // The doorstep, on the side the entrance looks to.
          const step = "#e9d9a8";
          if (front === "s") dot(bx + wide / 2 - 3, bz + deep - 2, 6, 2, step);
          else if (front === "n") dot(bx + wide / 2 - 3, bz, 6, 2, step);
          else if (front === "w") dot(bx, bz + deep / 2 - 3, 2, 6, step);
          else dot(bx + wide - 2, bz + deep / 2 - 3, 2, 6, step);
        }
      } else if (symbol === "c") {
        dot(ox + 2, oz + 3, 13, 12, "#00000044");
        dot(ox + 1, oz + 1, 13, 13, "#5b3a1a");
        dot(ox + 2, oz + 2, 11, 11, "#b07a3c");
        for (let i = 0; i < 11; i++) {
          dot(ox + 2 + i, oz + 2 + i, 1, 1, "#7d5326");
          dot(ox + 12 - i, oz + 2 + i, 1, 1, "#7d5326");
        }
        dot(ox + 2, oz + 2, 11, 1, "#d39a55");
      } else if (symbol === "f") {
        const upright = symbolAt(x, z - 1) === "f" || symbolAt(x, z + 1) === "f";
        if (upright) {
          dot(ox + 6, oz, 4, PX, "#6b4a2a");
          dot(ox + 7, oz, 2, PX, "#a9793f");
          for (let i = 2; i < PX; i += 6) dot(ox + 5, oz + i, 6, 2, "#5b3a1a");
        } else {
          dot(ox, oz + 6, PX, 4, "#6b4a2a");
          dot(ox, oz + 7, PX, 2, "#a9793f");
          for (let i = 2; i < PX; i += 6) dot(ox + i, oz + 5, 2, 6, "#5b3a1a");
        }
      } else if (symbol === "o") {
        // A pair of barrels, seen from above.
        for (const [bx, bz] of pick(seed, 7) < 0.5
          ? [
              [2, 2],
              [8, 7],
            ]
          : [
              [7, 2],
              [2, 8],
            ]) {
          dot(ox + bx + 1, oz + bz + 2, 6, 6, "#00000044");
          dot(ox + bx, oz + bz + 1, 6, 4, "#5b3a1a");
          dot(ox + bx + 1, oz + bz, 4, 6, "#5b3a1a");
          dot(ox + bx + 1, oz + bz + 1, 4, 4, "#a8743a");
          dot(ox + bx + 2, oz + bz + 2, 2, 2, "#7d5326");
        }
      } else if (symbol === "w") {
        dot(ox, oz + 5, PX, 8, "#00000033");
        dot(ox, oz + 4, PX, 7, "#6c7080");
        for (let i = 0; i < 4; i++) dot(ox + i * 4, oz + 5, 3, 2, i % 2 ? "#a3a7b6" : "#9195a5");
        for (let i = 0; i < 4; i++) dot(ox + i * 4 + 2, oz + 8, 3, 2, i % 2 ? "#9195a5" : "#a3a7b6");
      } else if (symbol === "L") {
        dot(ox + 4, oz + 4, 8, 8, "#ffe9a066");
        dot(ox + 5, oz + 5, 6, 6, "#ffe9a0aa");
        dot(ox + 6, oz + 6, 4, 4, "#3a3340");
        dot(ox + 7, oz + 7, 2, 2, "#fff6c8");
      } else if (symbol === "F") {
        dot(ox + 2, oz + 1, 12, 14, "#6c7080");
        dot(ox + 1, oz + 2, 14, 12, "#6c7080");
        dot(ox + 3, oz + 3, 10, 10, "#3f8fd0");
        dot(ox + 4, oz + 4, 4, 2, "#9fd6ff");
        dot(ox + 9, oz + 9, 3, 1, "#9fd6ff");
      } else if (symbol === "T") {
        dot(ox + 3, oz + 4, 12, 11, "#00000044");
        dot(ox + 3, oz + 1, 10, 13, "#2f6d38");
        dot(ox + 1, oz + 3, 14, 9, "#2f6d38");
        dot(ox + 3, oz + 2, 9, 10, "#3f8a45");
        dot(ox + 4, oz + 3, 5, 4, "#62b35a");
        dot(ox + 10, oz + 9, 2, 2, "#62b35a");
      } else if (symbol === "R") {
        dot(ox + 3, oz + 5, 11, 9, "#00000044");
        dot(ox + 3, oz + 3, 9, 9, "#6c7080");
        dot(ox + 2, oz + 5, 11, 6, "#6c7080");
        dot(ox + 4, oz + 4, 5, 3, "#a3a7b6");
      } else if (symbol === "G") {
        dot(ox + 5, oz + 4, 8, 10, "#00000044");
        dot(ox + 4, oz + 3, 8, 9, "#585c6a");
        dot(ox + 5, oz + 4, 6, 7, "#9195a5");
        dot(ox + 7, oz + 5, 2, 5, "#585c6a");
        dot(ox + 6, oz + 6, 4, 1, "#585c6a");
      } else if (symbol === "B") {
        dot(ox + 3, oz + 4, 12, 10, "#00000044");
        dot(ox + 2, oz + 3, 12, 9, "#585c6a");
        dot(ox + 3, oz + 4, 10, 7, "#c9ccd6");
        for (let i = 0; i < 3; i++) dot(ox + 4, oz + 5 + i * 2, 8 - i * 2, 1, "#585c6a");
      } else if (symbol === "t") {
        dot(ox + 3, oz + 3, 10, 10, "#585c6a");
        dot(ox + 4, oz + 4, 8, 8, "#9195a5");
        dot(ox + 6, oz + 6, 4, 4, "#b9bcc8");
      }
    }
  return canvas;
}

/** The country beyond the wall: plain meadow, a shade darker, repeated to the horizon. */
function paintMeadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PX * 4;
  const c = canvas.getContext("2d")!;
  for (let z = 0; z < 4; z++)
    for (let x = 0; x < 4; x++) {
      c.fillStyle = (x + z) % 2 ? "#4f9a4c" : "#56a352";
      c.fillRect(x * PX, z * PX, PX, PX);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? "#3f8641" : "#74bd66";
        c.fillRect(
          x * PX + Math.floor(pick(x * 9 + z * 5 + i, 8) * 15),
          z * PX + Math.floor(pick(x * 7 + z + i, 9) * 14),
          1,
          2,
        );
      }
    }
  return canvas;
}

/**
 * The start of act 3: Zero falls out of the screen's light, the ground of Flatland comes up at
 * him, and on landing he is pressed as flat as everything else there.
 */
export function playLanding(canvas: HTMLCanvasElement): Cutscene {
  return playFilm(canvas, LENGTH, (kit) => {
    const { scene, camera } = kit;
    const night = new THREE.Color("#05040b"),
      day = new THREE.Color("#7fd0ff");
    const sky = new THREE.Color(night);
    scene.background = sky;
    // The village comes up out of the haze instead of being there from the first frame.
    const haze = new THREE.Fog(sky, 16, 62);
    scene.fog = haze;
    scene.add(new THREE.AmbientLight("#ffffff", 1.4));
    const sun = new THREE.DirectionalLight("#ffffff", 1.2);
    sun.position.set(2, 6, 3);
    scene.add(sun);

    const pixelated = (source: HTMLCanvasElement) => {
      const texture = kit.keep(new THREE.CanvasTexture(source));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return texture;
    };
    const sheet = (texture: THREE.Texture, edge: number, y: number) => {
      const mesh = new THREE.Mesh(
        kit.keep(new THREE.PlaneGeometry(edge, edge)),
        kit.keep(new THREE.MeshBasicMaterial({ map: texture })),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      scene.add(mesh);
      return mesh;
    };
    // He lands at the origin, so the map is laid with the arrival cell there; north is -z.
    const edge = SIZE * CELL;
    const village = sheet(pixelated(paintVillage()), edge, 0);
    village.position.x = edge / 2 - (SPOTS.arrival.x + 0.5) * CELL;
    village.position.z = edge / 2 - (SPOTS.arrival.z + 0.5) * CELL;
    const meadow = pixelated(paintMeadow());
    meadow.wrapS = meadow.wrapT = THREE.RepeatWrapping;
    meadow.repeat.setScalar(30);
    sheet(meadow, 4 * CELL * 30, -0.05)
      .position.copy(village.position)
      .setY(-0.05);

    // Clouds are flat here too: slabs of white blocks he drops past.
    const clouds = Array.from({ length: CLOUDS }, (_, i) => {
      const cloud = new THREE.Group();
      const angle = pick(i, 11) * Math.PI * 2,
        radius = 4 + pick(i, 12) * 9;
      cloud.position.set(Math.cos(angle) * radius, 10 + pick(i, 13) * 40, Math.sin(angle) * radius);
      for (let part = 0; part < 3; part++) {
        const block = kit.box(
          [2.4 - part * 0.6 + pick(i, 14 + part) * 1.6, 0.4, 1.2 + pick(i, 17 + part) * 0.8],
          [(part - 1) * 1.1, part === 1 ? 0.4 : 0, (pick(i, 20 + part) - 0.5) * 0.8],
          part === 1 ? "#ffffff" : "#dff3ff",
          true,
        );
        cloud.add(block);
      }
      scene.add(cloud);
      return cloud;
    });

    const zero = kit.figure(STORY_SKINS["story-zero"]);
    const sparks = kit.swarm(SPARKS, "#9af3ff", 0.12);
    const seeds = Array.from({ length: SPARKS }, (_, i) => ({
      angle: pick(i, 1) * Math.PI * 2,
      radius: 1.2 + pick(i, 2) * 3.2,
      phase: pick(i, 3),
      speed: 0.5 + pick(i, 4) * 0.9,
    }));
    // What the landing throws up: square puffs along the ground, and a square ring running out.
    const dust = kit.swarm(DUST, "#f1e6c8", 0.22);
    const ring = new THREE.Group();
    for (let side = 0; side < 4; side++) {
      const bar = kit.box([2.16, 0.04, 0.16], [0, 0, 1], "#ffffff", true);
      const arm = new THREE.Group();
      arm.rotation.y = (side * Math.PI) / 2;
      arm.add(bar);
      ring.add(arm);
    }
    ring.position.y = 0.03;
    scene.add(ring);
    const flash = new THREE.Mesh(
      kit.keep(new THREE.PlaneGeometry(4, 4)),
      kit.keep(
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0,
          depthTest: false,
          fog: false,
        }),
      ),
    );
    flash.position.z = -0.5;
    flash.renderOrder = 10;
    camera.add(flash);
    camera.up.set(0, 0, -1);
    const at = new THREE.Vector3();

    return (t) => {
      const fall = Math.min(1, t / IMPACT),
        landed = t >= IMPACT,
        since = t - IMPACT,
        // Height above the map: a long drop that ends abruptly.
        height = landed ? 0 : 60 * (1 - fall) ** 1.6 + 0.02,
        squash = ramp(IMPACT, IMPACT + 0.12, t),
        settle = ramp(IMPACT + 0.3, LENGTH - 0.6, t);

      // He tumbles on the way down and ends on his back, then loses his third dimension.
      const { leftArm, rightArm, leftLeg, rightLeg } = zero.rig.skin;
      const flail = landed ? 0 : 1;
      leftArm.rotation.set(Math.sin(t * 15) * 0.9 * flail, 0, 1.2);
      rightArm.rotation.set(-Math.sin(t * 15) * 0.9 * flail, 0, -1.2);
      leftLeg.rotation.x = Math.sin(t * 12) * 0.7 * flail;
      rightLeg.rotation.x = -Math.sin(t * 12) * 0.7 * flail;
      zero.rig.rotation.set(-Math.PI / 2, 0, landed ? 0 : t * 2.4);
      zero.group.position.set(0, height + 0.26 * (1 - squash), 0);
      zero.group.scale.set(1 + 0.25 * squash, 1 - 0.97 * squash, 1 + 0.25 * squash);

      // The light he fell through thins out as the ground comes up.
      const thin = 1 - ramp(IMPACT - 1.2, IMPACT, t);
      for (let i = 0; i < SPARKS; i++) {
        const seed = seeds[i];
        const u = (seed.phase + t * seed.speed) % 1;
        const angle = seed.angle + u * 2;
        at.set(Math.cos(angle) * seed.radius, height - 8 + u * 22, Math.sin(angle) * seed.radius);
        sparks.place(i, at, i / SPARKS < thin ? 0.6 + u : 0);
      }
      // Out of the dark of the screen into daylight; the haze lifts as he gets close.
      sky.copy(night).lerp(day, ramp(0.6, IMPACT - 0.6, t));
      haze.near = 16 + 60 * ramp(IMPACT - 1, IMPACT, t);
      haze.far = haze.near + 46;
      for (const cloud of clouds) cloud.visible = cloud.position.y < height + 9;
      (flash.material as THREE.MeshBasicMaterial).opacity =
        ramp(IMPACT - 0.03, IMPACT + 0.05, t) - ramp(IMPACT + 0.1, IMPACT + 0.6, t);

      for (let i = 0; i < DUST; i++) {
        const angle = (i / DUST) * Math.PI * 2 + pick(i, 31),
          reach = (0.8 + pick(i, 32) * 3.4) * (1 - Math.exp(-since * 3.5)),
          hop = Math.max(0, Math.sin(Math.min(1, since * (1.4 + pick(i, 33))) * Math.PI)) * pick(i, 34);
        at.set(Math.cos(angle) * reach, 0.12 + hop, Math.sin(angle) * reach);
        dust.place(i, at, landed ? Math.max(0, 1.2 - since * (0.8 + pick(i, 35) * 0.6)) : 0);
      }
      // The ring keeps to the grid: it grows a cell at a time.
      const spread = Math.floor(since * 9);
      ring.visible = landed && spread < 6;
      ring.scale.set(1 + spread, 1, 1 + spread);

      // Above and a little behind him all the way down, the village growing under his back;
      // straight overhead, north up, once he is part of the floor.
      const shake = landed ? 0.3 * Math.exp(-since * 5) : 0.04;
      camera.position.set(
        Math.sin(t * 40) * shake,
        height + 6.5 + 6.5 * settle,
        4.2 * (1 - settle) + 0.01 + Math.cos(t * 43) * shake,
      );
      camera.lookAt(0, height, 0);
    };
  });
}
