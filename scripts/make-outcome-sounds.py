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

# Victory: rising brass call that lands on a held major chord, with a timpani hit.
v = np.zeros(int(SR*2.6))
C, E, G, C2 = 261.63, 329.63, 392.0, 523.25
for f, at, d in ((G/2*2, 0, .16), (G, .17, .16), (C2, .34, .22), (E*2, .58, 1.7)):
    place(v, brass(f, d, 1.25), at, .8)
for f, g in ((C, .5), (E, .4), (G, .45), (C2, .4)):
    place(v, brass(f, 1.7), .58, g)
x = t(.9); drum = np.sin(2*np.pi*(62+38*np.exp(-x*18))*x)*np.exp(-x*5)
place(v, drum, .58, 1.6)
write("match-victory", reverb(v))

# Eliminated: impact thud, falling tone and a dull metallic ring.
e = np.zeros(int(SR*1.9))
x = t(1.0); place(e, np.sin(2*np.pi*(48+70*np.exp(-x*14))*x)*np.exp(-x*4.2), 0, 1.8)
noise = lowpass(rng.normal(0, 1, int(SR*.5)), .08)*np.exp(-t(.5)*9); place(e, noise, 0, 1.2)
x = t(1.5); fall = 220*np.exp(-x*1.1)
ph = 2*np.pi*np.cumsum(fall)/SR
tone = (np.sin(ph)+.5*np.sin(ph*1.5)+.3*np.sin(ph*2.01))*env(len(x), .02, .9)
place(e, tone, .08, .45)
x = t(1.2); ring = sum(np.sin(2*np.pi*f*x)*np.exp(-x*d) for f, d in ((311, 3.5), (467, 5), (733, 7)))
place(e, ring, .02, .12)
write("match-eliminated", reverb(e))

# Typewriter tick for the debrief.
x = t(.035); tick = (rng.normal(0, 1, len(x))*np.exp(-x*240)+.6*np.sin(2*np.pi*2400*x)*np.exp(-x*160))
write("type-tick", tick)
