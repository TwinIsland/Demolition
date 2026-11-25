import * as THREE from "three";
import { MAPS } from "../core/maps";
import { coverLayout } from "../core/cover-layout";
import { TILE_SIZE } from "../core/geometry";
import type { GameSnapshot } from "../core/types";
import { Models } from "./models";
import { StaticBatches } from "./static-batches";
export { TILE_SIZE };
export const world = (value: number, size: number) =>
  (value - (size - 1) / 2) * TILE_SIZE;

export class Arena {
  private batches: StaticBatches;
  readonly root = new THREE.Group();
  private crates = new Map<number,number>();
  private coverRevision:number;
  constructor(
    private models: Models,
    state: Readonly<GameSnapshot>,
  ) {
    const size = state.size,
      width = size * TILE_SIZE,
      map = MAPS.find((m) => m.id === state.mapId)!,
      midnight = map.theme === "midnight";
    const m = models.materials;
    const coverAt = coverLayout(map, state.seed);
    this.coverRevision = state.coverRevision ?? 0;
    const base = models.box(
      width + 0.55,
      1.5,
      width + 0.55,
      m.standard("platform", "#282c2b", "metal"),
      0.3,
    );
    base.position.y = -0.95;
    this.root.add(base);
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        const px = world(x, size),
          pz = world(z, size);
        const tile = models.box(
          2.37,
          0.18,
          2.37,
          m.standard("floor", (x + z) % 2 ? "#b1b3ae" : "#bdbdb5", "ceramic"),
          0.03,
        );
        tile.position.set(px, -0.1, pz);
        this.root.add(tile);
        if (state.tiles[z][x] === 1) {
          const wall = models.wall(midnight);
          wall.position.set(px, 0, pz);
          this.root.add(wall);
        }
        if (state.tiles[z][x] === 2) {
          const cell = z*size+x, origin = state.coverOrigins?.[cell] ?? cell;
          const {cover, rotation} = coverAt(origin%size,Math.floor(origin/size));
          const crate = models.fieldCover(cover);
          crate.rotation.y = rotation;
          crate.position.set(px, 0, pz);
          this.root.add(crate);
          crate.traverse((object) => {
            if (object instanceof THREE.Mesh)
              object.userData.destructibleCell = String(origin);
          });
          this.crates.set(origin,cell);
        }
      }
    const terrain = models.box(
      240,
      0.3,
      240,
      m.standard("terrain", "#8e9287", "ceramic"),
      0.01,
    );
    terrain.position.y = -1.6;
    this.root.add(terrain);
    // Distant industrial silhouettes sit outside the playable collision grid.
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6,
        distance = 48 + (i % 3) * 11,
        height = 5 + (i % 4) * 3;
      const building = models.box(
        10 + (i % 3) * 3,
        height,
        8,
        m.standard("exterior-building", "#8b8c84", "ceramic"),
        0.04,
      );
      building.position.set(
        Math.sin(angle) * distance,
        height / 2 - 1.5,
        Math.cos(angle) * distance,
      );
      this.root.add(building);
    }
    this.batches = new StaticBatches(this.root);
  }
  dispose() {
    this.batches.dispose();
  }
  sync(state: Readonly<GameSnapshot>) {
    const size = state.size, revision = state.coverRevision ?? 0;
    let changed = revision !== this.coverRevision;
    const destinations = changed ? new Map(Object.entries(state.coverOrigins ?? {}).map(([cell,id])=>[id,Number(cell)] as const)) : undefined;
    for (const [origin,previous] of this.crates) {
      const cell = destinations ? destinations.get(origin) : previous;
      if (cell === undefined || state.tiles[Math.floor(cell/size)][cell%size] !== 2) {
        this.batches.removeCell(String(origin));
        changed = true;
        this.crates.delete(origin);
      } else if (cell !== previous) {
        this.batches.translateCell(String(origin),((cell%size)-(previous%size))*TILE_SIZE,
          (Math.floor(cell/size)-Math.floor(previous/size))*TILE_SIZE);
        this.crates.set(origin,cell);
      }
    }
    if (destinations) this.batches.finishMoves();
    this.coverRevision = revision;
    return changed;
  }
}
