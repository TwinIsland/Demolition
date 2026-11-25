import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSUMABLES, EQUIPMENT_SLOTS, ITEMS, RULES, isEquipment } from "../src/core/content";
import { BUILD, crateCost } from "../src/core/economy";
import { canEquip } from "../src/core/equipment";
import { MAPS } from "../src/core/maps";
import { Simulation } from "../src/core/simulation";
import { canBuild, cancelBuild, cellAhead } from "../src/core/systems/building";
import { SUPPLY_CATALOG, supplyRefusal } from "../src/core/systems/supply";
import { idleInput, type PlayerInput } from "../src/core/types";

function setup() {
  const sim = new Simulation({
    mapId: MAPS[0].id,
    seed: 42,
    mode: "practice",
    opponents: [],
    zombieRate: "off",
  });
  const s = sim.state,
    p = s.players[0],
    middle = (s.size - 1) / 2;
  s.phase = "playing";
  Object.assign(p, { x: middle, z: middle, credits: 200 });
  for (let z = middle - 1; z <= middle + 1; z++)
    for (let x = middle - 1; x <= middle + 1; x++) s.tiles[z][x] = 0;
  const step = (input: Partial<PlayerInput> = {}, dt: number = RULES.step) =>
    sim.step(dt, new Map([[p.id, { ...idleInput(p.yaw), ...input }]]));
  return { s, p, step };
}

test("crates cannot be carried, equipped, dropped or bought from the supply shop", () => {
  const { s, p, step } = setup();
  assert.equal(isEquipment(ITEMS.crate), false);
  assert.equal(CONSUMABLES.includes("crate"), false);
  assert.equal(EQUIPMENT_SLOTS.includes("crate"), false);
  assert.equal(SUPPLY_CATALOG.includes("crate"), false);
  assert.equal(supplyRefusal(s, p, "crate"), "unavailable");
  assert.equal(p.inventory.crate, undefined);
  p.inventory.crate = 1;
  assert.equal(canEquip(p, "crate"), false, "even stale inventory cannot re-enable crate equipment");
  step({ buyItem: "crate", equip: "crate" });
  assert.equal(p.credits, 200);
  assert.equal(p.equipped, "bomb");
});

test("building charges coins once and completes even when the payment leaves no spare coins", () => {
  const { s, p, step } = setup();
  p.credits = BUILD.cost;
  p.equipped = "knife";
  const site = cellAhead(p);
  step({ build: true });
  assert.equal(p.credits, 0);
  assert.equal(p.building?.cost, BUILD.cost);
  assert.equal(p.equipped, "knife");
  assert.equal(p.inventory.crate, undefined);
  step({ build: true });
  assert.equal(p.credits, 0, "a second request cannot charge twice during construction");
  step({}, BUILD.windup);
  assert.equal(s.tiles[site.z][site.x], 2);
  assert.equal(s.builtCrates?.length, 1);
  assert.equal(p.cratesBuilt, 1);
  assert.equal(p.building, undefined);
});

test("completed crates raise the next cost and more than three can stand at once", () => {
  const { s, p, step } = setup();
  for (const [built, yaw] of [
    [0, -Math.PI / 2],
    [1, 0],
    [2, Math.PI / 2],
    [3, Math.PI],
  ]) {
    const before = p.credits;
    step({ build: true, yaw });
    assert.equal(p.credits, before - crateCost(built));
    step({}, BUILD.windup);
  }
  assert.equal(s.builtCrates?.length, 4);
  assert.equal(p.cratesBuilt, 4);
  assert.equal(p.credits, 90);
  assert.equal(p.building, undefined);
});

test("insufficient coins and blocked cells reject construction without taking payment", () => {
  const { s, p, step } = setup();
  p.credits = BUILD.cost - 1;
  assert.equal(canBuild(s, p), false);
  step({ build: true });
  assert.equal(p.credits, BUILD.cost - 1);
  assert.equal(p.building, undefined);
  p.credits = 200;
  const site = cellAhead(p);
  s.tiles[site.z][site.x] = 1;
  step({ build: true });
  assert.equal(p.credits, 200);
  assert.equal(p.building, undefined);
});

test("movement and new obstructions refund an interrupted build without increasing its price", () => {
  for (const obstruction of [false, true]) {
    const { s, p, step } = setup();
    const site = cellAhead(p);
    step({ build: true });
    if (obstruction) s.tiles[site.z][site.x] = 1;
    else p.z += 1;
    step();
    assert.equal(p.building, undefined);
    assert.equal(p.credits, 200);
    assert.equal(p.cratesBuilt ?? 0, 0);
    assert.equal(p.inventory.crate, undefined);
    step();
    assert.equal(p.credits, 200, "refund is issued once");
  }
});

test("cancellation refunds the exact reserved price even if the build counter changes", () => {
  const { p, step } = setup();
  p.cratesBuilt = 2;
  step({ build: true });
  assert.equal(p.credits, 170);
  p.cratesBuilt = 4;
  cancelBuild(p);
  cancelBuild(p);
  assert.equal(p.credits, 200);
  assert.equal(p.inventory.crate, undefined);
});
