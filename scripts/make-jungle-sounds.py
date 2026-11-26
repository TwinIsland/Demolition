"""Builds the rainforest sounds.

Footsteps are cut from Kenney's CC0 Impact Sounds: grass steps are the first third of
footstep_grass_000..002, and mud steps are footstep_snow_000..002 slowed and darkened with a
synthesized wet squelch on top. The ambience loop (insects, crickets, birds, frogs) is synthesized
and loops seamlessly.

Usage: python3 make-jungle-sounds.py <repo root> <folder with the Kenney .ogg files>
Needs numpy and ffmpeg.
"""
import sys, subprocess, wave, os, tempfile, numpy as np

ROOT, SOURCES = sys.argv[1], sys.argv[2]
SR = 44100
rng = np.random.default_rng(2026)


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


def fade(x, attack, release):
    a, r = int(SR * attack), int(SR * release)
    x = x.copy(); x[:a] *= np.linspace(0, 1, a); x[-r:] *= np.linspace(1, 0, r) ** 2
    return x


def norm(x, peak):
    return x / np.max(np.abs(x)) * peak


# --- Footsteps ---------------------------------------------------------------------------------
for i in range(3):
    grass = decode(os.path.join(SOURCES, f"footstep_grass_00{i}.ogg"))
    start = int(np.argmax(np.abs(grass) > 0.02 * np.max(np.abs(grass))))
    encode(norm(fade(grass[start:start + int(SR * 0.3)], 0.002, 0.12), 0.8), f"public/assets/footstep-grass-{i}.ogg")

    snow = decode(os.path.join(SOURCES, f"footstep_snow_00{i}.ogg"))
    # Slowing to 70% drops the pitch; the low-pass takes the crisp top off.
    slow = np.interp(np.arange(0, len(snow), 0.7), np.arange(len(snow)), snow)
    slow = band(slow, 60, 1900)
    n = int(SR * 0.34)
    step = np.zeros(n); m = min(n, len(slow)); step[:m] = slow[:m]
    t = np.arange(n) / SR
    # The squelch: noise through a band that sweeps upward as the boot lifts, plus a soft thump.
    squelch = np.zeros(n)
    for k, (low, high) in enumerate([(300, 700), (500, 1100), (800, 1700)]):
        seg = band(rng.normal(0, 1, n), low, high)
        centre = 0.08 + k * 0.05
        squelch += seg * np.exp(-((t - centre) / 0.035) ** 2)
    thump = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 18) + 55) / SR) * np.exp(-t * 26)
    mud = norm(step, 0.6) + norm(squelch, 0.5) + thump * 0.45
    encode(norm(fade(mud, 0.002, 0.1), 0.8), f"public/assets/footstep-mud-{i}.ogg")

# --- Ambience loop -----------------------------------------------------------------------------
LENGTH = 24.0
N = int(SR * LENGTH)
t = np.arange(N) / SR
left, right = np.zeros(N), np.zeros(N)


def place(sound, at, gain, pan):
    """Adds a sound at `at` seconds, wrapping past the end so the loop has no seam."""
    idx = (int(at * SR) + np.arange(len(sound))) % N
    np.add.at(left, idx, sound * gain * np.sqrt(0.5 * (1 - pan)))
    np.add.at(right, idx, sound * gain * np.sqrt(0.5 * (1 + pan)))


def loop_lfo(cycles, phase=0.0):
    """A slow modulation with a whole number of cycles in the loop."""
    return 0.5 + 0.5 * np.sin(2 * np.pi * cycles * t / LENGTH + phase)


# Insect bed: two shimmering bands, each beating at its own rate, drifting slowly in level.
for low, high, rate, level, pan in [(5200, 7400, 23, 0.05, -0.35), (3600, 4600, 17, 0.04, 0.4)]:
    bed = band(rng.normal(0, 1, N), low, high)
    beat = 0.55 + 0.45 * np.sin(2 * np.pi * round(rate * LENGTH) * t / LENGTH)
    bed = norm(bed * beat * (0.6 + 0.4 * loop_lfo(3, pan * 5)), level)
    left += bed * np.sqrt(0.5 * (1 - pan)); right += bed * np.sqrt(0.5 * (1 + pan))
# Air and far rustle of leaves.
air = norm(band(rng.normal(0, 1, N), 180, 900) * (0.6 + 0.4 * loop_lfo(2)), 0.03)
left += air; right += np.roll(air, SR // 3)

# Crickets: trains of three short pulses.
for _ in range(3):
    pitch, pan, period = rng.uniform(4200, 5200), rng.uniform(-0.8, 0.8), rng.uniform(0.55, 0.9)
    x = np.arange(int(SR * 0.022)) / SR
    pulse = np.sin(2 * np.pi * pitch * x) * np.sin(np.pi * x / 0.022) ** 2
    chirp = np.zeros(int(SR * 0.12))
    for k in range(3):
        chirp[int(SR * 0.034 * k):int(SR * 0.034 * k) + len(pulse)] += pulse
    at = rng.uniform(0, period)
    while at < LENGTH:
        if rng.random() < 0.8:
            place(chirp, at, 0.035, pan)
        at += period * rng.uniform(0.92, 1.08)


def whistle(f0, f1, length, vibrato=0.0):
    x = np.arange(int(SR * length)) / SR
    freq = f0 + (f1 - f0) * (x / length) ** 1.4 + vibrato * np.sin(2 * np.pi * 28 * x)
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    return tone * np.sin(np.pi * x / length) ** 1.5


# Birds: a few species, each a short phrase repeated at irregular intervals from its own perch.
species = [
    lambda: np.concatenate([whistle(3400, 2300, 0.13), np.zeros(int(SR * 0.05))] * int(rng.integers(3, 6))),
    lambda: np.concatenate([whistle(1500, 2700, 0.2, 60), np.zeros(int(SR * 0.09)), whistle(2700, 2100, 0.28, 40)]),
    lambda: np.concatenate([whistle(4200, 4700, 0.05), np.zeros(int(SR * 0.04))] * int(rng.integers(5, 9))),
    lambda: whistle(700, 1500, 0.42, 25),
]
for call in species:
    pan, gain = rng.uniform(-0.9, 0.9), rng.uniform(0.03, 0.06)
    for at in np.sort(rng.uniform(0, LENGTH, int(rng.integers(2, 4)))):
        place(call(), at, gain, pan)

# Frogs: low croaks in pairs.
for _ in range(2):
    pan = rng.uniform(-0.7, 0.7)
    x = np.arange(int(SR * 0.16)) / SR
    croak = np.sin(2 * np.pi * rng.uniform(230, 330) * x) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * x)))
    croak *= np.sin(np.pi * x / 0.16)
    for at in rng.uniform(0, LENGTH, 4):
        place(croak, at, 0.04, pan)
        place(croak, at + 0.26, 0.032, pan)

stereo = np.stack([left, right], axis=1)
encode(stereo / np.max(np.abs(stereo)) * 0.7, "public/assets/environment/jungle.ogg", "5")
