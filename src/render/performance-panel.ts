import { t } from "../i18n";
import type { WebGLRenderer } from "three";
import { bindings } from "../input/bindings";

/** Frames slower than this count as hitches: one and a half frames at 60 Hz. */
const LONG_FRAME_MS = 25;
const WINDOW_MS = 10_000;

interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * GPU time of a frame through EXT_disjoint_timer_query_webgl2, where the browser offers it
 * (Chromium; not Safari). Queries resolve some frames after they end.
 */
class GpuTimer {
  private extension?: TimerExtension | null;
  private open?: WebGLQuery;
  private pending: WebGLQuery[] = [];
  private recent: number[] = [];
  begin(context: WebGLRenderingContext | WebGL2RenderingContext) {
    if (!("createQuery" in context)) return;
    if (this.extension === undefined)
      this.extension = context.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExtension | null;
    if (!this.extension || this.open || this.pending.length > 8) return;
    const query = context.createQuery();
    if (!query) return;
    context.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    this.open = query;
  }
  end(context: WebGLRenderingContext | WebGL2RenderingContext) {
    if (!this.extension || !("createQuery" in context)) return;
    if (this.open) {
      context.endQuery(this.extension.TIME_ELAPSED_EXT);
      this.pending.push(this.open);
      this.open = undefined;
    }
    const disjoint = context.getParameter(this.extension.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const query = this.pending[0];
      if (!context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE)) break;
      if (!disjoint) {
        this.recent.push((context.getQueryParameter(query, context.QUERY_RESULT) as number) / 1e6);
        if (this.recent.length > 60) this.recent.shift();
      }
      context.deleteQuery(query);
      this.pending.shift();
    }
  }
  label() {
    if (!this.extension) return "n/a";
    if (!this.recent.length) return "…";
    const mean = this.recent.reduce((a, b) => a + b, 0) / this.recent.length;
    return `${mean.toFixed(1)} ms (max ${Math.max(...this.recent).toFixed(1)})`;
  }
}

/** Local-only diagnostics. F8 toggles the panel; no telemetry is transmitted. */
export class PerformancePanel {
  private panel = document.createElement("pre");
  private signal = new AbortController();
  private lastFrame = 0;
  private nextUpdate = 0;
  /** Frame intervals in ms with their arrival time, kept for the last ten seconds. */
  private frames: { at: number; ms: number }[] = [];
  private cpu: number[] = [];
  /** CPU time per named part of the frame: what this frame has spent so far, and recent frames. */
  private parts = new Map<string, { now: number; recent: number[] }>();
  private spikes: { at: number; text: string }[] = [];
  private counts = { programs: 0, textures: 0, geometries: 0, width: 0, height: 0 };
  private gpu = new GpuTimer();
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
          this.frames.length = this.cpu.length = this.spikes.length = 0;
          this.parts.clear();
        }
      },
      { signal: this.signal.signal },
    );
  }
  get active() {
    return !this.panel.hidden;
  }
  /** Adds CPU time to a named part of the current frame, such as "sim" or "hud". */
  part(name: string, ms: number) {
    if (this.panel.hidden) return;
    let part = this.parts.get(name);
    if (!part) this.parts.set(name, (part = { now: 0, recent: [] }));
    part.now += ms;
  }
  /** Brackets the GPU work of one frame. Results arrive a few frames later. */
  beginGpu() {
    if (!this.panel.hidden) this.gpu.begin(this.renderer.getContext());
  }
  sample(now: number, cpuMs: number, renderer = this.renderer) {
    if (this.panel.hidden) return;
    const gl = renderer.getContext(),
      info = renderer.info;
    if (renderer === this.renderer) this.gpu.end(gl);
    const interval = this.lastFrame && now - this.lastFrame < 1000 ? now - this.lastFrame : 0;
    this.lastFrame = now;
    if (interval) this.frames.push({ at: now, ms: interval });
    while (this.frames.length && now - this.frames[0].at > WINDOW_MS) this.frames.shift();
    this.cpu.push(cpuMs);
    if (this.cpu.length > 120) this.cpu.shift();
    const spent: string[] = [];
    for (const [name, part] of this.parts) {
      if (part.now >= 4) spent.push(`${name} ${part.now.toFixed(0)} ms`);
      part.recent.push(part.now);
      if (part.recent.length > 120) part.recent.shift();
      part.now = 0;
    }

    // What changed on the GPU since the last frame says why a long frame was long.
    const counts = {
      programs: info.programs?.length ?? 0,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
    };
    const sorted = this.frames.map((frame) => frame.ms).sort((a, b) => a - b);
    const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
    const median = quantile(0.5);
    if (interval > Math.max(LONG_FRAME_MS, median * 1.8) && this.frames.length > 30) {
      const before = this.counts;
      const causes = [
        counts.programs > before.programs && `${t("着色程序")} +${counts.programs - before.programs}`,
        counts.textures > before.textures && `${t("贴图")} +${counts.textures - before.textures}`,
        counts.geometries > before.geometries && `${t("几何体")} +${counts.geometries - before.geometries}`,
        (counts.width !== before.width || counts.height !== before.height) &&
          `${t("分辨率")} ${counts.width} × ${counts.height}`,
        cpuMs >= 4 && `${t("渲染提交")} ${cpuMs.toFixed(0)} ms`,
        ...spent,
      ].filter(Boolean);
      const text = `${interval.toFixed(0)} ms · ${causes.join(" · ") || t("无明显原因（可能是垃圾回收或合成器）")}`;
      this.spikes.push({ at: now, text });
      if (this.spikes.length > 6) this.spikes.shift();
      console.debug(`[perf] long frame ${text}`);
    }
    this.counts = counts;

    if (now < this.nextUpdate) return;
    this.nextUpdate = now + 500;
    const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : t("驱动未公开");
    const recent = this.frames.slice(-120).map((frame) => frame.ms),
      frame = avg(recent),
      long = sorted.filter((ms) => ms > LONG_FRAME_MS).length;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const parts = [...this.parts].map(([name, part]) => `${name} ${avg(part.recent).toFixed(1)}`);
    const lines = [
      `${bindings.label("performance")} ${t("性能诊断")}`,
      `FPS ${frame ? Math.round(1000 / frame) : 0} · ${t("帧间隔")} ${frame.toFixed(1)} ms · ${t("渲染提交")} ${avg(this.cpu).toFixed(1)} ms`,
      `${t("最近 10 秒")} p50 ${median.toFixed(1)} · p99 ${quantile(0.99).toFixed(1)} · ${t("最大")} ${(sorted.at(-1) ?? 0).toFixed(1)} ms · ${t("长帧")} ${long}`,
      `CPU ms: ${parts.join(" · ") || "-"} · GPU ${this.gpu.label()}${heap ? ` · ${t("堆内存")} ${(heap.usedJSHeapSize / 2 ** 20).toFixed(0)} MB` : ""}`,
      `${t("绘制调用")} ${info.render.calls} · ${t("三角形")} ${info.render.triangles} · ${t("着色程序")} ${counts.programs} · ${t("贴图")} ${counts.textures} · ${t("几何体")} ${counts.geometries}`,
      `${t("分辨率")} ${counts.width} × ${counts.height}`,
      `GPU ${gpu}`,
      ...[...this.spikes]
        .reverse()
        .map((spike) => `${t("{0} 秒前", ((now - spike.at) / 1000).toFixed(0))}: ${spike.text}`),
    ];
    this.panel.textContent = lines.join("\n");
  }
  dispose() {
    this.signal.abort();
    this.panel.remove();
  }
}
