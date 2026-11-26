"""Synthesizes the match outcome stings. Usage: python3 make-outcome-sounds.py <output dir> (needs ffmpeg)."""
import sys, subprocess, wave, numpy as np
OUT = sys.argv[1]; SR = 44100
rng = np.random.default_rng(3)
def t(d): return np.arange(int(SR*d))/SR
def env(n, a, r): 
    e = np.ones(n); A = int(SR*a); R = int(SR*r)
    e[:A] = np.linspace(0, 1, A); e[-R:] *= np.linspace(1, 0, R)**2; return e
def brass(f, d, bright=1.0):
    x = t(d); vib = 1+.004*np.sin(2*np.pi*5.2*x)*np.clip(x/.25, 0, 1)
    s = sum(np.sin(2*np.pi*f*k*x*vib)/(k**(1.15/bright)) for k in range(1, 12))
    return s*env(len(x), .025, min(.25, d*.5))
def place(buf, s, at, g=1.0):
    i = int(SR*at); buf[i:i+len(s)] += s[:len(buf)-i]*g
def lowpass(x, k): 
    y = np.copy(x)
    for i in range(1, len(y)): y[i] = y[i-1]+k*(x[i]-y[i-1])
    return y
def reverb(x, taps=((.031, .35), (.047, .28), (.071, .22), (.113, .16), (.167, .1))):
    y = np.copy(x)
    for d, g in taps:
        n = int(SR*d); y[n:] += x[:-n]*g
    return y
def write(name, x):
    x = x/np.max(np.abs(x))*.82
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{OUT}/{name}.wav", "-c:a", "libvorbis", "-q:a", "4", f"{OUT}/{name}.ogg"], check=True)

def felt(f, d):
    """A soft, felted piano-like note: few partials, slightly detuned pair, slow release."""
    x = t(d); s = np.zeros(len(x))
    for k, g in ((1, 1), (2, .32), (3, .12), (4, .05)):
        for det in (-.0012, .0012):
            s += g*np.sin(2*np.pi*f*k*(1+det)*x)*np.exp(-x*(1.1+.55*k))
    a = int(SR*.012); s[:a] *= np.linspace(0, 1, a)
    return s
def pad(f, d, swell):
    """A warm sustained tone that swells in and out, with a slow beat between detuned voices."""
    x = t(d); s = sum(np.sin(2*np.pi*f*(1+det)*x+ph) for det, ph in ((-.003, 0), (0, 1.3), (.003, 2.1)))
    s += .25*np.sin(2*np.pi*2*f*x)
    return lowpass(s, .12)*np.sin(np.pi*np.clip(x/d, 0, 1))**swell
def hall(x, seconds=2.2, mix=.5):
    """Long diffuse tail: dense decaying noise convolved in, far smoother than a few taps."""
    n = int(SR*seconds); ir = rng.normal(0, 1, n)*np.exp(-t(seconds)*3.2); ir = lowpass(ir, .25)
    m = len(x)+n; wet = np.fft.irfft(np.fft.rfft(x, m)*np.fft.rfft(ir, m), m); wet /= np.max(np.abs(wet))+1e-9
    dry = np.concatenate([x, np.zeros(n)]); dry /= np.max(np.abs(dry))+1e-9
    return dry*(1-mix)+wet*mix
def sub(d, f0=44, drop=30, decay=3.2):
    x = t(d); return np.sin(2*np.pi*np.cumsum(f0+drop*np.exp(-x*12))/SR)*np.exp(-x*decay)

# Victory: restrained and cinematic. A deep soft hit, two rising felt notes over a warm open
# fifth, and air. No fanfare.
D2, A2, D3, A3, D4, Fs4, A4 = 73.42, 110.0, 146.83, 220.0, 293.66, 369.99, 440.0
v = np.zeros(int(SR*3.6))
place(v, sub(1.6), 0, 1.1)
for f, g in ((D2, .5), (A2, .42), (D3, .4), (A3, .22)):
    place(v, pad(f, 3.4, 1.4), 0, g*.5)
place(v, felt(D4, 2.8), .12, .5)
place(v, felt(A4, 3.0), .62, .58)
place(v, felt(Fs4, 2.6), .62, .2)
air = rng.normal(0, 1, int(SR*3)); air = air-lowpass(air, .5)
place(v, air*np.sin(np.pi*np.linspace(0, 1, len(air)))**2, .3, .012)
write("match-victory", hall(v))

# Eliminated: the same palette turned down. A heavier hit and two falling notes over a minor third.
F3, C4, Ab3 = 174.61, 261.63, 207.65
e = np.zeros(int(SR*3.0))
place(e, sub(1.8, 40, 46, 2.6), 0, 1.3)
noise = lowpass(rng.normal(0, 1, int(SR*.6)), .05)*np.exp(-t(.6)*7); place(e, noise, 0, .7)
for f, g in ((D2, .5), (F3/2, .4), (A2, .3)):
    place(e, pad(f, 2.8, 1.2), 0, g*.5)
place(e, felt(C4, 2.4), .14, .42)
place(e, felt(Ab3, 2.6), .7, .5)
write("match-eliminated", hall(e, 2.0, .45))

# Typewriter tick for the debrief.
x = t(.035); tick = (rng.normal(0, 1, len(x))*np.exp(-x*240)+.6*np.sin(2*np.pi*2400*x)*np.exp(-x*160))
write("type-tick", tick)
