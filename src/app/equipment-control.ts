import type { KeyboardAgent } from "../agents/keyboard-agent";
import type { Sound } from "../audio/sound";
import { canEquip } from "../core/equipment";
import type { Equipment, Player } from "../core/types";
import type { EquipmentWheel } from "../ui/equipment-wheel";

export interface EquipmentControlDeps {
  keyboard: KeyboardAgent;
  wheel: EquipmentWheel;
  sound: Sound;
  /** True while key presses drive the player. */
  canAct(): boolean;
  viewer(): Player | undefined;
  matchOver(): boolean;
}

/**
 * Switching equipment from outside the simulation: the hold-and-drag wheel and the quick-equip
 * keys. It only queues an `equip` intent on the keyboard agent; the simulation validates it.
 */
export class EquipmentControl {
  /** Key that opened the wheel; releasing it commits the selection. */
  private wheelKey?: string;

  constructor(private readonly deps: EquipmentControlDeps) {}

  /** Opens the wheel; `code` is the key whose release commits it. */
  beginWheel(code: string) {
    const { keyboard, wheel, sound } = this.deps;
    if (keyboard.topDown || keyboard.selectingWheel) return;
    keyboard.beginWheel();
    this.wheelKey = code;
    wheel.beginDrag();
    sound.menu();
  }

  moveWheel(dx: number, dy: number) {
    const { keyboard, wheel, sound } = this.deps;
    if (keyboard.selectingWheel && wheel.moveDrag(dx, dy)) sound.selectionTick();
  }

  /** Commits the wheel selection when `code` is the key that opened it. */
  releaseKey(code: string) {
    if (code === this.wheelKey) this.closeWheel(true);
  }

  /** Closes the wheel, equipping the hovered slot when `commit` is set. */
  closeWheel(commit = false) {
    const { keyboard, wheel } = this.deps;
    if (!keyboard.selectingWheel) return;
    const id = wheel.endDrag();
    keyboard.selectingWheel = false;
    this.wheelKey = undefined;
    if (commit && id) this.equip(id);
  }

  quickEquip(id: Equipment) {
    this.closeWheel();
    this.equip(id);
  }

  private equip(id: Equipment) {
    const { keyboard, sound } = this.deps;
    if (!this.deps.canAct() || keyboard.selectingWheel) return;
    const viewer = this.deps.viewer();
    if (this.deps.matchOver() || !viewer?.alive || !canEquip(viewer, id)) return;
    // Re-selecting the equipped item changes nothing in the simulation, so confirm it audibly here.
    if (id === viewer.equipped) sound.confirmEquipment();
    keyboard.queueEquipment(id);
  }
}
