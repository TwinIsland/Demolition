/** Player preference for camera and weapon motion. Presentation only; never read by the simulation. */
import { t } from "../i18n";

export type MotionLevel = "full" | "reduced" | "off";
const LEVELS: Record<MotionLevel, number> = { full: 1, reduced: 0.35, off: 0 };
const storageKey = "demolition-motion";

function readMotion(): MotionLevel {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && Object.hasOwn(LEVELS, saved)) return saved as MotionLevel;
  } catch {}
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "reduced"
    : "full";
}

let level = readMotion();

export const motionLevel = () => level;
/** 0 disables shake and kicks, 1 plays them at full strength. */
export const motionScale = () => LEVELS[level];

export function setMotionLevel(value: MotionLevel) {
  level = value;
  try {
    localStorage.setItem(storageKey, value);
  } catch {}
}

/** Settings row. The select saves itself through one delegated listener, so the host form needs no wiring. */
export function motionSelect() {
  const option = (value: MotionLevel, label: string) =>
    `<option value="${value}" ${level === value ? "selected" : ""}>${t(label)}</option>`;
  return `<label>${t("镜头晃动")}<select name="motion" data-feel-motion>${option("full", "完整")}${option(
    "reduced",
    "减弱",
  )}${option("off", "关闭")}</select></label>`;
}

if (typeof document !== "undefined")
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLSelectElement &&
      target.matches("[data-feel-motion]") &&
      Object.hasOwn(LEVELS, target.value)
    )
      setMotionLevel(target.value as MotionLevel);
  });
