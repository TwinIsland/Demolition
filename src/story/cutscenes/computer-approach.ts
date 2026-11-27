import * as THREE from "three";
import { BUBBLE_X } from "../acts/bubble-x";
import { playFilm, ramp, type Cutscene } from "./kit";

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
    ink.fillStyle = "#080914";
    ink.fillRect(0, 0, 256, 180);
    const rows = BUBBLE_X.layout;
    const cell = 14,
      left = (256 - rows[0].length * cell) / 2,
      top = (180 - rows.length * cell) / 2;
    rows.forEach((row, z) =>
      [...row].forEach((symbol, x) => {
        ink.fillStyle = symbol === "#" ? "#8d8caf" : "#395f58";
        ink.fillRect(left + x * cell, top + z * cell, cell - 1, cell - 1);
        if ("cg".includes(symbol)) {
          ink.fillStyle = "#b98760";
          ink.fillRect(left + x * cell + 2, top + z * cell + 2, cell - 5, cell - 5);
        }
      }),
    );
    const texture = kit.keep(new THREE.CanvasTexture(pixels));
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
