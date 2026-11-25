"""Composites the victory and defeat banners for the match result dialogs.
Usage: python3 make-ui-outcomes.py <dir with Poly Haven diffuse jpgs> <output dir>"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
DL, OUT = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(11)
W, H = 1280, 480

def tex(name, ox, oy, scale):
    im = Image.open(f"{DL}/{name}.jpg").convert("RGB")
    s = int(1024*scale); im = im.resize((s, s), Image.LANCZOS)
    tile = Image.new("RGB", (W+s, H+s))
    for x in range(0, W+s, s):
        for y in range(0, H+s, s): tile.paste(im, (x, y))
    return np.asarray(tile.crop((ox, oy, ox+W, oy+H))).astype(np.float32)/255

def blur(a, r): return np.asarray(Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)/255
def shape(draw_fn, r=0):
    m = Image.new("L", (W, H), 0); draw_fn(ImageDraw.Draw(m)); a = np.asarray(m).astype(np.float32)/255
    return blur(a, r) if r else a
def emboss(mask, r, k):
    h = blur(mask, r); gy, gx = np.gradient(h); return np.clip(-(gx+gy)*k*r, -.25, .3)
def specks(n, size, bias_y):
    m = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m)
    for _ in range(n):
        x = rng.integers(0, W); y = int(H*rng.random()**bias_y); s = rng.random()*size+.6
        d.ellipse([x-s, y-s, x+s, y+s], fill=int(rng.integers(90, 255)))
    return np.asarray(m).astype(np.float32)/255

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
fade = np.clip((H-yy)/(H*.42), 0, 1)**1.2            # dissolve into the dialog below

def save(rgb, name):
    out = np.dstack([np.clip(rgb, 0, 1), fade])
    Image.fromarray((out*255).astype(np.uint8), "RGBA").resize((960, 360), Image.LANCZOS).save(f"{OUT}/{name}", quality=84, method=6)

def victory():
    base = tex("blue_metal_plate", 40, 300, 1.1); lum = base.mean(-1, keepdims=True)
    rgb = np.array([.16, .17, .15])*(.4+1.9*lum)
    cx, cy = W/2, H*.56
    ang = np.arctan2(yy-cy, xx-cx); dist = np.hypot(xx-cx, (yy-cy)*1.25)
    rays = (np.sin(ang*18+.4) > .35).astype(np.float32)
    rays = blur(rays, 3)*np.clip(1-dist/(W*.62), 0, 1)**1.3
    glow = np.exp(-(dist/(W*.2))**2)
    rgb += (rays*.34)[..., None]*np.array([1., .74, .32])+(glow*.75)[..., None]*np.array([1., .70, .28])
    # embossed brass star flanked by rank chevrons
    def star(d, R=118, r=47):
        pts = [(cx+(R if i % 2 == 0 else r)*np.sin(i*np.pi/5), cy-8-(R if i % 2 == 0 else r)*np.cos(i*np.pi/5)) for i in range(10)]
        d.polygon(pts, fill=255)
    def wings(d):
        for side in (-1, 1):
            for k in range(4):
                x0 = cx+side*(165+k*62); w = 34; h = 92-k*14
                d.polygon([(x0, cy-8-h/2), (x0+side*w, cy-8), (x0, cy-8+h/2), (x0+side*14, cy-8+h/2), (x0+side*(w+14), cy-8), (x0+side*14, cy-8-h/2)], fill=255)
    for fn, tint, k in ((wings, np.array([.80, .60, .26]), 1.0), (star, np.array([1., .80, .40]), 1.3)):
        m = shape(fn, .8)[..., None]
        brass = tint*(.55+1.1*lum)*(1.05-.35*(yy/H))[..., None]
        rgb = rgb*(1-m)+brass*m
        rgb += emboss(m[..., 0], 2.2, 3.2)[..., None]*k
    rgb *= (1-.55*blur(shape(star), 14)*(1-shape(star)))[..., None]            # drop shadow
    rgb += (specks(420, 2.2, 1.0)*np.clip(1-dist/(W*.55), 0, 1))[..., None]*np.array([1., .82, .45])*.9
    vign = np.clip(1-((xx-cx)/(W*.62))**2, 0, 1)
    save(rgb*(.35+.65*vign)[..., None], "outcome-victory.webp")

def defeat():
    base = tex("rusty_metal_sheet", 220, 60, 1.25); lum = base.mean(-1, keepdims=True)
    rust = np.clip((base[..., 0:1]-base[..., 2:3])*3-.1, 0, 1)
    rgb = np.array([.13, .12, .12])*(.4+1.7*lum)*(1-rust*.5)+np.array([.30, .12, .06])*lum*1.6*rust*.5
    cx, cy = W/2, H*.52
    dist = np.hypot(xx-cx, (yy-cy)*1.5)
    n = blur(rng.random((H, W)).astype(np.float32), 9); n = (n-n.min())/(n.max()-n.min())
    scorch = np.clip(1.15-dist/(W*.33)+(n-.5)*1.1, 0, 1)
    rgb *= (1-.86*scorch)[..., None]
    # fracture lines radiating from the impact, glowing like cooling metal
    def cracks(d):
        for _ in range(15):
            a = rng.random()*2*np.pi; x, y = cx, cy; L = rng.integers(160, 520)
            pts = [(x, y)]
            for _ in range(int(L/14)):
                a += rng.normal(0, .32); x += 14*np.cos(a); y += 9*np.sin(a); pts.append((x, y))
                if rng.random() < .12:
                    b = a+rng.choice([-1, 1])*.9; d.line([(x, y), (x+50*np.cos(b), y+32*np.sin(b))], fill=150, width=1)
            d.line(pts, fill=255, width=2)
    c = shape(cracks)
    heat = np.clip(1-dist/(W*.36), 0, 1)
    rgb *= (1-.9*blur(c, 1.2))[..., None]
    rgb += (blur(c, 5)*heat*1.5)[..., None]*np.array([1., .22, .05])+(c*heat**2*1.2)[..., None]*np.array([1., .62, .25])
    core = np.exp(-(dist/(W*.07))**2)
    rgb += core[..., None]*np.array([.95, .25, .06])*.9
    rgb += (specks(260, 1.8, .8)*np.clip(1.2-dist/(W*.5), 0, 1))[..., None]*np.array([1., .36, .10])
    smoke = blur(rng.random((H, W)).astype(np.float32), 28); smoke = np.clip((smoke-.5)*9+.4, 0, 1)*np.clip(1-yy/H*1.3, 0, 1)
    rgb = rgb*(1-.35*smoke[..., None])+np.array([.10, .09, .09])*.35*smoke[..., None]
    vign = np.clip(1-((xx-cx)/(W*.6))**2, 0, 1)
    save(rgb*(.3+.7*vign)[..., None], "outcome-defeat.webp")

victory(); defeat()
