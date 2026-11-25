"""Synthesizes the supply shop sounds. Usage: python3 make-shop-sounds.py <output dir> (needs ffmpeg)."""
import sys, subprocess, wave, numpy as np
OUT = sys.argv[1]; SR = 44100
rng = np.random.default_rng(5)
def t(d): return np.arange(int(SR*d))/SR
def place(buf, s, at, g=1.0):
    i = int(SR*at); n = min(len(s), len(buf)-i); buf[i:i+n] += s[:n]*g
def lowpass(x, k):
    y = np.copy(x)
    for i in range(1, len(y)): y[i] = y[i-1]+k*(x[i]-y[i-1])
    return y
def clank(f, d, decay):
    x = t(d); return sum(np.sin(2*np.pi*f*r*x)*np.exp(-x*decay*(1+i*.6)) for i, r in enumerate((1, 2.76, 5.4, 8.9)))
def sweep(d, up):
    x = t(d); n = rng.normal(0, 1, len(x)); k = np.linspace(.02, .35, len(x)) if up else np.linspace(.35, .02, len(x))
    y = np.zeros(len(x))
    for i in range(1, len(x)): y[i] = y[i-1]+k[i]*(n[i]-y[i-1])
    return y*np.sin(np.pi*x/d)**1.5
def write(name, x):
    x = x/np.max(np.abs(x))*.8
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{OUT}/{name}.wav", "-c:a", "libvorbis", "-q:a", "4", f"{OUT}/{name}.ogg"], check=True)

# Open: latch release, then a crate lid sliding up.
o = np.zeros(int(SR*.55)); place(o, clank(420, .2, 38), 0, .8); place(o, sweep(.34, True), .05, 1.4); place(o, clank(180, .25, 22), .3, .9)
write("shop-open", o)
# Close: lid slides down and the latch seats with a heavier thud.
c = np.zeros(int(SR*.5)); place(c, sweep(.26, False), 0, 1.3); place(c, clank(150, .25, 20), .2, 1.2)
x = t(.2); place(c, np.sin(2*np.pi*(70+60*np.exp(-x*30))*x)*np.exp(-x*18), .2, 1.4)
write("shop-close", c)
# Buy: two bright coin clinks over a short register thunk.
b = np.zeros(int(SR*.6))
for f, at in ((2350, 0), (3140, .075)):
    x = t(.4); place(b, (np.sin(2*np.pi*f*x)+.5*np.sin(2*np.pi*f*1.51*x)+.3*np.sin(2*np.pi*f*2.32*x))*np.exp(-x*13), at, .7)
x = t(.12); place(b, np.sin(2*np.pi*190*x)*np.exp(-x*40), 0, .8)
write("shop-buy", b)
# Deny: two short low buzzes.
d = np.zeros(int(SR*.36))
for at in (0, .16):
    x = t(.11); place(d, np.sign(np.sin(2*np.pi*138*x))*.6*np.sin(np.pi*x/.11)**.5, at)
write("shop-deny", lowpass(d, .25))
