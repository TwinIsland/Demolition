"""Synthesizes the Molotov ignition sound: glass breaking, then fuel catching with a whoosh.
Usage: python3 make-fire-sounds.py <repo root> (needs numpy and ffmpeg)."""
import sys, subprocess, wave, os, tempfile, numpy as np
ROOT = sys.argv[1]; SR = 44100
rng = np.random.default_rng(31)
def t(d): return np.arange(int(SR*d))/SR
def place(buf, s, at, g=1.0):
    i = int(SR*at); n = min(len(s), len(buf)-i); buf[i:i+n] += s[:n]*g
def lowpass(x, k):
    k = np.broadcast_to(k, x.shape); y = np.zeros(len(x)); a = 0.0
    for i in range(len(x)):
        a += k[i]*(x[i]-a); y[i] = a
    return y
v = np.zeros(int(SR*1.25))
# Glass: a burst of bright noise and a handful of short, high, inharmonic rings.
x = t(.16); burst = rng.normal(0, 1, len(x)); burst = burst - lowpass(burst, .25)
place(v, burst*np.exp(-x*38), 0, .9)
for _ in range(9):
    f = rng.uniform(2600, 7200); d = rng.uniform(.05, .18); x = t(d)
    place(v, np.sin(2*np.pi*f*x)*np.exp(-x*rng.uniform(30, 60)), rng.uniform(0, .09), rng.uniform(.12, .3))
# Fuel catching: low noise swelling fast and dying slowly, with a slow flutter.
d = 1.1; x = t(d); swell = np.minimum(1, x/.09)*np.exp(-x*2.6)
whoosh = lowpass(rng.normal(0, 1, len(x)), np.linspace(.22, .035, len(x)))
place(v, whoosh*swell*(.8+.2*np.sin(2*np.pi*11*x)), .05, 3.2)
place(v, np.sin(2*np.pi*np.cumsum(90*np.exp(-x*2)+45)/SR)*np.exp(-x*6), .05, .5)
n = len(v); o = int(SR*.06); v[n-o:] *= np.linspace(1, 0, o)
v = v/np.max(np.abs(v))*.85
with tempfile.TemporaryDirectory() as tmp:
    wav = os.path.join(tmp, "a.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4",
                    os.path.join(ROOT, "public/assets/fire-ignite.ogg")], check=True)
