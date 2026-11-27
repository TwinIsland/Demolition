"""Builds the Backrooms sounds.

- footstep-carpet-{0,1,2}.ogg: Kenney's CC0 Impact Sounds footstep_carpet_000..002, trimmed to
  the step, faded and level-matched.
- room-shift.ogg: the rooms moving, as an earthquake heard indoors: ground roar, a jolt, the
  building rattling and creaking, the tubes restriking. Synthesised.
- environment/backrooms.ogg: a seamless 24 s bed of fluorescent tubes (mains hum, ballast buzz
  that wavers and now and then stutters), air handling far off and the dull room tone of a
  carpeted floor. Synthesised.

Usage: python3 make-backrooms-sounds.py <folder with the Kenney .ogg files> <repo root>
Needs numpy and ffmpeg.
"""
import sys, subprocess, wave, os, tempfile, numpy as np

SOURCES, ROOT = sys.argv[1], sys.argv[2]
SR = 44100
rng = np.random.default_rng(1989)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


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


# --- Footsteps on carpet ------------------------------------------------------------------------
for i in range(3):
    step = decode(os.path.join(SOURCES, f"footstep_carpet_00{i}.ogg"))
    start = int(np.argmax(np.abs(step) > 0.02 * np.max(np.abs(step))))
    step = step[start:start + int(SR * 0.22)].copy()
    fade = int(SR * 0.06)
    step[:int(SR * 0.002)] *= np.linspace(0, 1, int(SR * 0.002))
    step[-fade:] *= np.linspace(1, 0, fade)
    encode(norm(step, 0.8), f"public/assets/footstep-carpet-{i}.ogg")

# --- Room bed -----------------------------------------------------------------------------------
SECONDS = 24
n = SR * SECONDS
t = np.arange(n) / SR


def slow(rate, depth, phase):
    """A slow wobble whose period divides the loop."""
    return 1 + depth * np.sin(2 * np.pi * round(rate * SECONDS) / SECONDS * t + phase)


def tubes(detune, phase):
    """One bank of tubes: mains hum, then the ballast's buzz on the even harmonics."""
    f0 = 60 + detune
    f0 = round(f0 * SECONDS) / SECONDS  # a whole number of cycles, so the loop closes
    out = 0.5 * np.sin(2 * np.pi * f0 * t + phase)
    for k in range(2, 42):
        weight = (1.0 if k % 2 == 0 else 0.35) / k ** 0.85
        # Resonances of the fitting's sheet-metal body.
        weight *= 1 + 2.2 * np.exp(-((k * f0 - 720) / 160) ** 2) + 1.4 * np.exp(-((k * f0 - 1850) / 260) ** 2)
        out += weight * np.sin(2 * np.pi * k * f0 * t + phase * k + rng.uniform(0, 6.28))
    return out


left = tubes(0, 0.0) * slow(0.13, 0.12, 0.4) + 0.6 * tubes(0.125, 1.3) * slow(0.21, 0.2, 2.0)
right = tubes(0, 0.7) * slow(0.17, 0.12, 1.1) + 0.6 * tubes(-0.125, 2.1) * slow(0.08, 0.2, 0.3)

# One failing tube: short stutters in its buzz, each with a faint tick as it restrikes.
stutter = np.ones(n)
ticks = np.zeros(n)
for at in (3.7, 4.05, 11.2, 17.6, 17.8, 18.3):
    a, b = int(at * SR), int((at + rng.uniform(0.05, 0.14)) * SR)
    stutter[a:b] = 0.25
    m = int(SR * 0.012)
    ticks[b:b + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / (SR * 0.002))
fizz = band(rng.standard_normal(n), 3200, 9000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 60 * t)))

air = band(rng.standard_normal(n), 45, 260)
duct = band(rng.standard_normal(n), 300, 1100) * slow(0.04, 0.3, 0.0)
room_l = norm(air, 1) * 0.5 + norm(duct, 1) * 0.12
air_r = band(rng.standard_normal(n), 45, 260)
room_r = norm(air_r, 1) * 0.5 + norm(np.roll(duct, SR // 3), 1) * 0.12

bed = np.stack([
    norm(left, 1) * 0.5 * stutter + norm(fizz, 1) * 0.035 + room_l * 0.5 + norm(band(ticks, 1500, 8000), 1) * 0.1,
    norm(right, 1) * 0.5 + norm(np.roll(fizz, SR), 1) * 0.035 + room_r * 0.5,
], axis=1)
encode(norm(bed, 0.6), "public/assets/environment/backrooms.ogg", "3")

# --- The rooms shift ----------------------------------------------------------------------------
# An earthquake heard from indoors: ground roar that swells and dies, a jolt at the start, the
# building rattling and creaking, and the tubes restriking near the end.
m = int(SR * 3.0)
u = np.arange(m) / SR
swell = np.minimum(1, u / 0.12) * np.exp(-np.clip(u - 1.1, 0, None) * 2.3)
roar = norm(band(rng.standard_normal(m), 22, 95), 1) * swell * (1 + 0.35 * np.sin(2 * np.pi * 5.3 * u))
body = norm(band(rng.standard_normal(m), 95, 330), 1) * swell * (0.75 + 0.25 * np.sin(2 * np.pi * 8.7 * u + 1))
jolt = np.sin(2 * np.pi * (34 * u + 26 * (1 - np.exp(-u * 8)) / 8)) * np.exp(-u * 3.4)
rattle = np.zeros(m)
for _ in range(46):
    at = rng.uniform(0.05, 1.9)
    a, k = int(at * SR), int(SR * rng.uniform(0.012, 0.035))
    rattle[a:a + k] += rng.standard_normal(k) * np.exp(-np.arange(k) / (k * 0.3)) * rng.uniform(0.3, 1) * np.exp(-max(0, at - 1.1) * 2)
rattle = band(rattle, 500, 4200)
creak = sum(
    np.sin(2 * np.pi * (f0 * u + 18 * np.sin(2 * np.pi * 1.7 * u + p))) * np.exp(-((u - at) / 0.22) ** 2)
    for f0, at, p in ((190, 0.5, 0.0), (240, 1.15, 1.4), (150, 1.6, 2.2))
)
restrike = np.zeros(m)
for at in (1.75, 1.88, 1.95, 2.12):
    a, k = int(at * SR), int(SR * 0.03)
    restrike[a:a + k] += rng.standard_normal(k) * np.exp(-np.arange(k) / (SR * 0.004))
restrike = band(restrike, 1800, 9000)
shift = roar * 1.0 + body * 0.6 + jolt * 0.9 + norm(rattle, 1) * 0.3 + norm(creak, 1) * 0.07 + norm(restrike, 1) * 0.12
shift[-int(SR * 0.4):] *= np.linspace(1, 0, int(SR * 0.4))
encode(norm(shift, 0.95), "public/assets/room-shift.ogg")
