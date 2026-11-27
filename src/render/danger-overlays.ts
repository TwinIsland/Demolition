import * as THREE from "three";
import { blastCells } from "../core/geometry";
import { bombGuideColor, bombWarning, finalCountdown } from "../core/bomb-warning";
import { powerTier } from "../core/combat";
import { trailHidden } from "../core/types";
import type { GameSnapshot } from "../core/types";
import { world } from "./arena";
import { standIn } from "./gpu-warmup";

const FLASH = new THREE.Color("#ffffff");
/** Texture slot and tint of a concealed charge's path, which only its owner is shown. */
const VEIL_TEXTURE = 3;
const VEIL_COLOR = "#b98cff";

/** One instanced warning mesh per bomb, with gentle independent pulse and team tint. */
export class DangerOverlays {
  private entries = new Map<
    number,
    { mesh: THREE.InstancedMesh; material: THREE.MeshBasicMaterial; cell: string }
  >();
  private geometry = new THREE.PlaneGeometry(2.32, 2.32);
  private textures: THREE.Texture[];
  private storyTexture: THREE.Texture;
  private signature = "";
  constructor(
    private parent: THREE.Group,
    manager = THREE.DefaultLoadingManager,
  ) {
    const loader = new THREE.TextureLoader(manager);
    this.textures = ["base", "boost", "heavy", "veil"].map((name) =>
      loader.load(`./assets/danger-${name}.svg`),
    );
    this.storyTexture = loader.load("./assets/danger-story.svg");
  }
  private material(tier: number, story = false) {
    return new THREE.MeshBasicMaterial({
      map: story && tier !== VEIL_TEXTURE ? this.storyTexture : this.textures[tier],
      transparent: true,
      opacity: 0.23,
      toneMapped: !story,
      fog: !story,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }
  /**
   * Each bomb's overlay disposes its material when the bomb goes off, which would free the
   * program whenever no bomb is down. These hold it, and upload the four path textures.
   */
  warmObjects(): THREE.Object3D[] {
    return [false, true].flatMap((story) =>
      this.textures.map(
        (_, tier) => new THREE.InstancedMesh(this.geometry, standIn(this.material(tier, story)), 1),
      ),
    );
  }
  clear() {
    for (const entry of this.entries.values()) {
      entry.mesh.removeFromParent();
      entry.mesh.dispose();
      entry.material.dispose();
    }
    this.entries.clear();
    this.signature = "";
  }
  sync(state: Readonly<GameSnapshot>, mapChanged: boolean, viewerId: string) {
    // Opponents' concealed charges get no overlay at all; the owner's own switch to the veil style.
    const bombs = state.bombs.filter((b) => !trailHidden(b, viewerId));
    const cellKey = (b: (typeof bombs)[number]) => `${b.x},${b.z},${b.concealed ? 1 : 0}`;
    const signature = bombs.map((b) => `${b.id}:${cellKey(b)}`).join("|");
    if (mapChanged || signature !== this.signature) {
      const live = new Map(bombs.map((b) => [b.id, cellKey(b)]));
      for (const [id, entry] of this.entries)
        if (live.get(id) !== entry.cell || mapChanged) {
          entry.mesh.removeFromParent();
          entry.mesh.dispose();
          entry.material.dispose();
          this.entries.delete(id);
        }
      for (const bomb of bombs)
        if (!this.entries.has(bomb.id)) {
          const cells = blastCells(state, bomb),
            tier = bomb.concealed ? VEIL_TEXTURE : powerTier(bomb.power ?? 70);
          const material = this.material(tier, !!state.story);
          const mesh = new THREE.InstancedMesh(this.geometry, material, cells.length),
            matrix = new THREE.Matrix4(),
            rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          cells.forEach((c, index) => {
            matrix.compose(
              new THREE.Vector3(
                world(c.x, state.size),
                state.tiles[c.z][c.x] === 2 ? 1.89 : 0.025,
                world(c.z, state.size),
              ),
              rotation,
              new THREE.Vector3(1, 1, 1),
            );
            mesh.setMatrixAt(index, matrix);
          });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
          this.parent.add(mesh);
          this.entries.set(bomb.id, { mesh, material, cell: cellKey(bomb) });
        }
      this.signature = signature;
    }
    for (const bomb of bombs) {
      const entry = this.entries.get(bomb.id)!;
      if (bomb.concealed) {
        // A steady violet outline that breathes slowly: readable, and unmistakably not a public warning.
        const final = finalCountdown(bomb.detonateAt, state.time, !!bomb.slide);
        entry.mesh.renderOrder = 2;
        entry.material.color.set(VEIL_COLOR).lerp(FLASH, 0.35 * final);
        entry.material.opacity = 0.62 + 0.2 * Math.sin(state.time * 5.5) + 0.18 * final;
        continue;
      }
      const final = finalCountdown(bomb.detonateAt, state.time, !!bomb.slide);
      entry.mesh.renderOrder = bomb.ownerId === viewerId ? 2 : 3;
      const w = bombWarning(bomb.detonateAt, state.time, !!bomb.slide);
      const wave = Math.sin(w.phase * Math.PI * 2);
      // In the final countdown the path flashes harder and its peaks bleach towards white.
      entry.material.color
        .set(bombGuideColor(state.players, bomb.ownerId, viewerId))
        .lerp(FLASH, (state.story ? 0.2 : 0) + 0.5 * final * Math.max(0, wave));
      entry.material.opacity = Math.min(
        1,
        state.story
          ? 0.84 + 0.08 * wave + 0.08 * final
          : 0.42 + 0.2 * final + (0.14 + 0.05 * w.progress + 0.22 * final) * wave,
      );
    }
  }
  dispose() {
    this.clear();
    this.geometry.dispose();
    this.textures.forEach((t) => t.dispose());
    this.storyTexture.dispose();
  }
}
