"""Builds the Poolrooms sounds. Everything is synthesized.

- footstep-water-{0,1,2}.ogg: a step into ankle-deep water (splash, plop and a few bubbles).
- environment/poolrooms.ogg: a seamless 24 s bed of fluorescent hum, ventilation, lapping water
  and far drips in a large tiled hall.

Usage: python3 make-pool-sounds.py <repo root>
Needs numpy and ffmpeg.
"""
import sys, subprocess, wave, os, tempfile, numpy as np

ROOT = sys.argv[1]
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
for i in range(3):
    n = int(SR * 0.42)
    t = np.arange(n) / SR
    splash = band(rng.standard_normal(n), 500 + 120 * i, 6500) * np.exp(-t * (13 + 2 * i)) * np.minimum(1, t * 260)
    spray = band(rng.standard_normal(n), 2500, 9000) * np.exp(-((t - 0.07) / 0.05) ** 2) * 0.35
    plop = np.sin(2 * np.pi * (150 - 16 * i) * t * (1 - 0.9 * t)) * np.exp(-t * 26) * 0.75
    step = splash + spray + plop
    for _ in range(4):
        at = int(SR * rng.uniform(0.04, 0.2))
        drop = bubble(rng.uniform(520, 1500), rng.uniform(0.5, 1.4), rng.uniform(0.03, 0.07), n)
        step += np.roll(drop, at) * rng.uniform(0.12, 0.3)
    step[-int(SR * 0.05):] *= np.linspace(1, 0, int(SR * 0.05))
    encode(norm(step, 0.8), f"public/assets/footstep-water-{i}.ogg")

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
