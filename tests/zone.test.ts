import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { RULES } from "../src/core/content";
import { MAPS } from "../src/core/maps";
import { canPlace } from "../src/core/placement";
import { planWalls, rearrangeCover } from "../src/core/rearrange-cover";
import { Simulation } from "../src/core/simulation";
import { canBuild } from "../src/core/systems/building";
import type { Player } from "../src/core/types";
import { closingRings, ringClosesAt, ringOf, ZONE, zoneAt, zoneWallInset } from "../src/core/zone";
import { Arena, TILE_SIZE, world } from "../src/render/arena";
import type { Models } from "../src/render/models";
import { ZoneWalls } from "../src/render/zone-walls";

function match(mapId = MAPS[0].id, seed = 42) {
  const sim = new Simulation({ mapId, seed, zombieRate: "off" });
  sim.state.phase = "playing";
  const middle = (sim.state.size - 1) / 2;
  // The fixture's idle opponents stand here; some maps can generate a wall at their centre.
  sim.state.tiles[middle][middle] = 0;
  delete sim.state.wallOrigins?.[middle * sim.state.size + middle];
  for (const p of sim.state.players) Object.assign(p, { x: middle, z: middle, hp: 10000 });
  return sim;
}

function at(sim: Simulation, time: number) {
  sim.state.time = time - RULES.step;
  sim.step(RULES.step, new Map());
}

function footprintOpen(sim: Simulation, p: Player) {
  for (const dx of [-RULES.playerRadius, RULES.playerRadius])
    for (const dz of [-RULES.playerRadius, RULES.playerRadius])
      assert.equal(sim.state.tiles[Math.round(p.z + dz)][Math.round(p.x + dx)], 0);
}

test("demolition clears collision and metadata before the wall moves, leaving deeper cover intact", () => {
  const sim = match(),
    s = sim.state,
    middle = (s.size - 1) / 2;
  const deadline = ringClosesAt(s.size, 1, s.duration);
  const cells = [middle * s.size + 1, middle * s.size + 2];
  s.tiles[middle][1] = 1;
  s.tiles[middle][2] = 2;
  s.tiles[middle][3] = 2;
  s.wallOrigins = { [cells[0]]: 123 };
  s.coverOrigins = { [cells[1]]: 456 };
  s.coverDamage = { 456: 10 };
  s.builtCrates = [{ id: 999, ownerId: s.players[0].id, x: 2, z: middle, builtAt: 0 }];
  s.bombs = [
    { id: 998, ownerId: s.players[0].id, x: 2, z: middle, range: 1, detonateAt: 1000, passThrough: [] },
  ];
  at(sim, deadline - ZONE.advance - ZONE.clearance - 0.01);
  assert.equal(s.tiles[middle][1], 1);
  at(sim, deadline - ZONE.advance - ZONE.clearance + 0.01);
  assert.equal(s.zone?.closed, 0);
  assert.equal(s.zone?.clearingRing, 1);
  assert.deepEqual(s.tiles[middle].slice(1, 4), [0, 0, 2]);
  assert.deepEqual(s.wallOrigins, {});
  assert.deepEqual(s.coverOrigins, {});
  assert.deepEqual(s.coverDamage, {});
  assert.equal(s.builtCrates.length, 0);
  assert.equal(s.bombs.length, 0);
  assert.equal(
    s.events.some((e) => e.type === "cover" || e.type === "bomb"),
    false,
  );
  const p = s.players[0];
  Object.assign(p, { x: 2, z: middle });
  assert.equal(canPlace(s, p, { x: 2, z: middle }), false);
  assert.equal(canBuild(s, p, { x: 2, z: middle }), false);
  at(sim, deadline + 0.01);
  assert.deepEqual(s.tiles[middle].slice(1, 4), [1, 0, 2]);
});

test("the advancing wall carries players from all sides and corners without injury or crossing obstacles", () => {
  for (const map of MAPS) {
    for (const [sideX, sideZ] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ]) {
      const sim = match(map.id),
        s = sim.state,
        p = s.players[0],
        middle = (s.size - 1) / 2;
      const shield = sideX === 0 ? 30 : 0;
      Object.assign(p, { x: middle + sideX * (middle - 1), z: middle + sideZ * (middle - 1), hp: 1, shield });
      const deadline = ringClosesAt(s.size, 1, s.duration);
      at(sim, deadline - ZONE.advance - ZONE.clearance);
      const hp = p.hp;
      let previousX = p.x,
        previousZ = p.z;
      for (let elapsed = 0; elapsed <= ZONE.advance + RULES.step; elapsed += RULES.step) {
        at(sim, deadline - ZONE.advance + elapsed);
        footprintOpen(sim, p);
        assert.ok(Math.hypot(p.x - previousX, p.z - previousZ) < 0.1, "push stays local each tick");
        const inset = zoneWallInset(s.time, s.zone!) + RULES.playerRadius;
        assert.ok(p.x >= inset && p.z >= inset);
        assert.ok(p.x <= s.size - 1 - inset && p.z <= s.size - 1 - inset);
        previousX = p.x;
        previousZ = p.z;
      }
      assert.equal(p.hp, hp);
      assert.equal(p.alive, true);
      assert.equal(p.shield > 0, shield > 0);
      assert.equal(
        s.events.some((e) => e.type === "hurt" || e.type === "kill"),
        false,
      );
    }
  }
});

test("players cannot walk back through the moving face and can still escape inward", () => {
  const sim = match(),
    s = sim.state,
    p = s.players[0];
  p.x = 1;
  const deadline = ringClosesAt(s.size, 1, s.duration);
  at(sim, deadline - ZONE.advance / 2);
  const start = p.x;
  sim.step(RULES.step, new Map([[p.id, { moveX: -1, moveZ: 0, yaw: 0 }]]));
  assert.ok(p.x >= start);
  const pushed = p.x;
  sim.step(RULES.step, new Map([[p.id, { moveX: 1, moveZ: 0, yaw: 0 }]]));
  assert.ok(p.x > pushed);
  footprintOpen(sim, p);
});

test("terrain resets keep the escape lane clear during an advance", () => {
  const sim = match(),
    s = sim.state,
    map = MAPS.find((m) => m.id === s.mapId)!;
  at(sim, ringClosesAt(s.size, 1, s.duration) - ZONE.advance / 2);
  const plan = planWalls(s, map, () => 0.5);
  assert.ok(
    plan.rising.every((cell) => ringOf(s.size, { x: cell % s.size, z: Math.floor(cell / s.size) }) > 2),
  );
  rearrangeCover(s, map, () => 0.5, plan);
  for (let z = 1; z < s.size - 1; z++)
    for (let x = 1; x < s.size - 1; x++) if (ringOf(s.size, { x, z }) <= 2) assert.equal(s.tiles[z][x], 0);
});

test("catch-up ticks settle every ring and preserve the final safe square", () => {
  for (const map of MAPS) {
    const sim = match(map.id),
      s = sim.state;
    Object.assign(s.players[0], { x: 1, z: 1 });
    const health = s.players.map((p) => p.hp);
    at(sim, s.duration);
    assert.equal(s.zone?.closed, closingRings(s.size));
    assert.deepEqual(
      s.players.map((p) => p.hp),
      health,
    );
    for (const p of s.players) footprintOpen(sim, p);
    const middle = (s.size - 1) / 2;
    for (let z = middle - 1; z <= middle + 1; z++)
      for (let x = middle - 1; x <= middle + 1; x++) assert.equal(s.tiles[z][x], 0);
  }
});

test("the final firestorm still burns through shields and prevents healing", () => {
  const sim = match(),
    s = sim.state,
    p = s.players[0];
  at(sim, s.duration + ZONE.finalHold - 1);
  p.hp = 100;
  p.shield = 30;
  sim.step(1, new Map());
  assert.equal(s.zone?.final, true);
  assert.equal(p.hp, 100 - (ZONE.damage + ZONE.ramp));
  assert.ok(p.shield > 0, "the shield remains active but does not absorb zone fire");
  const health = p.hp;
  p.hp = 100;
  sim.step(1, new Map());
  assert.equal(p.hp, health - (ZONE.damage + ZONE.ramp));
  assert.ok(s.events.some((e) => e.type === "hurt" && !e.blocked));
});

// Exercise the actual instanced renderer without requiring a browser or GPU.
function models() {
  const material = new THREE.MeshBasicMaterial();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const group = () => new THREE.Group().add(new THREE.Mesh(geometry, material));
  return {
    materials: { standard: () => material },
    box: () => new THREE.Mesh(geometry, material),
    wall: group,
    obstacle: group,
    builtCrate: group,
  } as unknown as Models;
}

function visibleCover(arena: Arena, model: Models, size: number, x: number, z: number) {
  // The mock model gives cover a unique geometry so its batch can be inspected like a draw call.
  const geometry = model.obstacle({} as never).children[0] as THREE.Mesh;
  const matrix = new THREE.Matrix4();
  return arena.root.children.some((object) => {
    if (!(object instanceof THREE.InstancedMesh) || object.geometry !== geometry.geometry) return false;
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix);
      if (
        matrix.elements[0] !== 0 &&
        Math.abs(matrix.elements[12] - world(x, size)) < 1e-4 &&
        Math.abs(matrix.elements[14] - world(z, size)) < 1e-4 &&
        Math.abs(matrix.elements[13]) < 1e-4
      )
        return true;
    }
    return false;
  });
}

test("zone revisions preserve visible cover with implicit origins and remove demolished cover", () => {
  const sim = match(),
    s = sim.state,
    middle = (s.size - 1) / 2;
  s.tiles[middle][2] = 2;
  s.tiles[middle][3] = 2;
  s.tiles[middle][4] = 0;
  // Unique geometry prevents floor/wall instances from satisfying the cover visibility assertion.
  const model = models(),
    coverGeometry = new THREE.BoxGeometry(0.9, 1, 0.9);
  model.obstacle = () => new THREE.Group().add(new THREE.Mesh(coverGeometry, new THREE.MeshBasicMaterial()));
  const arena = new Arena(model, s);
  assert.ok(visibleCover(arena, model, s.size, 3, middle));
  at(sim, ringClosesAt(s.size, 1, s.duration) - ZONE.advance - ZONE.clearance + 0.01);
  arena.sync(s);
  assert.ok(visibleCover(arena, model, s.size, 3, middle), "live cover must not become invisible");
  assert.equal(visibleCover(arena, model, s.size, 2, middle), false);
  assert.equal(s.tiles[middle][3], 2);
  at(sim, ringClosesAt(s.size, 1, s.duration) + 0.01);
  arena.sync(s);
  assert.ok(visibleCover(arena, model, s.size, 3, middle));
  const origin = middle * s.size + 3;
  s.tiles[middle][3] = 0;
  s.tiles[middle][4] = 2;
  s.coverOrigins = { [middle * s.size + 4]: origin };
  s.coverRevision = (s.coverRevision ?? 0) + 1;
  arena.sync(s);
  assert.equal(visibleCover(arena, model, s.size, 3, middle), false);
  assert.ok(visibleCover(arena, model, s.size, 4, middle), "explicit origins still relocate cover");
  arena.dispose();
});

test("boundary instances slide horizontally from the outer ring with the collision face", () => {
  const originalDocument = globalThis.document;
  const context = {
    ...Object.fromEntries(
      [
        "fillRect",
        "save",
        "beginPath",
        "rect",
        "clip",
        "stroke",
        "moveTo",
        "lineTo",
        "restore",
        "strokeRect",
      ].map((name) => [name, () => {}]),
    ),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  try {
    const sim = match(),
      s = sim.state,
      parent = new THREE.Group();
    const walls = new ZoneWalls(parent, models());
    const deadline = ringClosesAt(s.size, 1, s.duration);
    const matrix = new THREE.Matrix4();
    for (const progress of [0, 0.25, 0.5, 0.75, 0.99, 1]) {
      s.time = deadline - ZONE.advance * (1 - progress);
      s.zone = zoneAt(s.size, s.time, s.duration);
      walls.sync(s, false, new Set());
      const mesh = parent.children.find(
        (object) => object instanceof THREE.InstancedMesh && object.castShadow,
      ) as THREE.InstancedMesh;
      assert.ok(mesh.count <= mesh.instanceMatrix.count);
      let nearestFace = Infinity;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        assert.equal(matrix.elements[13], 0, "wall stays above ground throughout its advance");
        if (Math.abs(matrix.elements[14]) < 1e-4) nearestFace = Math.min(nearestFace, matrix.elements[12]);
      }
      assert.ok(Math.abs(nearestFace - world(progress, s.size)) < 1e-4);
      assert.ok(
        Math.abs(nearestFace / TILE_SIZE + (s.size - 1) / 2 + 0.5 - zoneWallInset(s.time, s.zone)) < 1e-4,
      );
    }
    walls.dispose();
  } finally {
    globalThis.document = originalDocument;
  }
});
