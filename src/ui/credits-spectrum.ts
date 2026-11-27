export type SpectrumReader = () => { analyser: AnalyserNode; gain: number } | undefined;

/** Draws the live music only while its closing card is visible. */
export function mountCreditsSpectrum(
  canvas: HTMLCanvasElement,
  read: SpectrumReader,
  visible = () => !!canvas.closest(".credits-finished"),
) {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  let frame = 0;
  let bins = new Float32Array(0);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastPaint = -Infinity;

  const draw = (time: number) => {
    if (!canvas.isConnected) return;
    frame = requestAnimationFrame(draw);
    if (!visible()) return;
    const rect = canvas.getBoundingClientRect();
    if (time - lastPaint < (reducedMotion ? 200 : 1000 / 30)) return;
    lastPaint = time;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    const source = read();
    const bars = Math.max(32, Math.min(100, Math.floor(rect.width / 10)));
    const gradient = context.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, "#8b713d");
    gradient.addColorStop(1, "#f6efdc");
    context.fillStyle = gradient;
    if (source) {
      if (bins.length !== source.analyser.frequencyBinCount)
        bins = new Float32Array(source.analyser.frequencyBinCount);
      source.analyser.getFloatFrequencyData(bins);
    }
    const offset = source ? 20 * Math.log10(Math.max(source.gain, 0.00001)) : 0;
    const binHz = source ? source.analyser.context.sampleRate / source.analyser.fftSize : 1;
    const maxHz = source ? Math.min(16000, source.analyser.context.sampleRate / 2) : 16000;
    for (let bar = 0; bar < bars; bar++) {
      const low = 32 * (maxHz / 32) ** (bar / bars);
      const high = 32 * (maxHz / 32) ** ((bar + 1) / bars);
      let peak = -Infinity;
      if (source) {
        const first = Math.max(1, Math.floor(low / binHz));
        const end = Math.min(bins.length, Math.max(first + 1, Math.ceil(high / binHz)));
        for (let bin = first; bin < end; bin++) peak = Math.max(peak, bins[bin]);
      }
      const level = Math.max(0, Math.min(1, (peak - offset + 84) / 68));
      const barHeight = Math.max(ratio, level * height);
      const step = width / bars;
      context.fillRect(bar * step, height - barHeight, Math.max(ratio, step - 2 * ratio), barHeight);
    }
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
