import { field, t } from "../i18n";
import { EQUIPMENT_SLOTS, ITEMS, SKILLS } from "../core/content";
import { Setting, isRecord, jsonCodec } from "../app/storage";

export const BASIC_CONTROLS = {
  forward: ["前进", "KeyW", "ArrowUp"],
  back: ["后退", "KeyS", "ArrowDown"],
  left: ["向左移动", "KeyA"],
  right: ["向右移动", "KeyD"],
  turnLeft: ["向左转", "ArrowLeft"],
  turnRight: ["向右转", "ArrowRight"],
  sprint: ["冲刺", "ShiftLeft"],
  jump: ["跳跃", "Space"],
  use: ["使用装备 / 投掷", "Mouse0"],
  build: ["建造木箱", "Mouse2"],
  previous: ["上一件装备", "WheelUp"],
  next: ["下一件装备", "WheelDown"],
  gearWheel: ["按住拖选装备", "KeyV"],
  reward1: ["选择强化 1", "Digit1"],
  reward2: ["选择强化 2", "Digit2"],
  reward3: ["选择强化 3", "Digit3"],
  expand: ["展开强化", "Tab"],
  chat: ["打开聊天", "Enter"],
  supply: ["按住拖选补给", "KeyB"],
  resetTerrain: ["练习：重置地形", "KeyP"],
  usePerk: ["发动主动强化", "KeyT"],
  browsePerks: ["切换主动强化", "KeyG"],
  pause: ["暂停", "Escape"],
  performance: ["性能面板", "F8"],
  fullscreen: ["切换全屏", "F10"],
} as const;
export type Action = keyof typeof BASIC_CONTROLS;
export type EquipmentBinding = `equip:${string}`;
export type BindingId = Action | `skill:${string}` | EquipmentBinding;
export const skillBinding = (id: string): BindingId => `skill:${id}`;
export const equipmentBinding = (id: string): EquipmentBinding => `equip:${id}`;
export const ACTIONS = Object.keys(BASIC_CONTROLS) as Action[];
type SavedBindings = Record<string, unknown>;
const savedBindings = (raw: unknown): SavedBindings => (isRecord(raw) ? raw : {});
const store = new Setting<SavedBindings>({
  key: "demolition-basic-controls-v2",
  codec: jsonCodec(savedBindings),
  legacy: [
    {
      key: "demolition-basic-controls-v1",
      // v1 shipped the gear wheel on B; drop that default so the v2 one applies.
      codec: jsonCodec((raw) => {
        const saved = savedBindings(raw);
        if (saved.gearWheel === "KeyB") delete saved.gearWheel;
        return saved;
      }),
    },
  ],
});
const canonical = (code: string) =>
  code.replace(/^Numpad(\d)$/, "Digit$1").replace(/^ShiftRight$/, "ShiftLeft");
const controls = new Map<
  BindingId,
  { keys: readonly string[]; name: () => string; defaultLabel?: () => string }
>();
for (const id of ACTIONS)
  controls.set(id, { keys: BASIC_CONTROLS[id].slice(1), name: () => t(BASIC_CONTROLS[id][0]) });
for (const skill of Object.values(SKILLS)) {
  if (!skill.passive)
    controls.set(skillBinding(skill.id), {
      keys: skill.code ? [canonical(skill.code)] : [],
      name: () => field(skill, "name"),
      defaultLabel: () => t(skill.key),
    });
}
for (const id of EQUIPMENT_SLOTS) {
  const code = ITEMS[id]?.quickEquipCode;
  controls.set(equipmentBinding(id), {
    keys: code ? [canonical(code)] : [],
    name: () => (id === "bomb" ? t("炸药") : field(ITEMS[id], "name")),
  });
}
const KEY_NAMES: Record<string, string> = {
  Space: "空格",
  Escape: "Esc",
  ShiftLeft: "Shift",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Mouse0: "左键",
  Mouse1: "中键",
  Mouse2: "右键",
  Mouse3: "侧键 1",
  Mouse4: "侧键 2",
  WheelUp: "滚轮上",
  WheelDown: "滚轮下",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "反斜杠",
  Semicolon: "分号",
  Quote: "引号",
  Backquote: "反引号",
};
const keyName = (code: string) => (KEY_NAMES[code] ? t(KEY_NAMES[code]) : code.replace(/^(Key|Digit)/, ""));

function allowed(action: BindingId, code: string) {
  if (code === "Escape" && action !== "pause") return t("Esc 用于退出或暂停");
  if (/^Mouse[0-4]$/.test(code))
    return action === "use" || action === "build" || action.startsWith("skill:") ? "" : t("请按一个键盘按键");
  if (/^Wheel(Up|Down)$/.test(code))
    return ["previous", "next"].includes(action) ? "" : t("滚轮用于切换装备");
  if (
    !/^(Key[A-Z]|Digit\d|F[1-9]|F10|Arrow(Up|Down|Left|Right)|Space|ShiftLeft|Enter|Escape|Tab|Backspace|Insert|Delete|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Comma|Period|Slash|Backslash|Semicolon|Quote|Backquote)$/.test(
      code,
    )
  )
    return t("请选择单个键盘按键或鼠标键");
  return "";
}

class Bindings extends EventTarget {
  private custom: Partial<Record<BindingId, string | null>> = {};
  private lookup = new Map<string, BindingId>();
  constructor() {
    super();
    const saved = store.load() ?? {};
    for (const id of controls.keys()) {
      const value =
        id === equipmentBinding("shield") && saved[id] === undefined ? saved.equipShield : saved[id];
      if ((value === null && id.startsWith("equip:")) || (typeof value === "string" && !allowed(id, value)))
        this.custom[id] = value;
    }
    this.index();
  }
  codes(id: BindingId): readonly string[] {
    return [...this.lookup].filter(([, owner]) => owner === id).map(([code]) => code);
  }
  label(id: BindingId, all = false) {
    const keys = this.codes(id);
    if (!keys.length) return "—";
    const control = controls.get(id);
    if (control?.defaultLabel && keys[0] === control.keys[0]) return control.defaultLabel();
    return all ? keys.map(keyName).join(" / ") : keyName(keys[0]);
  }
  action(code: string) {
    return this.lookup.get(canonical(code));
  }
  private index() {
    this.lookup.clear();
    // Explicit rebindings take precedence over defaults introduced by an update.
    for (const id of controls.keys()) {
      const code = this.custom[id];
      if (code && !this.lookup.has(code)) this.lookup.set(code, id);
    }
    for (const [id, control] of controls) {
      if (this.custom[id] !== undefined) continue;
      for (const code of control.keys) if (!this.lookup.has(code)) this.lookup.set(code, id);
    }
    const shield = equipmentBinding("shield");
    if (
      controls.get(shield)?.keys.length &&
      this.custom[shield] === undefined &&
      !this.codes(shield).length
    ) {
      const fallback = ["KeyH", "KeyJ", "KeyK"].find((code) => !this.lookup.has(code));
      if (fallback) this.lookup.set(fallback, shield);
    }
  }
  private save() {
    this.index();
    store.save(this.custom);
    this.dispatchEvent(new Event("change"));
  }
  bind(id: BindingId, raw: string) {
    const code = canonical(raw),
      error = allowed(id, code);
    if (error) return error;
    const owner = this.action(code);
    if (owner && owner !== id) return t("已用于「{0}」", controls.get(owner)!.name());
    this.custom[id] = code;
    this.save();
    return "";
  }
  unbind(id: EquipmentBinding) {
    this.custom[id] = null;
    this.save();
  }
  reset() {
    this.custom = {};
    this.save();
  }
}
export const bindings = new Bindings();
