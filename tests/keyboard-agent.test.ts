import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { KeyboardAgent } from "../src/agents/keyboard-agent";
import { RULES } from "../src/core/content";
import { MAPS } from "../src/core/maps";
import { Simulation } from "../src/core/simulation";
import { bindings } from "../src/input/bindings";

const originalGlobals = new Map(
  ["window", "document", "HTMLInputElement"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);

function setup(t: TestContext, equipment = "grenade") {
  const win = new EventTarget(),
    canvas = new EventTarget();
  for (const [name, value] of Object.entries({
    window: win,
    document: { pointerLockElement: canvas },
    HTMLInputElement: class {},
  })) {
    const previous = originalGlobals.get(name);
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const sim = new Simulation({
    mapId: MAPS[0].id,
    seed: 42,
    mode: "practice",
    opponents: [],
    zombieRate: "off",
  });
  const s = sim.state,
    self = s.players[0],
    middle = (s.size - 1) / 2;
  s.phase = "playing";
  Object.assign(self, { equipped: equipment, x: middle, z: middle });
  self.inventory.grenade = self.inventory.smoke = 2;
  const agent = new KeyboardAgent(self.id, canvas as HTMLCanvasElement);
  agent.enabled = true;
  t.after(() => agent.dispose());
  const decide = () => agent.decide({ self, state: s, dt: RULES.step });
  function event(target: EventTarget, type: string, fields: Record<string, unknown>) {
    target.dispatchEvent(Object.assign(new Event(type), fields));
  }
  return {
    agent,
    sim,
    s,
    self,
    decide,
    down: (button = 0) => event(canvas, "mousedown", { button, clientX: 0, clientY: 0 }),
    up: (button = 0) => event(win, "mouseup", { button }),
    key: (type: string, code: string) => event(win, type, { code }),
    blur: () => win.dispatchEvent(new Event("blur")),
  };
}

test("one primary press immediately lobs toward the click aim, once, without holding or right click", (t) => {
  for (const item of ["grenade", "smoke"]) {
    const { agent, sim, s, self, decide, down, up } = setup(t, item);
    assert.equal(decide().useEquipment, false);
    assert.equal(self.inventory[item], 2);
    agent.yaw = 0;
    down();
    // The throw retains the direction of the click, even if the next frame turns the camera.
    agent.yaw = Math.PI / 2;
    const input = decide();
    assert.equal(input.useEquipment, true);
    assert.equal(input.throwMode, "lob");
    assert.deepEqual(input.aimTarget, { x: self.x, z: self.z - 4 });
    s.tiles[self.z - 1][self.x] = 1;
    s.tiles[self.z - 4][self.x] = 0;
    sim.step(RULES.step, new Map([[self.id, input]]));
    assert.equal(s.thrown.length, 1, "the default lob clears intervening walls");
    assert.equal(s.thrown[0].mode, "lob");
    assert.equal(self.inventory[item], 1);
    assert.equal(decide().useEquipment, false);
    up();
    assert.equal(decide().useEquipment, false);
  }
});

test("a quick primary click still throws when press and release happen between frames", (t) => {
  const { down, up, decide } = setup(t);
  down();
  up();
  assert.equal(decide().useEquipment, true);
  assert.equal(decide().useEquipment, false);
});

test("right click requests one paid build without changing equipment or the high-throw mode", (t) => {
  const { down, up, decide, sim, self } = setup(t);
  down(2);
  const build = decide();
  assert.equal(build.build, true);
  assert.equal(build.useEquipment, false);
  sim.step(RULES.step, new Map([[self.id, build]]));
  assert.equal(self.equipped, "grenade");
  assert.equal(self.credits, 90);
  assert.equal(sim.state.builtCrates?.length, 1);
  assert.equal(decide().build, false, "holding right click does not repeat the request");
  down();
  const input = decide();
  assert.equal(input.useEquipment, true);
  assert.equal(input.throwMode, "lob");
  up();
  up(2);
  assert.equal(decide().useEquipment, false);
});

test("right-click construction also works in the tactical view", (t) => {
  const { self, decide, down } = setup(t);
  self.tacticalView = true;
  decide();
  down(2);
  assert.equal(decide().build, true);
  assert.equal(decide().build, false);
});

test("bombs, melee and self-use equipment still act on press rather than release", (t) => {
  for (const item of ["bomb", "knife", "bandage"]) {
    const { down, up, decide, self } = setup(t, item);
    self.inventory.bandage = 1;
    down();
    assert.equal(decide().useEquipment, true);
    assert.equal(decide().useEquipment, false);
    up();
    assert.equal(decide().useEquipment, false);
  }
});

test("switching equipment, menus, focus loss, death and tactical view discard pending clicks", (t) => {
  const cancels = [
    ({ agent }: ReturnType<typeof setup>) => agent.queueEquipment("bomb"),
    ({ agent }: ReturnType<typeof setup>) => agent.scrollEquipment(1, 100),
    ({ agent }: ReturnType<typeof setup>) => {
      agent.beginWheel();
      agent.selectingWheel = false;
    },
    ({ agent }: ReturnType<typeof setup>) => {
      agent.selectingWheel = true;
      agent.selectingWheel = false;
    },
    ({ agent }: ReturnType<typeof setup>) => agent.clear(),
    ({ blur }: ReturnType<typeof setup>) => blur(),
    ({ self, decide }: ReturnType<typeof setup>) => {
      self.alive = false;
      decide();
      self.alive = true;
    },
    ({ agent }: ReturnType<typeof setup>) => {
      agent.setTopDown(true);
      agent.setTopDown(false);
    },
  ];
  for (const cancel of cancels) {
    const controls = setup(t);
    controls.down();
    cancel(controls);
    controls.up();
    assert.equal(controls.decide().useEquipment, false);
  }
});

test("a rebound use key also throws on press without waiting for release", (t) => {
  const { key, decide } = setup(t);
  assert.equal(bindings.bind("use", "KeyU"), "");
  t.after(() => bindings.reset());
  key("keydown", "KeyU");
  assert.equal(decide().useEquipment, true);
  assert.equal(decide().useEquipment, false);
  key("keyup", "KeyU");
  assert.equal(decide().useEquipment, false);
});
