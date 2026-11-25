import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/core/simulation";
import { blastCells } from "../src/core/geometry";
import { MAPS } from "../src/core/maps";
import { RULES } from "../src/core/content";
import { BotAgent } from "../src/agents/bot-agent";
import { LocalMatchSession } from "../src/session/local-session";
import { idleInput } from "../src/core/types";
import type { PlayerInput } from "../src/core/types";

function arena() {
  const sim = new Simulation({ mapId: "dream-garden", seed: 12 });
  sim.state.phase = "playing";
  sim.state.items = [];
  for (let z = 1; z < sim.state.size - 1; z++)
    for (let x = 1; x < sim.state.size - 1; x++) sim.state.tiles[z][x] = 0;
  return sim;
}
function advance(sim: Simulation, seconds: number, input?: PlayerInput) {
  for (let i = 0; i < Math.ceil(seconds / RULES.step); i++)
    sim.step(
      RULES.step,
      new Map(
        input
          ? [["you", i ? { ...input, bomb: false, skill: undefined } : input]]
          : [],
      ),
    );
}
test("blast rays stop at stone and terminate after hitting a crate", () => {
  const sim = arena();
  sim.state.tiles[3][5] = 1;
  sim.state.tiles[5][3] = 2;
  const cells = blastCells(sim.state, { x: 3, z: 3, range: 5 });
  assert(cells.some((c) => c.x === 3 && c.z === 5));
  assert(!cells.some((c) => c.x === 3 && c.z === 6));
  assert(!cells.some((c) => c.x === 5 && c.z === 3));
});
test("chain reactions remove both bombs immediately and damage once per immunity window", () => {
  const sim = arena(),
    self = sim.state.players[0];
  self.x = 3;
  self.z = 3;
  sim.state.bombs.push(
    {
      id: 100,
      x: 3,
      z: 3,
      ownerId: "you",
      range: 3,
      detonateAt: 0.01,
      passThrough: ["you"],
    },
    {
      id: 101,
      x: 5,
      z: 3,
      ownerId: "momo",
      range: 2,
      detonateAt: 99,
      passThrough: [],
    },
  );
  advance(sim, 0.3);
  assert.equal(sim.state.bombs.length, 0);
  assert.equal(self.hp, 30);
  assert(sim.state.blasts.some((b) => b.x === 7 && b.z === 3));
});
test("bomb capacity, leave-only collision and normalized diagonal movement", () => {
  const sim = arena(),
    self = sim.state.players[0];
  self.capacity = 1;
  advance(sim, 0.1, { ...idleInput(), bomb: true });
  advance(sim, 0.5, { ...idleInput(), moveX: 1 });
  assert(self.x > 2);
  assert(!sim.state.bombs[0].passThrough.includes("you"));
  advance(sim, 0.1, { ...idleInput(), bomb: true });
  assert.equal(sim.state.bombs.length, 1);
  advance(sim, 0.7, { ...idleInput(), moveX: -1 });
  assert(self.x >= 1.73);
  const other = arena();
  const p = other.state.players[0];
  advance(other, 0.5, { ...idleInput(), moveX: 10, moveZ: 10 });
  assert(Math.abs(Math.hypot(p.x - 1, p.z - 1) - p.speed * 0.5) < 0.001);
});
test("classic pickups grant stats and experience; offered perks are validated", () => {
  const sim = arena(),
    p = sim.state.players[0];
  for (let i = 0; i < 8; i++) {
    sim.state.items.push({ id: 500 + i, kind: "range", x: p.x, z: p.z });
    advance(sim, RULES.step);
  }
  assert.equal(p.range, 7);
  assert.equal(p.level, 2);
  assert.equal(p.offers.length, 3);
  sim.step(0, new Map([["you", { ...idleInput(), perk: "invalid" }]]));
  assert.equal(p.offers.length, 3);
  const offered = p.offers[0];
  sim.step(0, new Map([["you", { ...idleInput(), perk: offered }]]));
  assert.equal(p.offers.length, 0);
  assert.deepEqual(p.perks, [offered]);
});
test("surge upgrades newly planted bombs; jam targets opponents, respects cooldown and expires", () => {
  const sim = arena(),
    p = sim.state.players[0];
  advance(sim, RULES.step, { ...idleInput(), skill: "surge", bomb: true });
  assert.equal(sim.state.bombs[0].range, p.range + 2);
  advance(sim, RULES.step, { ...idleInput(), skill: "jam" });
  assert.equal(p.jammedUntil, 0);
  assert(
    sim.state.players.slice(1).every((e) => e.jammedUntil > sim.state.time),
  );
  const cooldown = p.cooldowns.jam;
  advance(sim, 1, { ...idleInput(), skill: "jam" });
  assert.equal(p.cooldowns.jam, cooldown);
  advance(sim, 6);
  assert(sim.state.players.every((e) => e.jammedUntil < sim.state.time));
});
test("last survivor wins; equal timeout scores draw; restart resets all authority state", () => {
  const sim = arena();
  sim.state.players.slice(1).forEach((p) => {
    p.alive = false;
    p.hp = 0;
  });
  advance(sim, RULES.step);
  assert.equal(sim.state.phase, "finished");
  assert.equal(sim.state.winnerId, "you");
  const tie = arena();
  tie.state.time = tie.state.duration;
  advance(tie, RULES.step);
  assert.equal(tie.state.winnerId, null);
  const session = new LocalMatchSession({ mapId: MAPS[0].id, seed: 5 });
  session.advance(0.1);
  session.restart({ mapId: MAPS[1].id, seed: 6 });
  assert.equal(session.getSnapshot().time, 0);
  assert.equal(session.getSnapshot().size, 11);
  assert.equal(session.getSnapshot().bombs.length, 0);
});
test("high-refresh inputs preserve an action until the next fixed simulation tick", () => {
  const session = new LocalMatchSession({ mapId: MAPS[0].id, seed: 5 });
  for (let i = 0; i < 190; i++) session.advance(RULES.step);
  session.submit("you", { ...idleInput(), bomb: true });
  session.advance(0.001);
  session.submit("you", idleInput());
  session.advance(RULES.step);
  assert.equal(session.getSnapshot().bombs.length, 1);
});
test("same seed and inputs produce identical simulation snapshots", () => {
  const a = new Simulation({ mapId: MAPS[0].id, seed: 55 }),
    b = new Simulation({ mapId: MAPS[0].id, seed: 55 });
  advance(a, 8, { ...idleInput(), moveX: 1 });
  advance(b, 8, { ...idleInput(), moveX: 1 });
  assert.deepEqual(a.state, b.state);
});
test("AI agents traverse the grid, collect upgrades and finish a complete four-player match", () => {
  const session = new LocalMatchSession({ mapId: MAPS[0].id, seed: 445 });
  // Four policies use the same interface, including the slot normally occupied by a human.
  const agents = ["you", "momo", "mint", "sunny"].map((id) => new BotAgent(id));
  session.setAgents(agents);
  let combatOccurred = false;
  const initialPositions = session
    .getSnapshot()
    .players.map((p) => ({ x: p.x, z: p.z }));
  const initialCrates = session
    .getSnapshot()
    .tiles.flat()
    .filter((t) => t === 2).length;
  for (
    let i = 0;
    i < 184 * 60 && session.getSnapshot().phase !== "finished";
    i++
  ) {
    session.advance(RULES.step);
    combatOccurred ||= session
      .getSnapshot()
      .events.some((e) => e.type === "hurt");
    const human = session.getSnapshot().players[0];
    // Local UI pauses for human upgrades; policies can choose them through advance(0).
    if (human.offers.length) {
      session.submit("you", { ...idleInput(), perk: human.offers[0] });
      session.advance(0);
    }
  }
  const state = session.getSnapshot();
  assert.equal(state.phase, "finished");
  assert(state.players.some((p) => p.level > 1));
  assert(combatOccurred);
  assert(
    state.players.some(
      (p, i) =>
        Math.hypot(p.x - initialPositions[i].x, p.z - initialPositions[i].z) >
        1,
    ),
  );
  assert(state.tiles.flat().filter((t) => t === 2).length < initialCrates);
});

test("enemy damage rewards XP once; self damage does not; offers do not stop time", () => {
  const sim = arena();
  const victim = sim.state.players[0],
    attacker = sim.state.players[1];
  sim.state.blasts.push({
    id: 800,
    x: victim.x,
    z: victim.z,
    ownerId: attacker.id,
    expiresAt: 10,
  });
  advance(sim, 0.1);
  assert.equal(attacker.xp, 14);
  assert.equal(victim.hp, 30);
  advance(sim, 0.1);
  assert.equal(attacker.xp, 14);
  victim.offers = ["long-wave", "light-feet", "repair"];
  const time = sim.state.time;
  advance(sim, 0.1);
  assert(sim.state.time > time);
  assert.equal(victim.offers.length, 3);
  const own = arena();
  own.state.blasts.push({ id: 900, x: 1, z: 1, ownerId: "you", expiresAt: 10 });
  advance(own, 0.1);
  assert.equal(own.state.players[0].hp, 90);
  assert.equal(own.state.players[0].xp, 0);
});

test("dimension shift holds the personal view until toggled again", () => {
  const sim = arena(),
    p = sim.state.players[0];
  p.skills = ["shift"];
  advance(sim, RULES.step, { ...idleInput(), skill: "shift" });
  advance(sim, 6);
  assert.equal(p.tacticalView, true);
  advance(sim, RULES.step, { ...idleInput(), skill: "shift" });
  assert.equal(p.tacticalView, false);
});

test("explosive warning cadence accelerates continuously on simulation time", async () => {
  const { bombWarning } = await import("../src/core/bomb-warning");
  let beat = -1,
    interval = 1;
  for (let time = 0; time <= 2.6; time += 0.01) {
    const warning = bombWarning(2.6, time);
    assert(warning.beat >= beat);
    assert(warning.interval <= interval);
    beat = warning.beat;
    interval = warning.interval;
  }
  assert.equal(bombWarning(2.6, 0).interval, 0.62);
  assert(Math.abs(bombWarning(2.6, 2.6).interval - 0.1) < 0.0001);
  assert.deepEqual(bombWarning(2.6, 1), bombWarning(2.6, 1));
});

test("Minecraft rig swings opposite legs only when position changes and stops on pause", async () => {
  const { PlayerObject } = await import("skinview3d");
  const { AvatarMotion } = await import("../src/render/avatar-motion");
  const rig = new PlayerObject(),
    motion = new AvatarMotion();
  motion.update(rig, 0, 0, 0);
  for (let i = 1; i <= 20; i++) motion.update(rig, i * 0.04, 0, i / 60);
  assert(Math.abs(rig.skin.leftLeg.rotation.x) > 0.05);
  assert(
    Math.abs(rig.skin.leftLeg.rotation.x + rig.skin.rightLeg.rotation.x) <
      0.001,
  );
  const before = rig.skin.leftLeg.rotation.x;
  motion.update(rig, 0.8, 0, 20 / 60);
  assert.equal(rig.skin.leftLeg.rotation.x, before);
  for (let i = 21; i <= 90; i++) motion.update(rig, 0.8, 0, i / 60);
  assert(Math.abs(rig.skin.leftLeg.rotation.x) < 0.001);
});
test("Minecraft skin dimensions accept modern, legacy and scaled skins", async () => {
  const { validSkinSize } = await import("../src/render/minecraft-skins");
  for (const [w, h] of [
    [64, 64],
    [64, 32],
    [128, 128],
    [128, 64],
  ])
    assert(validSkinSize(w, h));
  for (const [w, h] of [
    [63, 64],
    [64, 48],
    [32, 32],
    [2048, 2048],
  ])
    assert(!validSkinSize(w, h));
});

test("render interpolation smooths fixed ticks without modifying authority", () => {
  const session = new LocalMatchSession({ mapId: "dream-garden", seed: 7 });
  for (let i = 0; i < 200; i++) session.advance(1 / 60);
  const start = session.getSnapshot().players[0].x;
  session.submit("you", { ...idleInput(), moveX: 1 });
  session.advance(0.025);
  const current = session.getSnapshot().players[0].x,
    render = session.getRenderSnapshot().players[0].x;
  assert(current > start);
  assert(render > start && render < current);
  assert.equal(session.getSnapshot().players[0].x, current);
  session.restart({ mapId: "dream-garden", seed: 8 });
  assert.equal(session.getRenderSnapshot().players[0].x, 1);
});
test("static batching preserves transforms and removes all parts of a destroyed cell", async () => {
  const THREE = await import("three");
  const { StaticBatches } = await import("../src/render/static-batches");
  const root = new THREE.Group(),
    geometry = new THREE.BoxGeometry(1, 1, 1),
    material = new THREE.MeshStandardMaterial();
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = i * 2;
    if (i < 2) mesh.userData.destructibleCell = "1,1";
    root.add(mesh);
  }
  const batches = new StaticBatches(root);
  assert.equal(batches.sourceMeshes, 4);
  assert.equal(batches.batches.length, 1);
  const matrix = new THREE.Matrix4();
  batches.batches[0].getMatrixAt(3, matrix);
  assert.equal(matrix.elements[12], 6);
  assert(batches.removeCell("1,1"));
  for (const i of [0, 1]) {
    batches.batches[0].getMatrixAt(i, matrix);
    assert.equal(matrix.elements[0], 0);
  }
  assert(!batches.removeCell("1,1"));
  batches.batches[0].getMatrixAt(3, matrix);
  assert.equal(matrix.elements[0], 1);
  batches.dispose();
  geometry.dispose();
  material.dispose();
});
