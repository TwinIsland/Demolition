import * as THREE from "three";
import { BUBBLE_X } from "../acts/bubble-x";
import { STORY_ART } from "../assets";
import { playFilm, ramp, type Cutscene } from "./kit";

const CELL = 16;
const FEET_Y = 9;
/** Frames of the arcade sheet (tools/story/make-arcade.py) that stand on a cell. */
const PROPS: Record<string, number> = { "#": 2, c: 3, g: 4 };

const sheet = (url: string) => {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
};

/** The powered CRT becomes the screen the next chapter is played on. */
export function playComputerApproach(canvas: HTMLCanvasElement): Cutscene {
  return playFilm(canvas, 6.2, (kit) => {
    const { scene, camera } = kit;
    scene.background = new THREE.Color("#110c20");
    scene.add(new THREE.AmbientLight("#a58bc4", 1.3));
    const lamp = new THREE.PointLight("#ffc889", 22, 9);
    lamp.position.set(2.3, 3.2, 0.1);
    scene.add(lamp);
    kit.box([10, 0.12, 9], [0, -0.7, 0], "#3c2943");
    kit.box([9, 5, 0.15], [0, 1.8, -2.1], "#433052");
    kit.box([5.3, 0.18, 2.7], [0, 0.15, 0], "#6b4a53");
    for (const x of [-2.1, 2.1]) kit.box([0.2, 0.85, 0.2], [x, -0.3, 0.8], "#463043");
    kit.box([2.75, 2.05, 1.25], [0, 1.45, -0.15], "#b6a1bc");
    kit.box([2.42, 1.73, 0.14], [0, 1.53, 0.52], "#5a426d");
    kit.box([2.02, 1.39, 0.08], [0, 1.57, 0.61], "#171028");
    kit.box([1.4, 0.18, 0.9], [0, 0.42, -0.1], "#89738f");
    kit.box([1.95, 0.11, 0.55], [0, 0.31, 1.0], "#a28eaa");
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 12; col++)
        kit.box([0.11, 0.025, 0.08], [-0.82 + col * 0.14, 0.38, 0.82 + row * 0.14], "#d2c2d7");
    kit.box([0.09, 0.06, 0.04], [0.93, 0.8, 0.62], "#8affdf", true);
    const glow = new THREE.PointLight("#7d9bff", 8, 6);
    glow.position.set(0, 1.6, 1.1);
    scene.add(glow);

    const pixels = document.createElement("canvas");
    pixels.width = 256;
    pixels.height = 180;
    const ink = pixels.getContext("2d")!;
    ink.imageSmoothingEnabled = false;
    ink.fillStyle = "#05060c";
    ink.fillRect(0, 0, 256, 180);
    const texture = kit.keep(new THREE.CanvasTexture(pixels));
    // The board as act 2 opens on it: the same sheets and frames arcade-play.ts draws with.
    const rows = BUBBLE_X.layout;
    const left = (256 - rows[0].length * CELL) / 2,
      top = (180 - rows.length * CELL) / 2;
    void Promise.all([sheet(STORY_ART.arcade), sheet(STORY_ART.chibi)]).then(([tiles, cast]) => {
      const tile = (frame: number, x: number, y: number) =>
        ink.drawImage(tiles, frame * CELL, 0, CELL, CELL, left + x * CELL, top + y * CELL, CELL, CELL);
      rows.forEach((row, y) =>
        [...row].forEach((symbol, x) => {
          tile((x + y) % 2 ? 1 : 0, x, y);
          const prop = PROPS[symbol];
          if (prop !== undefined) tile(prop, x, y);
        }),
      );
      rows.forEach((row, y) => {
        const x = row.indexOf("@");
        if (x < 0) return;
        // Zero, standing and facing the viewer; feet as the game anchors them.
        const size = CELL * 2;
        ink.drawImage(
          cast,
          0,
          0,
          size,
          size,
          left + x * CELL + CELL / 2 - size / 2,
          top + y * CELL + CELL / 2 + FEET_Y - size,
          size,
          size,
        );
      });
      texture.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    const material = kit.keep(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    const screen = new THREE.Mesh(kit.keep(new THREE.PlaneGeometry(1.99, 1.36)), material);
    screen.position.set(0, 1.57, 0.66);
    scene.add(screen);
    const scan = kit.box([1.98, 0.012, 0.005], [0, 1.57, 0.67], "#9fcbff", true);
    (scan.material as THREE.MeshBasicMaterial).transparent = true;
    (scan.material as THREE.MeshBasicMaterial).opacity = 0.18;

    return (time) => {
      const approach = ramp(0.35, 5.8, time);
      camera.position.set(-3.0 * (1 - approach), 2.5 - 0.93 * approach, 5.7 - 3.95 * approach);
      camera.lookAt(0, 1.57, 0.66);
      camera.fov = 48 - 6 * approach;
      camera.updateProjectionMatrix();
      scan.position.y = 2.22 - ((time * 0.55) % 1.3);
      glow.intensity = 8 + Math.sin(time * 4) * 0.3;
    };
  });
}
