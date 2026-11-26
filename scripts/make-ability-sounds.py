"""Synthesizes the Blind Fuse, Optical Camo and Missile Strike sounds.
Usage: python3 make-ability-sounds.py <repo root> (needs numpy and ffmpeg)."""
import sys, subprocess, wave, os, tempfile, numpy as np
ROOT = sys.argv[1]; SR = 44100
rng = np.random.default_rng(11)
def t(d): return np.arange(int(SR*d))/SR
def place(buf, s, at, g=1.0):
    i = int(SR*at); n = min(len(s), len(buf)-i); buf[i:i+n] += s[:n]*g
def onepole(x, k):
    """Low-pass with a per-sample coefficient (scalar or array)."""
    k = np.broadcast_to(k, x.shape); y = np.zeros(len(x)); a = 0.0
    for i in range(len(x)):
        a += k[i]*(x[i]-a); y[i] = a
    return y
def noise(d): return rng.normal(0, 1, int(SR*d))
def fade(x, a=.004, r=.02):
    n = len(x); e = np.ones(n); i = int(SR*a); o = int(SR*r)
    e[:i] = np.linspace(0, 1, i); e[n-o:] = np.linspace(1, 0, o); return x*e
def write(path, x, peak=.85):
    x = fade(x); x = x/np.max(np.abs(x))*peak
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "a.wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4", os.path.join(ROOT, path)], check=True)

# Blind Fuse: a relay click, then the hum of the charge lamps sinking out of hearing.
v = np.zeros(int(SR*.7)); x = t(.05)
place(v, np.sin(2*np.pi*1900*x)*np.exp(-x*160), 0, .7)
x = t(.62); f = 620*np.exp(-x*3.2)+70
place(v, (np.sin(2*np.pi*np.cumsum(f)/SR)+.4*np.sin(4*np.pi*np.cumsum(f)/SR))*np.exp(-x*4.5), .03, .9)
place(v, onepole(noise(.5), np.linspace(.3, .01, int(SR*.5)))*np.exp(-t(.5)*6), .03, .8)
write("src/modules/skills/veil/activate.ogg", v)

# Optical Camo: a rising shimmer whose wobble is the wave that runs over the body.
d = 1.05; x = t(d); c = np.zeros(len(x))
for f0, g in ((520, 1), (780, .6), (1170, .4), (1755, .25)):
    f = f0*(1+.9*(x/d)**2)*(1+.035*np.sin(2*np.pi*9*x))
    c += g*np.sin(2*np.pi*np.cumsum(f)/SR)
c *= np.sin(np.pi*np.minimum(1, x/d))**1.2*(.6+.4*np.sin(2*np.pi*13*x))
air = noise(d); air = air-onepole(air, .08)
c += .5*onepole(air, np.linspace(.05, .6, len(x)))*np.sin(np.pi*x/d)**2
write("src/modules/skills/cloak/activate.ogg", c, .8)

# Missile incoming: a warning tone, then the falling whistle and growing rocket roar, 3 s to impact.
d = 3.0; x = t(d); m = np.zeros(len(x))
for at in (0, .22, .44):
    b = t(.13); place(m, np.sin(2*np.pi*1480*b)*np.sin(np.pi*b/.13)**.6, at, .45)
f = 2300*np.exp(-x*.62)+240
m += .55*np.sin(2*np.pi*np.cumsum(f)/SR)*np.clip((x-.5)/.6, 0, 1)*(.25+.75*(x/d)**2)
roar = onepole(noise(d), np.linspace(.01, .22, len(x)))
m += 2.6*roar*(x/d)**3
write("public/assets/missile-incoming.ogg", m, .9)

# Missile impact: crack, a long low boom, then debris rattling down.
d = 2.8; x = t(d); e = np.zeros(len(x))
place(e, noise(.05)*np.exp(-t(.05)*60), 0, 1.6)
f = 34+95*np.exp(-x*7)
e += 1.9*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x*1.9)
body = onepole(noise(d), np.clip(.5*np.exp(-x*2.6), .012, 1))
e += 3.2*body*np.exp(-x*1.5)
tail = onepole(noise(d), .02)*np.exp(-x*.9)*np.clip(x/.3, 0, 1)
e += 5*tail
for at in rng.uniform(.5, 2.2, 14):
    b = t(.06); place(e, (noise(.06)-onepole(noise(.06), .2))*np.exp(-b*70), at, rng.uniform(.08, .25))
e = np.tanh(e*1.4)
write("public/assets/missile-impact.ogg", e, .95)
