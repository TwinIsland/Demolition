import * as THREE from "three";
import { powerTier } from "../core/combat";
import { bombGuideColor, bombWarning } from "../core/bomb-warning";
import type { GameSnapshot, Player } from "../core/types";
import { world } from "./arena";

/** Constant light count avoids recompiling every PBR material when bombs spawn. */
export class ExplosiveLights {
  readonly lights = Array.from({ length: 4 }, () => {
    const light = new THREE.PointLight("#ff281b", 0, 2.8);
    light.castShadow = false;
    return light;
  });
  constructor(scene: THREE.Scene) {
    scene.add(...this.lights);
  }
  update(state: Readonly<GameSnapshot>, self: Player) {
    const nearest = [...state.bombs]
      .sort(
        (a, b) =>
          Math.hypot(a.x - self.x, a.z - self.z) -
          Math.hypot(b.x - self.x, b.z - self.z),
      )
      .slice(0, this.lights.length);
    this.lights.forEach((light, index) => {
      const bomb = nearest[index];
      light.intensity = 0;
      if (!bomb) return;
      const warning = bombWarning(bomb.detonateAt, state.time,!!bomb.slide);
      light.position.set(
        world(bomb.x, state.size),
        1.32,
        world(bomb.z, state.size),
      );
      light.color.set(bombGuideColor(state.players,bomb.ownerId,self.id));
      light.intensity =
        (1.1 + warning.progress * 0.5) *
        (0.94 + 0.15 * Math.sin(warning.phase * Math.PI * 2)) *
        (1 + 0.2 * powerTier(bomb.power ?? 70));
    });
  }
}
