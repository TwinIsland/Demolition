import { t } from "../i18n";
import type { WebGLRenderer } from "three";
import { bindings } from "../input/bindings";

/** Local-only diagnostics. F8 toggles the panel; no telemetry is transmitted. */
export class PerformancePanel {
  private panel = document.createElement("pre");
  private signal = new AbortController();
  private lastFrame = 0;
  private nextUpdate = 0;
  private frames: number[] = [];
  private cpu: number[] = [];
  constructor(
    private renderer: WebGLRenderer,
    container: HTMLElement,
  ) {
    this.panel.id = "performance-panel";
    this.panel.hidden = !new URLSearchParams(location.search).has("perf");
    this.panel.style.cssText =
      "position:absolute;z-index:60;left:12px;bottom:12px;max-width:95%;white-space:pre-wrap;padding:12px;background:#07110eeb;color:#d7f3cc;font:12px/1.6 var(--font-hud);pointer-events:none;border:1px solid #8fa578";
    container.append(this.panel);
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          bindings.action(e.code) === "performance" &&
          !e.repeat &&
          !e.altKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          !(e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable=true]"))
        ) {
          e.preventDefault();
          this.panel.hidden = !this.panel.hidden;
          this.lastFrame = this.nextUpdate = 0;
          this.frames.length = this.cpu.length = 0;
        }
      },
      { signal: this.signal.signal },
    );
  }
  sample(now: number, cpuMs: number, renderer = this.renderer) {
    if (this.panel.hidden) return;
    if (this.lastFrame && now - this.lastFrame < 1000) this.frames.push(now - this.lastFrame);
    this.lastFrame = now;
    this.cpu.push(cpuMs);
    if (this.frames.length > 120) this.frames.shift();
    if (this.cpu.length > 120) this.cpu.shift();
    if (now < this.nextUpdate) return;
    this.nextUpdate = now + 500;
    const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
    const gl = renderer.getContext(),
      extension = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : t("驱动未公开");
    const frame = avg(this.frames),
      info = renderer.info;
    this.panel.textContent = `${bindings.label("performance")} ${t("性能诊断")}\nFPS ${frame ? Math.round(1000 / frame) : 0} · ${t("帧间隔")} ${frame.toFixed(1)} ms · ${t("渲染提交")} ${avg(this.cpu).toFixed(1)} ms\n${t("绘制调用")} ${info.render.calls} · ${t("三角形")} ${info.render.triangles} · ${t("着色程序")} ${info.programs?.length ?? 0}\n${t("分辨率")} ${gl.drawingBufferWidth} × ${gl.drawingBufferHeight}\nGPU ${gpu}`;
  }
  dispose() {
    this.signal.abort();
    this.panel.remove();
  }
}
