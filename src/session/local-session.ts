import { RULES } from "../core/content";
import { Simulation } from "../core/simulation";
import type { GameSnapshot, MatchOptions, MatchSession, PlayerAgent, PlayerInput, Vec2 } from "../core/types";

/** Local authority. Network transports can implement MatchSession independently. */
export class LocalMatchSession implements MatchSession {
  private simulation: Simulation;
  private agents = new Map<string, PlayerAgent>();
  private pending = new Map<string, PlayerInput>();
  private accumulator = 0;
  private previousZombies = new Map<number, Vec2>();
  private previousPlayers = new Map<string, { x: number; z: number; yaw: number; elevation: number }>();
  private previousTime = 0;
  constructor(options: MatchOptions) {
    this.simulation = new Simulation(options);
  }
  setAgents(agents: PlayerAgent[]) {
    this.agents = new Map(agents.map((a) => [a.playerId, a]));
  }
  submit(playerId: string, input: PlayerInput) {
    const prior = this.pending.get(playerId);
    this.pending.set(playerId, {
      ...input,
      jump: !!(prior?.jump || input.jump),
      resetTerrain: !!(prior?.resetTerrain || input.resetTerrain),
      build: !!(prior?.build || input.build),
      buildTarget: input.build ? input.buildTarget : prior?.buildTarget,
      useEquipment: !!(prior?.useEquipment || input.useEquipment),
      plantHere: !!(prior?.plantHere || input.plantHere),
      meleeYaw: input.useEquipment ? input.meleeYaw : prior?.meleeYaw,
      aimTarget: input.useEquipment ? input.aimTarget : prior?.aimTarget,
      throwMode: input.useEquipment ? input.throwMode : prior?.throwMode,
      equip: input.equip ?? prior?.equip,
      activateSkill: input.activateSkill ?? prior?.activateSkill,
      choosePerk: input.choosePerk ?? prior?.choosePerk,
      usePerk: input.usePerk ?? prior?.usePerk,
      // A display faster than the 60 Hz simulation submits several inputs per step: these edges
      // must survive the later, empty ones or the purchase or the strike is silently dropped.
      perkTarget: input.usePerk ? input.perkTarget : prior?.perkTarget,
      buyItem: input.buyItem ?? prior?.buyItem,
    });
  }
  advance(dt: number) {
    // A zero-length advance applies upgrade choices without moving the world.
    if (dt === 0) {
      this.simulation.step(0, this.pending);
      this.pending.clear();
      return;
    }
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= RULES.step) {
      const state = this.simulation.state;
      const inputs = new Map(this.pending);
      for (const [id, agent] of this.agents) {
        const self = state.players.find((p) => p.id === id);
        if (self?.alive) inputs.set(id, agent.decide({ self, state, dt: RULES.step }));
      }
      this.previousTime = state.time;
      const coverRevision = state.coverRevision;
      for (const p of state.players)
        this.previousPlayers.set(p.id, { x: p.x, z: p.z, yaw: p.yaw, elevation: p.elevation });
      this.previousZombies.clear();
      for (const zombie of state.zombies) this.previousZombies.set(zombie.id, { x: zombie.x, z: zombie.z });
      this.simulation.step(RULES.step, inputs);
      if (state.coverRevision !== coverRevision) {
        this.pending.clear();
        for (const agent of this.agents.values()) agent.reset?.();
      }
      // Action buttons are edges; multiple catch-up steps must not repeat them.
      for (const [id, input] of this.pending)
        this.pending.set(id, {
          ...input,
          equip: undefined,
          buySkill: undefined,
          buyItem: undefined,
          refundSkill: undefined,
          jump: false,
          resetTerrain: false,
          build: false,
          useEquipment: false,
          plantHere: false,
          aimTarget: undefined,
          throwMode: undefined,
          meleeYaw: undefined,
          activateSkill: undefined,
          choosePerk: undefined,
          usePerk: undefined,
          perkTarget: undefined,
        });
      this.accumulator -= RULES.step;
    }
  }
  getSnapshot(): Readonly<GameSnapshot> {
    return this.simulation.state;
  }
  getRenderSnapshot(): Readonly<GameSnapshot> {
    const state = this.simulation.state;
    const alpha = Math.max(0, Math.min(1, this.accumulator / RULES.step));
    return {
      ...state,
      time: this.previousTime + (state.time - this.previousTime) * alpha,
      players: state.players.map((p) => {
        const before = this.previousPlayers.get(p.id);
        if (!before) return p;
        const turn = Math.atan2(Math.sin(p.yaw - before.yaw), Math.cos(p.yaw - before.yaw));
        return {
          ...p,
          x: before.x + (p.x - before.x) * alpha,
          z: before.z + (p.z - before.z) * alpha,
          elevation: before.elevation + (p.elevation - before.elevation) * alpha,
          yaw: before.yaw + turn * alpha,
        };
      }),
      zombies: state.zombies.map((zombie) => {
        const before = this.previousZombies.get(zombie.id);
        return before
          ? {
              ...zombie,
              x: before.x + (zombie.x - before.x) * alpha,
              z: before.z + (zombie.z - before.z) * alpha,
            }
          : zombie;
      }),
    };
  }
  restart(options: MatchOptions) {
    this.simulation = new Simulation(options);
    this.accumulator = 0;
    this.previousPlayers.clear();
    this.previousZombies.clear();
    this.previousTime = 0;
    this.pending.clear();
    for (const a of this.agents.values()) a.reset?.();
  }
  dispose() {
    for (const a of this.agents.values()) a.dispose?.();
    this.agents.clear();
    this.pending.clear();
  }
}
