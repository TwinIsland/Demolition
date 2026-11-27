"""Synthesizes the crate placement sound: one short, hollow wooden "tock", the feel of setting a
block down in a voxel sandbox game. Entirely generated; no recording is sampled.
Usage: python3 make-build-sound.py <repo root> (needs numpy and ffmpeg)."""
import sys, subprocess, wave, os, tempfile, numpy as np
ROOT = sys.argv[1]; SR = 44100
rng = np.random.default_rng(23)
def t(d): return np.arange(int(SR*d))/SR
def lowpass(x, k):
    y = np.zeros(len(x)); a = 0.0
    for i in range(len(x)):
        a += k*(x[i]-a); y[i] = a
    return y
def tock(pitch, d):
    """A struck block of wood: a body tone that drops slightly in pitch, two quickly damped
    inharmonic modes for the hollow colour, and a dull noise tap for the contact."""
    x = t(d)
    glide = pitch*(1 + .35*np.exp(-x*60))
    body = np.sin(2*np.pi*np.cumsum(glide)/SR)*np.exp(-x*30)
    for ratio, gain, decay in ((2.4, .38, 70), (4.1, .16, 120)):
        body += gain*np.sin(2*np.pi*pitch*ratio*x)*np.exp(-x*decay)
    tap = lowpass(rng.normal(0, 1, len(x)), .22)*np.exp(-x*150)
    return body + .9*tap
v = np.zeros(int(SR*.24))
main = tock(150, .22); v[:len(main)] += main
# A faint second contact a few milliseconds later, as the block settles flat.
late = tock(118, .16); i = int(SR*.028); v[i:i+len(late)] += .32*late
v = lowpass(v, .5)
attack = int(SR*.002); v[:attack] *= np.linspace(0, 1, attack)
n = len(v); o = int(SR*.04); v[n-o:] *= np.linspace(1, 0, o)
v = np.tanh(1.6*v/np.max(np.abs(v)))
v = v/np.max(np.abs(v))*.9
with tempfile.TemporaryDirectory() as tmp:
    wav = os.path.join(tmp, "a.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((v*32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "4",
                    os.path.join(ROOT, "public/assets/crate-build.ogg")], check=True)
