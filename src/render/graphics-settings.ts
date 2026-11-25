export interface GraphicsSettings {
  scale: number;
  shadows: "off" | "medium" | "high";
  occlusion: boolean;
  grain: boolean;
  /** Surface weathering, rain density and ripple quality. */
  detail: "low" | "medium" | "high";
  /** Mirror the scene in wet ground. Renders the arena a second time at quarter resolution. */
  reflections: boolean;
}
export const GRAPHICS_PRESETS = {
  performance: {
    scale: 0.7,
    shadows: "off",
    occlusion: false,
    grain: false,
    detail: "low",
    reflections: false,
  },
  balanced: {
    scale: 0.85,
    shadows: "medium",
    occlusion: false,
    grain: false,
    detail: "medium",
    reflections: false,
  },
  high: { scale: 1, shadows: "high", occlusion: true, grain: true, detail: "high", reflections: true },
} as const satisfies Record<string, GraphicsSettings>;
export type GraphicsPreset = keyof typeof GRAPHICS_PRESETS;
const STORAGE_KEY = "demolition-graphics";
export function readGraphics(): GraphicsSettings {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      value &&
      [0.7, 0.85, 1].includes(value.scale) &&
      ["off", "medium", "high"].includes(value.shadows) &&
      typeof value.occlusion === "boolean" &&
      typeof value.grain === "boolean"
    ) {
      // Settings saved before these options existed follow the preset of the same render scale.
      const preset =
        value.scale < 0.8
          ? GRAPHICS_PRESETS.performance
          : value.scale < 1
            ? GRAPHICS_PRESETS.balanced
            : GRAPHICS_PRESETS.high;
      return {
        ...value,
        detail: ["low", "medium", "high"].includes(value.detail) ? value.detail : preset.detail,
        reflections: typeof value.reflections === "boolean" ? value.reflections : preset.reflections,
      };
    }
  } catch {}
  return { ...GRAPHICS_PRESETS.high };
}
export function saveGraphics(settings: GraphicsSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
