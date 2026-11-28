import { ITEMS, RULES, perkById } from "../core/content";
import { cycleEquipment } from "../core/equipment";
import { aimCell, canLob } from "../core/placement";
import { idleInput, inTacticalView } from "../core/types";
import { bindings, type Action } from "../input/bindings";
import type {
  AgentContext,
  Equipment,
  GameSnapshot,
  ItemId,
  PerkId,
  Player,
  PlayerAgent,
  PlayerInput,
  SkillId,
  Vec2,
} from "../core/types";

/** A refused pointer lock is retried this often, to outlast the browser's cooldown after Esc. */
const LOCK_RETRY_MS = 200;
const LOCK_ATTEMPTS = 10;

const BOARD_ARROWS: Readonly<Record<string, Action | undefined>> = {
  ArrowUp: "forward",
  ArrowDown: "back",
  ArrowLeft: "left",
  ArrowRight: "right",
};
const BOARD_DIRECTIONS = {
  forward: [0, -1, 0],
  back: [0, 1, Math.PI],
  left: [-1, 0, Math.PI / 2],
  right: [1, 0, -Math.PI / 2],
} as const;

interface Shot {
  yaw: number;
  pitch: number;
}
/** Seconds a bomb press survives while no bomb slot is free. */
const PLACE_BUFFER = 0.18;

export class KeyboardAgent implements PlayerAgent {
  yaw = -Math.PI / 2;
  pitch = 0;
  enabled = false;
  private wheelOpen = false;
  private keys = new Set<string>();
  private boardMode = false;
  private boardYaw = 0;
  private plantHere = false;
  private buildRequested?: Shot;
  private shot?: Shot;
  private pendingPlace?: { shot: Shot; until: number };
  private queuedSwing?: Equipment;
  private jump = false;
  private resetTerrain = false;
  private activePerk?: PerkId;
  private perkTarget?: Vec2;
  /** Called instead of queueing when a perk needs a cell picked first. */
  onTargetedPerk?: (id: PerkId) => void;
  /** Asked before a press of the use key fires: true when something in the world took the click. */
  onUse?: () => boolean;
  private perkInventory: readonly string[] = [];
  private perkCursor?: PerkId;
  private wheelSteps = 0;
  private selectedEquipment?: Equipment;
  private submittedEquipment?: { id: Equipment; time: number };
  private lastScroll = -Infinity;
  private skill?: SkillId;
  private supply?: ItemId;
  private dragging = false;
  private escapeHeld = false;
  /** True from a lock request until the browser grants it or control is handed away. */
  private lockWanted = false;
  private lockAttempts = 0;
  private lockRetry?: ReturnType<typeof setTimeout>;
  private pointer = { x: 0, y: 0 };
  private listeners = new AbortController();
  constructor(
    readonly playerId: string,
    private canvas: HTMLCanvasElement,
  ) {
    const signal = this.listeners.signal;
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape") this.escapeHeld = true;
        else this.relockOnGesture();
        if (
          !this.enabled ||
          e.isComposing ||
          e.target instanceof HTMLInputElement ||
          e.ctrlKey ||
          e.metaKey ||
          e.altKey
        )
          return;
        if (this.handlePerkKey(e)) return;
        if (this.boardMode && (e.code === "Space" || BOARD_ARROWS[e.code])) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) {
            if (e.code === "Space") this.plantHere = true;
            else this.keys.add(e.code);
          }
          return;
        }
        if (bindings.action(e.code)) {
          e.preventDefault();
          if (!e.repeat) this.press(e.code);
        }
      },
      { capture: true, signal },
    );
    window.addEventListener(
      "keyup",
      (e) => {
        this.keys.delete(e.code);
        if (e.code !== "Escape") return;
        this.escapeHeld = false;
        if (this.lockWanted && this.enabled) this.tryLock();
        else this.cancelLock();
      },
      { signal },
    );
    window.addEventListener(
      "blur",
      () => {
        this.escapeHeld = false;
        this.clear();
      },
      { signal },
    );
    window.addEventListener(
      "mousemove",
      (e) => {
        if (!this.enabled || this.boardMode || this.selectingWheel) return;
        if (document.pointerLockElement === canvas) this.look(e.movementX, e.movementY);
        else if (this.dragging) {
          this.look(e.clientX - this.pointer.x, e.clientY - this.pointer.y);
          this.pointer = { x: e.clientX, y: e.clientY };
        }
      },
      { signal },
    );
    window.addEventListener("mousedown", () => this.relockOnGesture(), { capture: true, signal });
    document.addEventListener(
      "pointerlockchange",
      () => {
        if (document.pointerLockElement === canvas) this.cancelLock();
      },
      { signal },
    );
    document.addEventListener("pointerlockerror", () => this.retryLockSoon(), { signal });
    canvas.addEventListener(
      "mousedown",
      (e) => {
        if (this.enabled && !this.selectingWheel) {
          const code = "Mouse" + e.button;
          if (!this.boardMode || bindings.action(code) === "build") this.press(code);
          // The overhead view has no use for the click itself, but the world may.
          else if (bindings.action(code) === "use") this.onUse?.();
          if (!this.boardMode && e.button === 1 && !bindings.action(code)) this.dragging = true;
          this.pointer = { x: e.clientX, y: e.clientY };
        }
      },
      { signal },
    );
    window.addEventListener(
      "mouseup",
      (e) => {
        this.keys.delete("Mouse" + e.button);
        if (e.button === 1) this.dragging = false;
      },
      { signal },
    );
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.enabled || !e.deltaY) return;
        e.preventDefault();
        this.scrollEquipment(e.deltaY, e.timeStamp);
      },
      { signal, passive: false },
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), {
      signal,
    });
  }
  private look(dx: number, dy: number) {
    this.yaw -= dx * 0.0023;
    this.pitch = Math.max(-1.48, Math.min(1.15, this.pitch - dy * 0.0023));
  }
  private held(action: Action) {
    for (const code of this.keys) {
      const binding = (this.boardMode ? BOARD_ARROWS[code] : undefined) ?? bindings.action(code);
      if (binding === action) return true;
    }
    return false;
  }
  /**
   * -1, 0 or +1 for a pair of opposing actions. When both are held the most recent press wins,
   * so tapping the other direction turns around instead of stopping.
   */
  private axis(positive: Action, negative: Action) {
    let value = 0;
    // The key set keeps press order: later entries override earlier ones.
    for (const code of this.keys) {
      const binding = (this.boardMode ? BOARD_ARROWS[code] : undefined) ?? bindings.action(code);
      if (binding === positive) value = 1;
      else if (binding === negative) value = -1;
    }
    return value;
  }
  /**
   * A bomb press made while every bomb slot is in use is kept for PLACE_BUFFER seconds and fires
   * as soon as a slot frees up, so a press a moment before a blast is not swallowed.
   */
  private bufferedShot(self: Player, state: Readonly<GameSnapshot>, selected: string) {
    const slotFree = () =>
      state.bombs.filter((bomb) => bomb.ownerId === self.id && bomb.source !== "throwable" && !bomb.seized)
        .length < self.capacity;
    const playing = self.alive && state.phase === "playing" && selected === "bomb";
    if (this.shot) {
      this.pendingPlace =
        playing && !slotFree() ? { shot: this.shot, until: state.time + PLACE_BUFFER } : undefined;
      return this.shot;
    }
    const pending = this.pendingPlace;
    if (!pending) return undefined;
    if (!playing || state.time > pending.until) this.pendingPlace = undefined;
    else if (slotFree()) {
      this.pendingPlace = undefined;
      return pending.shot;
    }
    return undefined;
  }
  get topDown() {
    return this.boardMode;
  }
  get selectedPerk() {
    if (this.perkCursor && this.perkInventory.includes(this.perkCursor)) return this.perkCursor;
    return this.perkInventory.find((id) => perkById(id)?.use);
  }
  /** The cycle key steps to the next usable perk; the use key fires the selected one. */
  private handlePerkKey(e: KeyboardEvent) {
    const selected = this.selectedPerk;
    if (!selected) return false;
    const action = bindings.action(e.code);
    if (action === "usePerk") {
      if (!e.repeat) this.queuePerk(selected);
    } else if (action === "browsePerks") {
      const ids = [...new Set(this.perkInventory.filter((id) => perkById(id)?.use))];
      if (!e.repeat) this.perkCursor = ids[(ids.indexOf(selected) + 1) % ids.length];
    } else return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    return true;
  }
  setTopDown(active: boolean) {
    if (active === this.boardMode) return;
    this.boardMode = active;
    this.boardYaw = this.yaw;
    this.plantHere = this.jump = this.dragging = false;
    this.buildRequested = undefined;
    this.shot = this.queuedSwing = undefined;
    this.pendingPlace = undefined;
    this.selectedEquipment = this.submittedEquipment = undefined;
    this.wheelSteps = 0;
    for (const key of this.keys) {
      if (key.startsWith("Mouse") || key === "Space" || (!active && BOARD_ARROWS[key])) this.keys.delete(key);
    }
  }
  get selectingWheel() {
    return this.wheelOpen;
  }
  set selectingWheel(active: boolean) {
    if (active) {
      this.buildRequested = undefined;
      this.pendingPlace = undefined;
      this.shot = this.queuedSwing = undefined;
    }
    this.wheelOpen = active;
  }
  beginWheel() {
    this.selectingWheel = true;
    this.wheelSteps = 0;
  }
  private press(code: string) {
    const action = bindings.action(code);
    if (!action) return;
    if (action.startsWith("skill:")) {
      this.queueSkill(action.slice("skill:".length));
      return;
    }
    if (action === "use" && !this.selectingWheel && this.onUse?.()) return;
    this.keys.add(code);
    if (action === "resetTerrain") this.resetTerrain = true;
    if (action === "build" && !this.selectingWheel)
      this.buildRequested = { yaw: this.yaw, pitch: this.pitch };
    if (this.boardMode) return;
    if (action === "jump") this.jump = true;
    if (action === "use" && !this.selectingWheel) this.shot = { yaw: this.yaw, pitch: this.pitch };
    if (action === "previous" || action === "next") {
      this.shot = undefined;
      this.wheelSteps += action === "next" ? 1 : -1;
    }
  }
  queueEquipment(id: Equipment) {
    this.shot = undefined;
    this.selectedEquipment = id;
    this.wheelSteps = 0;
  }
  scrollEquipment(delta: number, time: number) {
    if (!this.enabled || this.boardMode || this.selectingWheel || !delta || time - this.lastScroll < 90)
      return;
    const action = bindings.action(delta < 0 ? "WheelUp" : "WheelDown");
    if (action !== "previous" && action !== "next") return;
    this.shot = undefined;
    this.lastScroll = time;
    this.wheelSteps += action === "next" ? 1 : -1;
  }
  /** Ask the supply shop for one unit; sent with the next input. */
  queueSupply(item: ItemId) {
    this.supply = item;
  }
  queueSkill(skill: SkillId) {
    this.skill = skill;
  }
  /** Targeted perks open the targeting tablet first and come back here with the picked cell. */
  queuePerk(id: PerkId, target?: Vec2) {
    if (perkById(id)?.targeted && !target) {
      this.onTargetedPerk?.(id);
      return;
    }
    this.activePerk = id;
    this.perkTarget = target;
  }
  /**
   * Captures the mouse for first-person aiming. Browsers refuse the request outside a user
   * gesture and for about a second after Esc released the lock, so a refused request is retried
   * for a while and then again on the next key press or click, until it succeeds or `clear()`.
   */
  lockPointer() {
    this.lockWanted = true;
    this.lockAttempts = 0;
    this.tryLock();
  }
  private tryLock() {
    clearTimeout(this.lockRetry);
    this.lockRetry = undefined;
    if (!this.lockWanted) return;
    if (document.pointerLockElement === this.canvas) return this.cancelLock();
    // Escape's browser default releases pointer lock. Reacquire only after that press ends,
    // otherwise resuming a menu immediately produces another unlock and pauses again.
    // The overhead view and the wheel leave the pointer free; a later gesture tries again.
    if (this.escapeHeld || this.boardMode || this.selectingWheel || !document.hasFocus()) return;
    this.lockAttempts++;
    try {
      // Older engines return nothing and report failure through `pointerlockerror` instead.
      const request = this.canvas.requestPointerLock() as Promise<void> | undefined;
      request?.catch(() => this.retryLockSoon());
    } catch {
      this.retryLockSoon();
    }
  }
  private retryLockSoon() {
    if (!this.lockWanted || this.lockRetry !== undefined || this.lockAttempts >= LOCK_ATTEMPTS) return;
    this.lockRetry = setTimeout(() => {
      this.lockRetry = undefined;
      if (this.enabled) this.tryLock();
      else this.cancelLock();
    }, LOCK_RETRY_MS);
  }
  /** A key press or click carries the user activation a refused request was missing. */
  private relockOnGesture() {
    if (!this.lockWanted) return;
    if (!this.enabled) return this.cancelLock();
    this.lockAttempts = 0;
    this.tryLock();
  }
  private cancelLock() {
    this.lockWanted = false;
    clearTimeout(this.lockRetry);
    this.lockRetry = undefined;
  }
  clear() {
    this.cancelLock();
    this.plantHere = false;
    this.buildRequested = undefined;
    this.resetTerrain = false;
    this.jump = false;
    this.activePerk = this.perkTarget = undefined;
    this.keys.clear();
    this.submittedEquipment = undefined;
    this.selectedEquipment = undefined;
    this.wheelSteps = 0;
    this.shot = undefined;
    this.pendingPlace = undefined;
    this.queuedSwing = undefined;
    this.skill = undefined;
    this.dragging = false;
  }
  reset() {
    this.clear();
    this.setTopDown(false);
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
  }
  decide({ dt, self, state }: AgentContext): PlayerInput {
    this.perkInventory = self.perks;
    if (!this.selectedPerk) this.perkCursor = undefined;
    this.setTopDown(self.alive && inTacticalView(self, state.time));
    if (!this.enabled) return idleInput(this.yaw);
    const building = !!this.buildRequested && self.alive && state.phase === "playing" && !this.selectingWheel;
    const shared: Partial<PlayerInput> = {
      resetTerrain: this.resetTerrain && state.canResetTerrain && state.phase === "playing",
      usePerk: this.activePerk,
      perkTarget: this.perkTarget,
      sprint: this.held("sprint"),
      activateSkill: this.skill,
      buyItem: this.supply,
      build: building,
      // Aimed exactly like a planted charge. The top-down view has no aim: the cell ahead it is.
      buildTarget:
        building && !this.boardMode
          ? aimCell(self, this.buildRequested!.yaw, this.buildRequested!.pitch, "bomb", state.time)
          : undefined,
    };
    this.resetTerrain = false;
    this.buildRequested = undefined;
    this.skill = this.activePerk = this.supply = this.perkTarget = undefined;
    if (this.boardMode) {
      // Both axes go out; the latest direction pressed is the one to try first and to face, the
      // other is the fallback, so a turn held early is taken as soon as the opening comes up.
      let preferAxis: "x" | "z" | undefined;
      // Set iteration keeps press order: the last direction found is the latest held.
      for (const key of this.keys) {
        const action = BOARD_ARROWS[key] ?? bindings.action(key);
        if (action === "left" || action === "right" || action === "forward" || action === "back") {
          this.boardYaw = BOARD_DIRECTIONS[action][2];
          preferAxis = BOARD_DIRECTIONS[action][0] ? "x" : "z";
        }
      }
      const moveX = this.axis("right", "left"),
        moveZ = this.axis("back", "forward");
      const plantHere = this.plantHere;
      this.plantHere = false;
      return { ...shared, moveX, moveZ, preferAxis, yaw: this.boardYaw, plantHere };
    }
    const forward = this.axis("forward", "back");
    const right = this.axis("right", "left");
    this.yaw += (Number(this.held("turnLeft")) - Number(this.held("turnRight"))) * dt * 1.9;
    const movementYaw = this.yaw;
    // More than one render frame can submit input before the next simulation step.
    const previous = this.submittedEquipment;
    const current = previous?.time === state.time ? previous.id : self.equipped;
    const equip = this.wheelSteps
      ? cycleEquipment(self, this.wheelSteps, this.selectedEquipment ?? current)
      : this.selectedEquipment;
    if (equip) this.submittedEquipment = { id: equip, time: state.time };
    this.selectedEquipment = undefined;
    const selected = equip ?? current;
    const shot = this.bufferedShot(self, state, selected);
    const melee = ITEMS[selected]?.melee;
    let use = !!shot && !this.selectingWheel && self.alive && state.phase === "playing";
    if (this.selectingWheel || !self.alive || state.phase !== "playing" || selected !== this.queuedSwing)
      this.queuedSwing = undefined;
    if (melee && !this.selectingWheel && self.alive && state.phase === "playing") {
      const remaining = (self.cooldowns["equipment:" + selected] ?? 0) - state.time;
      if (remaining <= RULES.step) {
        use = use || this.queuedSwing === selected;
        this.queuedSwing = undefined;
      } else {
        if (shot && remaining <= (melee.inputBuffer ?? 0)) this.queuedSwing = selected;
        use = false;
      }
    }
    const throwMode = canLob(selected) ? ("lob" as const) : ("direct" as const);
    this.wheelSteps = 0;
    const input: PlayerInput = {
      ...shared,
      equip,
      jump: this.jump,
      moveX: -Math.sin(movementYaw) * forward + Math.cos(movementYaw) * right,
      moveZ: -Math.cos(movementYaw) * forward - Math.sin(movementYaw) * right,
      yaw: this.yaw,
      useEquipment: use,
      meleeYaw: use && melee ? (shot?.yaw ?? this.yaw) : undefined,
      throwMode,
      aimTarget:
        shot && (selected === "bomb" || ITEMS[selected]?.throwable)
          ? aimCell(self, shot.yaw, shot.pitch, selected, state.time, throwMode, state.size)
          : undefined,
    };
    this.jump = false;
    this.shot = undefined;
    return input;
  }
  dispose() {
    this.cancelLock();
    this.listeners.abort();
  }
}
