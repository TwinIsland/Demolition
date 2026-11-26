"""Synthesizes the crate construction sound: planks dropped into place and knocked tight.
Usage: python3 make-build-sound.py <repo root> (needs numpy and ffmpeg)."""
import sys, subprocess, wave, os, tempfile, numpy as np
ROOT = sys.argv[1]; SR = 44100
rng = np.random.default_rng(23)
def t(d): return np.arange(int(SR*d))/SR
def place(buf, s, at, g=1.0):
    i = int(SR*at); n = min(len(s), len(buf)-i); buf[i:i+n] += s[:n]*g
def lowpass(x, k):
    y = np.zeros(len(x)); a = 0.0
    for i in range(len(x)):
        a += k*(x[i]-a); y[i] = a
    return y
def knock(pitch, d=.16):
    """A struck plank: a few damped, inharmonic body modes under a short noise click."""
    x = t(d); body = np.zeros(len(x))
    for ratio, gain, decay in ((1, 1, 34), (2.76, .5, 55), (5.4, .22, 90)):
        body += gain*np.sin(2*np.pi*pitch*ratio*x)*np.exp(-x*decay)
    click = lowpass(rng.normal(0, 1, len(x)), .35)*np.exp(-x*240)
    return body + .7*click
v = np.zeros(int(SR*.42))
place(v, knock(170), 0, 1.0)      # the crate lands
place(v, knock(245, .12), .085, .55)  # a loose slat settles
place(v, knock(205, .14), .17, .8)    # knocked tight
place(v, lowpass(rng.normal(0, 1, int(SR*.2)), .08)*np.exp(-t(.2)*18), 0, .5)  # dust and weight
n = len(v); o = int(SR*.03); v[n-o:] *= np.linspace(1, 0, o)
v = v/np.max(np.abs(v))*.85
with tempfile.TemporaryDirectory() as tmp:
    wav = os.path.join(tmp, "a.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4",
                    os.path.join(ROOT, "public/assets/crate-build.ogg")], check=True)
