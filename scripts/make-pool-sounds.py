"""Builds the Pool map sounds.

- footstep-water-{0,1,2}.ogg: a step into ankle-deep water, cut from AGFX's recordings
  (CC BY 3.0, freesound.org/people/AGFX/packs/1253) as shipped in Minetest Game
  (mods/default/sounds/default_water_footstep.{1,2,3}.ogg).
- environment/poolrooms.ogg: a seamless 24 s bed of fluorescent hum, ventilation, lapping water
  and far drips in a large tiled hall. Synthesized.

Usage: python3 make-pool-sounds.py <repo root> <folder with the three source .ogg files>
Needs numpy and ffmpeg.
"""
import sys, subprocess, wave, os, tempfile, numpy as np

ROOT, SOURCES = sys.argv[1], sys.argv[2]
SR = 44100
rng = np.random.default_rng(2031)


def encode(samples, out, quality="4"):
    samples = np.clip(samples, -1, 1)
    channels = 1 if samples.ndim == 1 else samples.shape[1]
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "a.wav")
        with wave.open(path, "wb") as w:
            w.setnchannels(channels); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((samples * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-c:a", "libvorbis", "-q:a", quality,
                        os.path.join(ROOT, out)], check=True)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def band(noise, low, high):
    """Zero-phase band-pass in the frequency domain; the result is periodic, so it loops."""
    spectrum = np.fft.rfft(noise)
    freq = np.fft.rfftfreq(len(noise), 1 / SR)
    edge = np.clip((freq - low) / (low * 0.15 + 1), 0, 1) * np.clip((high - freq) / (high * 0.15 + 1), 0, 1)
    return np.fft.irfft(spectrum * edge, len(noise))


def norm(x, peak):
    return x / np.max(np.abs(x)) * peak


def bubble(start_hz, rise, seconds, total):
    """A water drop: a sine whose pitch rises while it dies away."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    phase = 2 * np.pi * start_hz * (t + rise * t * t / (2 * seconds))
    out = np.zeros(total)
    out[:n] = np.sin(phase) * np.exp(-t * 5 / seconds) * np.minimum(1, t * 900)
    return out


# --- Footsteps in shallow water ----------------------------------------------------------------
# Cut from recordings of steps in water: the first splash of each take, without its long tail.
for i in range(3):
    take = decode(os.path.join(SOURCES, f"default_water_footstep.{i + 1}.ogg"))
    # The takes swell slowly; a footstep has to land at once, so start just ahead of the loudest part.
    hop = int(SR * 0.01)
    loud = np.sqrt(np.convolve(take ** 2, np.ones(hop * 3) / (hop * 3), "same"))
    peak = int(np.argmax(loud))
    quiet = np.nonzero(loud[max(0, peak - int(SR * 0.14)):peak] < 0.3 * loud[peak])[0]
    start = max(0, peak - int(SR * 0.14) + (int(quiet[-1]) if len(quiet) else 0))
    step = take[start:start + int(SR * 0.55)].copy()
    step[:int(SR * 0.003)] *= np.linspace(0, 1, int(SR * 0.003))
    tail = int(SR * 0.36)
    step[-tail:] *= np.linspace(1, 0, tail) ** 2
    encode(norm(step, 0.85), f"public/assets/footstep-water-{i}.ogg")

# --- Hall ambience -----------------------------------------------------------------------------
SECONDS = 24
N = SR * SECONDS
t = np.arange(N) / SR


def cycles(count, phase=0.0):
    """A slow sine with a whole number of cycles in the loop."""
    return np.sin(2 * np.pi * count * t / SECONDS + phase)


def channel(seed):
    r = np.random.default_rng(seed)
    # Fluorescent ballast: mains harmonics, and a buzz that follows twice the mains frequency.
    hum = sum(a * np.sin(2 * np.pi * f * t + r.uniform(0, 6.28))
              for f, a in [(100, 0.5), (200, 0.22), (300, 0.12), (400, 0.05), (500, 0.035)])
    hum *= 1 + 0.06 * cycles(3, r.uniform(0, 6.28))
    buzz = band(r.standard_normal(N), 2800, 7500) * (0.5 + 0.5 * np.sin(2 * np.pi * 100 * t)) ** 3
    vent = band(r.standard_normal(N), 35, 260) * (1 + 0.25 * cycles(2, r.uniform(0, 6.28)))
    air = band(r.standard_normal(N), 400, 2400) * 0.5
    lap = band(r.standard_normal(N), 350, 1900) * (
        0.5 + 0.5 * cycles(7, r.uniform(0, 6.28)) * cycles(5, r.uniform(0, 6.28))) ** 2
    return norm(hum, 0.1) + norm(buzz, 0.012) + norm(vent, 0.2) + norm(air, 0.016) + norm(lap, 0.07)


def hall(x, seed, seconds=3.2):
    """Circular convolution with a noise tail, so the reverb wraps around the loop."""
    r = np.random.default_rng(seed)
    n = int(SR * seconds)
    tail = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 6.9 / seconds)
    impulse = np.zeros(N); impulse[:n] = band_tail(tail)
    return np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(impulse), N)


def band_tail(tail):
    spectrum = np.fft.rfft(tail)
    freq = np.fft.rfftfreq(len(tail), 1 / SR)
    return np.fft.irfft(spectrum * np.clip((freq - 200) / 200, 0, 1) / (1 + (freq / 3500) ** 2), len(tail))


drips = np.zeros((N, 2))
for _ in range(11):
    at = int(rng.uniform(0, N))
    drop = bubble(rng.uniform(700, 2100), rng.uniform(0.6, 1.6), rng.uniform(0.035, 0.08), N)
    drop = np.roll(drop, at) * rng.uniform(0.3, 1)
    pan = rng.uniform(0.15, 0.85)
    drips[:, 0] += drop * (1 - pan); drips[:, 1] += drop * pan
wet = np.column_stack([hall(drips[:, 0], 5), hall(drips[:, 1], 6)])
drip_bed = norm(drips * 0.35 + wet / np.max(np.abs(wet)), 0.09)

bed = np.column_stack([channel(11), channel(12)]) + drip_bed
encode(norm(bed, 0.5), "public/assets/environment/poolrooms.ogg", quality="3")
