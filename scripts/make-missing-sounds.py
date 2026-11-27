"""Builds the cues for events that used to be silent: skills ending, glass breaking, kicks,
cover breaking, operators going down, the zone wall, and zombies rising, groaning and striking.

Usage: python3 make-missing-sounds.py <repo root> <open-game-sfx-index/audio> (needs numpy and ffmpeg).
The second argument is a checkout of https://github.com/Mcamento8/open-game-sfx-index (CC0 mirror of
Kenney and OpenGameArt packs). Synthesised cues need no source recordings."""
import sys, subprocess, wave, os, tempfile, numpy as np

ROOT, SRC = sys.argv[1], sys.argv[2]
SR = 44100
rng = np.random.default_rng(23)


def t(d):
    return np.arange(int(SR * d)) / SR


def place(buf, s, at, g=1.0):
    i = int(SR * at)
    n = min(len(s), len(buf) - i)
    if n > 0:
        buf[i : i + n] += s[:n] * g


def onepole(x, k):
    """Low-pass with a per-sample coefficient (scalar or array)."""
    k = np.broadcast_to(k, x.shape)
    y = np.zeros(len(x))
    a = 0.0
    for i in range(len(x)):
        a += k[i] * (x[i] - a)
        y[i] = a
    return y


def noise(d):
    return rng.normal(0, 1, int(SR * d))


def fade(x, a=0.003, r=0.02):
    n = len(x)
    e = np.ones(n)
    i, o = int(SR * a), int(SR * r)
    e[:i] = np.linspace(0, 1, i)
    e[n - o :] = np.linspace(1, 0, o)
    return x * e


def load(rel, rate=1.0):
    """Decodes a source recording to mono; `rate` below 1 slows and lowers it."""
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", os.path.join(SRC, rel), "-f", "f32le", "-ac", "1",
         "-ar", str(int(SR / rate)), "-"],
        capture_output=True, check=True,
    ).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x / max(1e-9, np.max(np.abs(x)))


def write(path, x, peak=0.85, release=0.02):
    x = fade(x, r=release)
    x = x / np.max(np.abs(x)) * peak
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "a.wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).astype(np.int16).tobytes())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4",
             os.path.join(ROOT, path)],
            check=True,
        )


def sweep(f):
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


IMPACT, RPG, UI, SCIFI = "impact-sounds/", "rpg-audio/", "interface-sounds/", "sci-fi-sounds/"
ZOMBIE, BATTLE = "oga-zombies/zombies/", "oga-battle/battle_sound_effects/"

# Optical Camo ends: the shimmer of the activation cue run downhill, closing with a soft thump
# as the body snaps back into view.
d = 0.8
x = t(d)
c = np.zeros(len(x))
for f0, g in ((520, 1), (780, 0.6), (1170, 0.4), (1755, 0.25)):
    f = f0 * (1 + 0.9 * (1 - x / d) ** 2) * (1 + 0.035 * np.sin(2 * np.pi * 11 * x))
    c += g * sweep(f)
c *= np.exp(-x * 2.4) * (0.6 + 0.4 * np.sin(2 * np.pi * 15 * x)) * np.clip(x / 0.03, 0, 1)
air = noise(d)
air = air - onepole(air, 0.08)
c += 0.45 * onepole(air, np.linspace(0.6, 0.04, len(x))) * np.exp(-x * 5)
b = t(0.22)
place(c, sweep(150 * np.exp(-b * 14) + 55) * np.exp(-b * 16), 0.5, 1.3)
write("src/modules/skills/cloak/deactivate.ogg", c, 0.8)

# Blind Fuse ends: the lamp hum climbing back into hearing, then the relay dropping out.
d = 0.6
x = t(d)
f = 70 + 520 * (x / d) ** 2
v = (sweep(f) + 0.4 * sweep(2 * f)) * np.sin(np.pi * np.minimum(1, x / d * 1.1)) ** 1.5 * 0.8
b = t(0.05)
place(v, np.sin(2 * np.pi * 1500 * b) * np.exp(-b * 170), 0.5, 0.9)
write("src/modules/skills/veil/deactivate.ogg", v, 0.7)

# Threat Scan: two sonar pings, the second an octave-fifth down and longer, over a faint sweep.
d = 1.3
x = t(d)
s = np.zeros(len(x))
for at, f0, decay, g in ((0, 1650, 7, 1), (0.16, 1100, 3.4, 0.8)):
    b = t(d - at)
    ping = (np.sin(2 * np.pi * f0 * b) + 0.3 * np.sin(2 * np.pi * f0 * 2.01 * b)) * np.exp(-b * decay)
    place(s, ping * np.clip(b / 0.004, 0, 1), at, g)
echo = np.zeros(len(s))
for delay, g in ((0.19, 0.3), (0.38, 0.14)):
    place(echo, s, delay, g)
wash = noise(d)
wash = onepole(wash - onepole(wash, 0.05), np.linspace(0.02, 0.4, len(x))) * np.sin(np.pi * x / d) ** 2
write("src/modules/skills/scan/activate.ogg", s + echo + 0.25 * wash, 0.75, 0.1)

# Med Injector: cap click, spring strike, then the hiss of the dose going in.
d = 0.75
m = np.zeros(int(SR * d))
b = t(0.03)
place(m, np.sin(2 * np.pi * 2600 * b) * np.exp(-b * 220), 0, 0.5)
b = t(0.07)
place(m, (sweep(420 * np.exp(-b * 30) + 120) + 0.6 * noise(0.07)) * np.exp(-b * 55), 0.09, 1.0)
b = t(0.55)
hiss = noise(0.55)
hiss = hiss - onepole(hiss, 0.25)
place(m, onepole(hiss, np.linspace(0.7, 0.15, len(b))) * np.exp(-b * 6.5) * np.clip(b / 0.01, 0, 1), 0.12, 0.9)
write("src/modules/skills/medic/activate.ogg", m, 0.75, 0.06)

# Remote Detonator: the trigger's latch, then the transmitter's double chirp.
d = 0.5
r = np.zeros(int(SR * d))
place(r, load(RPG + "metalLatch.ogg"), 0, 0.9)
for at, f0 in ((0.16, 2100), (0.25, 2800)):
    b = t(0.06)
    place(r, np.sign(np.sin(2 * np.pi * f0 * b)) * 0.35 * np.sin(np.pi * b / 0.06) ** 0.5, at, 0.5)
write("src/modules/skills/detonator/activate.ogg", r, 0.75)

# Bandage: gauze pulled off the roll, wrapped and cinched.
d = 1.15
g = np.zeros(int(SR * d))
place(g, load(RPG + "cloth1.ogg"), 0, 1.0)
place(g, load(RPG + "cloth3.ogg"), 0.42, 0.9)
place(g, load(RPG + "clothBelt2.ogg"), 0.62, 0.7)
write("src/modules/items/bandage/use.ogg", g, 0.8, 0.08)

# Bottle shattering on the floor: the body breaking, then shards skittering away.
d = 1.0
x = t(d)
k = np.zeros(len(x))
place(k, load(IMPACT + "impactGlass_heavy_001.ogg"), 0, 1.0)
place(k, load(IMPACT + "impactGlass_medium_001.ogg"), 0.012, 0.8)
place(k, load(IMPACT + "impactGlass_light_002.ogg"), 0.03, 0.7)
place(k, load(UI + "glass_004.ogg"), 0.05, 0.55)
crash = noise(0.3)
crash = crash - onepole(crash, 0.35)
place(k, crash * np.exp(-t(0.3) * 16), 0, 0.5)
for _ in range(16):
    at = 0.08 + 0.7 * rng.random() ** 1.6
    f0 = rng.uniform(3200, 9000)
    b = t(rng.uniform(0.02, 0.07))
    place(k, np.sin(2 * np.pi * f0 * b) * np.exp(-b * rng.uniform(60, 140)), at, 0.22 * (1 - at) ** 2)
write("public/assets/glass-shatter.ogg", k, 0.85, 0.1)

# A boot against a steel charge casing.
d = 0.5
kick = np.zeros(int(SR * d))
place(kick, load(IMPACT + "impactPunch_heavy_002.ogg"), 0, 1.0)
place(kick, load(IMPACT + "impactMetal_medium_000.ogg"), 0.008, 0.55)
place(kick, load(IMPACT + "impactMetal_medium_003.ogg", 0.7), 0.02, 0.3)
write("public/assets/bomb-kick.ogg", kick, 0.8)

# Cover giving way: one heavy crack and a scatter of splinters. Two takes.
for n, (heavy, plank) in enumerate((("000", "001"), ("003", "003"))):
    d = 0.9
    w = np.zeros(int(SR * d))
    place(w, load(IMPACT + f"impactWood_heavy_{heavy}.ogg"), 0, 1.0)
    place(w, load(IMPACT + f"impactPlank_medium_{plank}.ogg"), 0.015, 0.8)
    for i in range(5):
        place(w, load(IMPACT + f"impactWood_light_00{(i + n) % 5}.ogg", rng.uniform(0.85, 1.2)),
              0.07 + 0.09 * i + 0.04 * rng.random(), 0.42 * 0.8**i)
    write(f"public/assets/cover-break-{n}.ogg", w, 0.85, 0.08)

# An operator going down: the body, then the kit settling.
d = 0.75
body = np.zeros(int(SR * d))
place(body, load(IMPACT + "impactSoft_heavy_003.ogg"), 0, 1.0)
place(body, load(IMPACT + "impactPunch_heavy_000.ogg", 0.8), 0.01, 0.35)
place(body, load(RPG + "dropLeather.ogg"), 0.16, 0.45)
place(body, load(RPG + "clothBelt.ogg"), 0.2, 0.25)
write("public/assets/body-fall.ogg", body, 0.85, 0.06)

# Taking damage: a short voiced "oof" over a body thud. The voice is additive formant synthesis:
# harmonics of a falling pitch, each weighted by a vowel envelope that closes from "o" to "u".
def oof(f_start, f_end, length, breath):
    x = t(length)
    u = x / length
    f0 = f_end + (f_start - f_end) * np.exp(-u * 3.2)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    f1 = 520 - 190 * u
    f2 = 900 - 180 * u
    voice = np.zeros(len(x))
    for k in range(1, 28):
        fk = k * f0
        env = (
            1.0 * np.exp(-(((fk - f1) / 110) ** 2))
            + 0.55 * np.exp(-(((fk - f2) / 150) ** 2))
            + 0.1 * np.exp(-(((fk - 2500) / 320) ** 2))
            + 0.05
        )
        voice += env / k**0.7 * np.sin(k * phase + 0.3 * k)
    # A hard glottal onset and a quick, slightly rough decay.
    amp = np.clip(x / 0.012, 0, 1) * np.exp(-u * 3.4) * (1 - u) ** 0.6
    voice *= amp * (1 + 0.12 * np.sin(2 * np.pi * 31 * x))
    air = noise(length)
    air = onepole(air - onepole(air, 0.12), 0.35)
    return voice / np.max(np.abs(voice)) + breath * air * np.exp(-u * 6) * np.clip(x / 0.004, 0, 1)


for n, (f_start, f_end, length, thud) in enumerate(((182, 104, 0.27, "000"), (166, 96, 0.3, "004"))):
    o = np.zeros(int(SR * (length + 0.08)))
    place(o, load(IMPACT + f"impactPunch_heavy_{thud}.ogg"), 0, 0.5)
    place(o, oof(f_start, f_end, length, 0.1), 0.012, 1.0)
    write(f"public/assets/hurt-voice-{n}.ogg", o, 0.85, 0.04)

# Hit marker: a dry, bright double tick, the first one harder. Short enough to stack on rapid hits.
def tick(f0, length=0.07, decay=75):
    b = t(length)
    ring = np.sin(2 * np.pi * f0 * b) + 0.5 * np.sin(2 * np.pi * f0 * 1.51 * b) + 0.3 * np.sin(2 * np.pi * f0 * 2.76 * b)
    snap = noise(length)
    snap = snap - onepole(snap, 0.5)
    return (ring * np.exp(-b * decay) + 0.8 * snap * np.exp(-b * 260)) * np.clip(b / 0.0008, 0, 1)


h = np.zeros(int(SR * 0.13))
place(h, tick(2350), 0, 1.0)
place(h, tick(3100, 0.05, 95), 0.045, 0.5)
write("public/assets/hit-marker.ogg", h, 0.85, 0.01)

# Elimination confirmed: the hit marker's tick dropped onto a low knock, then two rising bell
# notes that ring on. Clearly a different, bigger event than a hit.
d = 0.85
x = t(d)
q = np.zeros(len(x))
place(q, tick(1900, 0.09, 55), 0, 0.9)
b = t(0.22)
place(q, sweep(190 * np.exp(-b * 20) + 55) * np.exp(-b * 17), 0, 1.3)
for at, f0, g in ((0.07, 1046.5, 0.55), (0.17, 1568.0, 0.6)):
    b = t(d - at)
    note = np.sin(2 * np.pi * f0 * b) + 0.35 * np.sin(2 * np.pi * 2 * f0 * b) + 0.15 * np.sin(2 * np.pi * 3.01 * f0 * b)
    place(q, note * np.exp(-b * 7.5) * np.clip(b / 0.002, 0, 1), at, g)
write("public/assets/kill-confirm.ogg", q, 0.85, 0.08)

# The zone wall locking into place: stone grinding to a stop on a deep slam.
d = 1.6
z = np.zeros(int(SR * d))
grind = onepole(noise(0.45), 0.05) * np.linspace(0.2, 1, int(SR * 0.45)) ** 2
place(z, grind * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t(0.45))), 0, 3.0)
place(z, load(SCIFI + "lowFrequency_explosion_001.ogg"), 0.42, 1.0)
place(z, load(IMPACT + "impactMining_000.ogg", 0.6), 0.43, 0.7)
place(z, load(IMPACT + "impactMining_003.ogg", 0.8), 0.6, 0.3)
write("public/assets/zone-wall.ogg", z, 0.9, 0.15)

# Zombies. Voices are artisticdude's CC0 recordings, pitched down a little to sit with the rest.
d = 1.9
rise = np.zeros(int(SR * d))
earth = onepole(noise(0.9), 0.04) * np.sin(np.pi * t(0.9) / 0.9) ** 1.5
place(rise, earth, 0, 2.2)
place(rise, load(IMPACT + "impactMining_002.ogg", 0.55), 0.1, 0.3)
place(rise, load(ZOMBIE + "zombie-16.wav", 0.88), 0.3, 1.0)
write("public/assets/zombie-spawn.ogg", rise, 0.85, 0.1)

for n, (voice, swish) in enumerate((("zombie-24.wav", "swish_4.wav"), ("zombie-11.wav", "swish_2.wav"))):
    d = 0.75
    a = np.zeros(int(SR * d))
    place(a, load(BATTLE + swish, 0.85), 0.0, 0.5)
    place(a, load(ZOMBIE + voice, 0.9), 0.04, 1.0)
    write(f"public/assets/zombie-attack-{n}.ogg", a, 0.85, 0.05)

for n, voice in enumerate(("zombie-17.wav", "zombie-20.wav", "zombie-3.wav")):
    write(f"public/assets/zombie-groan-{n}.ogg", load(ZOMBIE + voice, 0.9), 0.8, 0.06)
