export interface GraphicsSettings {
  scale: number;
  shadows: "off" | "medium" | "high";
  occlusion: boolean;
  grain: boolean;
}
export const GRAPHICS_PRESETS = {
  performance: {scale:.7, shadows:"off", occlusion:false, grain:false},
  balanced: {scale:.85, shadows:"medium", occlusion:false, grain:false},
  high: {scale:1, shadows:"high", occlusion:true, grain:true},
} as const satisfies Record<string, GraphicsSettings>;
export type GraphicsPreset = keyof typeof GRAPHICS_PRESETS;
const storageKey = "demolition-graphics";
export function readGraphics(): GraphicsSettings {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (value && [.7,.85,1].includes(value.scale) && ["off","medium","high"].includes(value.shadows)
      && typeof value.occlusion === "boolean" && typeof value.grain === "boolean") return value;
  } catch {}
  return {...GRAPHICS_PRESETS.high};
}
export function saveGraphics(settings: GraphicsSettings) {
  try { localStorage.setItem(storageKey,JSON.stringify(settings)); } catch {}
}
