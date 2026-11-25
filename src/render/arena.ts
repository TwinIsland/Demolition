import * as THREE from "three";
import { MAPS } from "../core/maps";
import { coverLayout } from "../core/cover-layout";
import { TILE_SIZE } from "../core/geometry";
import type { GameSnapshot } from "../core/types";
import type { Models } from "./models";
import { StaticBatches } from "./static-batches";
export { TILE_SIZE };
export const world = (value: number, size: number) => (value - (size - 1) / 2) * TILE_SIZE;

/** A relocated permanent wall sinks into the floor, travels underneath and rises at its new cell. */
const WALL_SINK = 0.32;
const WALL_RISE = 0.45;
const WALL_DEPTH = 2.75;
const WALL_REMOVE = 0.5;
interface WallMove {
  key: string;
  dx: number;
  dz: number;
  cell: number;
  start: number;
  lift: number;
  shifted: boolean;
}

/** A crate a player built during the match, as published in the snapshot. */
interface BuiltCrate {
  id: number;
  x: number;
  z: number;
  ownerId: string;
}
const builtCrates = (state: Readonly<GameSnapshot>) =>
  (state as Readonly<GameSnapshot> & { builtCrates?: readonly BuiltCrate[] }).builtCrates ?? [];

export class Arena {
  private built = new Map<number, { model: THREE.Group; x: number; z: number; ownerId: string }>();
  private batches: StaticBatches;
  readonly root = new THREE.Group();
  private crates = new Map<number, number>();
  /** Permanent walls a terrain reset can move: wall id to its current cell. */
  private walls = new Map<number, number>();
  private wallMoves: WallMove[] = [];
  /** Walls the simulation removed, sinking out of sight before their instances are hidden. */
  private wallSinks: { key: string; start: number; lift: number }[] = [];
  /** Cells whose map-defined wall is still drawn by the arena. */
  readonly fixedWalls = new Set<number>();
  /** Cells where a relocated wall has not finished rising yet. */
  readonly wallLandings = new Set<number>();
  private coverRevision: number;
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
    const playerBuilt = new Set(builtCrates(state).map((crate) => crate.z * size + crate.x));
    this.coverRevision = state.coverRevision ?? 0;
    const base = models.box(width + 0.55, 1.5, width + 0.55, m.standard("platform", "#282c2b", "metal"), 0.3);
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
          const id = state.wallOrigins?.[z * size + x];
          if (id !== undefined) {
            wall.traverse((object) => {
              if (object instanceof THREE.Mesh) object.userData.destructibleCell = "wall:" + id;
            });
            this.walls.set(id, z * size + x);
          } else {
            // Fixed walls are tagged too: the closing zone can remove the ones next to its new edge.
            const cell = z * size + x;
            wall.traverse((object) => {
              if (object instanceof THREE.Mesh) object.userData.destructibleCell = "fixed:" + cell;
            });
            this.fixedWalls.add(cell);
          }
        }
        if (state.tiles[z][x] === 2 && !playerBuilt.has(z * size + x)) {
          const cell = z * size + x,
            origin = state.coverOrigins?.[cell] ?? cell;
          const { cover, rotation } = coverAt(origin % size, Math.floor(origin / size));
          const crate = models.obstacle(cover);
          crate.rotation.y = rotation;
          crate.position.set(px, 0, pz);
          this.root.add(crate);
          crate.traverse((object) => {
            if (object instanceof THREE.Mesh) object.userData.destructibleCell = String(origin);
          });
          this.crates.set(origin, cell);
        }
      }
    const terrain = models.box(240, 0.3, 240, m.standard("terrain", "#8e9287", "ceramic"), 0.01);
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
      building.position.set(Math.sin(angle) * distance, height / 2 - 1.5, Math.cos(angle) * distance);
      this.root.add(building);
    }
    this.batches = new StaticBatches(this.root);
    this.syncBuilt(state);
  }
  dispose() {
    this.batches.dispose();
    this.built.forEach(({ model }) => model.removeFromParent());
    this.built.clear();
  }
  /** Player-built crates come and go during a match, so they stay outside the static batches. */
  private syncBuilt(state: Readonly<GameSnapshot>) {
    let changed = false;
    const live = new Set<number>();
    for (const crate of builtCrates(state)) {
      live.add(crate.id);
      let entry = this.built.get(crate.id);
      if (entry && entry.ownerId !== crate.ownerId) {
        entry.model.removeFromParent();
        entry = undefined;
      }
      if (!entry) {
        const model = this.models.builtCrate(state.players.find((player) => player.id === crate.ownerId));
        entry = { model, x: NaN, z: NaN, ownerId: crate.ownerId };
        this.built.set(crate.id, entry);
        this.root.add(model);
      }
      if (entry.x !== crate.x || entry.z !== crate.z) {
        entry.model.position.set(world(crate.x, state.size), 0, world(crate.z, state.size));
        entry.x = crate.x;
        entry.z = crate.z;
        changed = true;
      }
    }
    for (const [id, { model }] of this.built) {
      if (live.has(id)) continue;
      model.removeFromParent();
      this.built.delete(id);
      changed = true;
    }
    return changed;
  }
  private finishWallMove(key: string) {
    const index = this.wallMoves.findIndex((move) => move.key === key);
    if (index < 0) return;
    const [move] = this.wallMoves.splice(index, 1);
    this.batches.translateCell(key, move.shifted ? 0 : move.dx, move.shifted ? 0 : move.dz, -move.lift);
    this.wallLandings.delete(move.cell);
  }
  /** A wall removed outright sinks into the floor; one replaced by another wall just disappears. */
  private retireWall(key: string, cell: number, state: Readonly<GameSnapshot>) {
    this.finishWallMove(key);
    if (state.tiles[Math.floor(cell / state.size)][cell % state.size] === 1) this.batches.removeCell(key);
    else this.wallSinks.push({ key, start: state.time, lift: 0 });
  }
  /** Advances wall relocations on simulation time. Returns true while any wall is still moving. */
  private animateWalls(time: number) {
    if (!this.wallMoves.length && !this.wallSinks.length) return false;
    this.wallSinks = this.wallSinks.filter((sink) => {
      const u = (time - sink.start) / WALL_REMOVE;
      if (u < 0 || u >= 1) {
        this.batches.removeCell(sink.key);
        return false;
      }
      const lift = -WALL_DEPTH * u * u;
      this.batches.translateCell(sink.key, 0, 0, lift - sink.lift);
      sink.lift = lift;
      return true;
    });
    for (const move of [...this.wallMoves]) {
      const age = time - move.start;
      if (age < 0 || age >= WALL_SINK + WALL_RISE) {
        this.finishWallMove(move.key);
        continue;
      }
      const crossing = age >= WALL_SINK && !move.shifted;
      const sunk = Math.min(1, age / WALL_SINK);
      const risen = Math.max(0, (age - WALL_SINK) / WALL_RISE);
      // Ease in while sinking, ease out with a firm stop while rising.
      const lift = age < WALL_SINK ? -WALL_DEPTH * sunk * sunk : -WALL_DEPTH * (1 - risen) ** 3;
      this.batches.translateCell(move.key, crossing ? move.dx : 0, crossing ? move.dz : 0, lift - move.lift);
      move.lift = lift;
      if (crossing) move.shifted = true;
    }
    return true;
  }
  sync(state: Readonly<GameSnapshot>) {
    const size = state.size,
      revision = state.coverRevision ?? 0;
    let changed = revision !== this.coverRevision;
    const destinations = changed
      ? new Map(Object.entries(state.coverOrigins ?? {}).map(([cell, id]) => [id, Number(cell)] as const))
      : undefined;
    for (const [origin, previous] of this.crates) {
      const cell = destinations ? destinations.get(origin) : previous;
      if (cell === undefined || state.tiles[Math.floor(cell / size)][cell % size] !== 2) {
        this.batches.removeCell(String(origin));
        changed = true;
        this.crates.delete(origin);
      } else if (cell !== previous) {
        this.batches.translateCell(
          String(origin),
          ((cell % size) - (previous % size)) * TILE_SIZE,
          (Math.floor(cell / size) - Math.floor(previous / size)) * TILE_SIZE,
        );
        this.crates.set(origin, cell);
      }
    }
    if (destinations && this.walls.size) {
      const standing = new Map(
        Object.entries(state.wallOrigins ?? {}).map(([cell, id]) => [id, Number(cell)] as const),
      );
      for (const [id, previous] of this.walls) {
        const cell = standing.get(id);
        if (cell === undefined) {
          this.retireWall("wall:" + id, previous, state);
          this.walls.delete(id);
        } else if (cell !== previous) {
          this.finishWallMove("wall:" + id);
          this.wallMoves.push({
            key: "wall:" + id,
            dx: ((cell % size) - (previous % size)) * TILE_SIZE,
            dz: (Math.floor(cell / size) - Math.floor(previous / size)) * TILE_SIZE,
            cell,
            start: state.time,
            lift: 0,
            shifted: false,
          });
          this.wallLandings.add(cell);
          this.walls.set(id, cell);
        }
      }
    }
    if (destinations)
      for (const cell of this.fixedWalls)
        if (state.tiles[Math.floor(cell / size)][cell % size] !== 1) {
          this.retireWall("fixed:" + cell, cell, state);
          this.fixedWalls.delete(cell);
        }
    if (this.animateWalls(state.time)) changed = true;
    if (destinations || changed) this.batches.finishMoves();
    this.coverRevision = revision;
    if (this.syncBuilt(state)) changed = true;
    return changed;
  }
}
