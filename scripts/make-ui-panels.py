import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
DL, OUT = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)
SS = 2  # supersample

def tex(name, w, h, ox=0, oy=0, scale=1.0):
    im = Image.open(f"{DL}/{name}.jpg").convert("RGB")
    s = int(1024*scale); im = im.resize((s, s), Image.LANCZOS)
    tile = Image.new("RGB", (w+s, h+s))
    for x in range(0, w+s, s):
        for y in range(0, h+s, s): tile.paste(im, (x, y))
    return np.asarray(tile.crop((ox, oy, ox+w, oy+h))).astype(np.float32)/255

def poly_mask(w, h, pts, blur=0):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    if blur: m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m).astype(np.float32)/255

def chamfer(w, h, c, inset=0):
    i = inset
    return [(i+c, i), (w-i, i), (w-i, h-i-c), (w-i-c, h-i), (i, h-i), (i, i+c)]

def bevel(mask, radius, strength):
    """Fake lighting from the top-left using the blurred mask as a height field."""
    hgt = np.asarray(Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)/255
    gy, gx = np.gradient(hgt)
    return np.clip((-(gx+gy))*strength*radius, -.16, .13)

def rivet(img, cx, cy, r):
    h, w, _ = img.shape
    y, x = np.mgrid[0:h, 0:w]
    d = np.hypot(x-cx, y-cy)/r
    inside = np.clip(1-d, 0, 1)
    shade = np.clip(1.25-d, 0, 1)*np.clip(d-.85, 0, 1)*4      # dark seat ring
    img *= (1-0.75*np.clip(shade, 0, 1))[..., None]
    lit = (-(x-cx)-(y-cy))/(r*1.6)
    dome = np.where(d < 1, .30+.34*lit*np.sqrt(np.clip(1-d*d, 0, 1))+.12*np.sqrt(np.clip(1-d*d, 0, 1)), 0)
    a = np.clip((1-d)*r*.9, 0, 1)[..., None]
    img[:] = img*(1-a)+np.stack([dome*.95, dome, dome*.97], -1)*a
    # slot
    slot = (np.abs((x-cx)-(y-cy)) < r*.16) & (d < .72)
    img[slot] *= .35

def finish(rgb, alpha, path, size):
    out = np.dstack([np.clip(rgb, 0, 1), alpha])
    im = Image.fromarray((out*255).astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)
    im.save(path, quality=86, method=6)
    return im

def wear(w, h, mask, depth):
    """Chipped-paint mask hugging the outline."""
    edge = np.asarray(Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(depth))).astype(np.float32)/255
    near = np.clip((1-edge)*2.2, 0, 1)*mask
    n = rng.random((h//3+1, w//3+1)).astype(np.float32)
    n = np.asarray(Image.fromarray((n*255).astype(np.uint8)).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)/255
    return np.clip((near*1.5+n*.9-1.15)*5, 0, 1)

def scratches(w, h, count):
    m = Image.new("L", (w, h), 0); d = ImageDraw.Draw(m)
    for _ in range(count):
        x, y = rng.integers(0, w), rng.integers(0, h); L = rng.integers(20, 120); a = rng.normal(.25, .5)
        d.line([(x, y), (x+L*np.cos(a), y+L*np.sin(a))], fill=int(rng.integers(40, 130)), width=1)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(.6))).astype(np.float32)/255

def card(path, accent, fade=True):
    W, H, C = 384*SS, 160*SS, 20*SS
    base = tex("rusty_metal_sheet", W, H, 180, 420, 1.3)
    lum = base.mean(-1, keepdims=True)
    rust = np.clip((base[..., 0:1]-base[..., 2:3])*3.2, 0, 1)             # orange patches
    paint = np.array([.15, .19, .17])*(0.55+1.5*lum)                   # dark olive paint
    rgb = paint*(1-rust*.7)+np.array([.36, .19, .08])*lum*1.5*rust*.7
    outer = poly_mask(W, H, chamfer(W, H, C))
    # recessed inner well
    well = poly_mask(W, H, chamfer(W, H, C-6*SS, 9*SS))
    wellsoft = poly_mask(W, H, chamfer(W, H, C-6*SS, 9*SS), blur=5*SS)
    rgb *= (1-.30*well)[..., None]
    rgb *= (.55+.45*np.clip(wellsoft*1.6-.1, 0, 1)*well+.45*(1-well))[..., None]   # inner shadow
    rgb += (bevel(outer, 2.2*SS, 2.6)-bevel(well, 1.6*SS, 2.0))[..., None]
    # horizontal sheen, darker toward the right so text stays readable and the card fades
    x = np.linspace(0, 1, W)[None, :, None]; y = np.linspace(0, 1, H)[:, None, None]
    rgb *= (1.12-(.35 if fade else .08)*x)*(1.08-.22*y)
    chips = wear(W, H, outer, 5*SS)[..., None]
    rgb = rgb*(1-chips*.8)+np.array([.50, .52, .50])*(.5+lum)*chips*.8
    rgb += scratches(W, H, 26)[..., None]*.22*outer[..., None]
    # accent bar on the left edge with hazard chevrons
    yy, xx = np.mgrid[0:H, 0:W]
    bar = ((xx > 3*SS) & (xx < 9*SS) & (yy > C+2*SS) & (yy < H-6*SS)).astype(np.float32)
    stripe = (((xx+yy)//(7*SS)) % 2).astype(np.float32)
    col = np.array(accent)
    barrgb = col*(.55+.45*stripe)[..., None]*(.7+.8*lum)
    b = (bar*(1-chips[..., 0]*.7))[..., None]
    rgb = rgb*(1-b)+barrgb*b
    for cx, cy in [(W-13*SS, 13*SS), (W-C-9*SS, H-9*SS-0), (16*SS, H-11*SS)]:
        rivet(rgb, cx, cy, 4.2*SS)
    alpha = outer*(.97-.5*np.clip((x[..., 0]-.72)/.28, 0, 1)**1.5)        # fades out to the right
    if not fade: alpha = outer
    return finish(rgb, alpha, path, (384, 160))

def radar(path):
    S = 512*SS; C = 34*SS
    base = tex("blue_metal_plate", S, S, 60, 80, 1.15)
    lum = base.mean(-1, keepdims=True)
    rustsrc = tex("rusty_metal_sheet", S, S, 300, 90, 1.2)
    rust = np.clip((rustsrc[..., 0:1]-rustsrc[..., 2:3])*2.6-.25, 0, 1)
    rgb = np.array([.17, .20, .20])*(.45+1.9*lum)
    rgb = rgb*(1-rust*.6)+np.array([.34, .18, .08])*rustsrc.mean(-1, keepdims=True)*1.6*rust*.6
    pts = [(C, 0), (S-C, 0), (S, C), (S, S-C), (S-C, S), (C, S), (0, S-C), (0, C)]
    outer = poly_mask(S, S, pts)
    B = 46*SS
    inner = poly_mask(S, S, [(B, B), (S-B, B), (S-B, S-B), (B, S-B)])
    innersoft = poly_mask(S, S, [(B, B), (S-B, B), (S-B, S-B), (B, S-B)], blur=10*SS)
    rgb += (bevel(outer, 3*SS, 2.8)-bevel(inner, 2.4*SS, 2.4))[..., None]
    # screen well: near-black glass with a faint grid and vignette
    yy, xx = np.mgrid[0:S, 0:S]
    grid = (((xx % (32*SS)) < SS) | ((yy % (32*SS)) < SS)).astype(np.float32)
    glass = np.array([.03, .05, .05])+grid[..., None]*np.array([.015, .035, .028])
    glass = glass*(.35+.65*np.clip(innersoft*1.5-.25, 0, 1))[..., None]
    i3 = inner[..., None]
    rgb = rgb*(1-i3)+glass*i3
    chips = wear(S, S, outer, 7*SS)[..., None]*(1-i3)
    rgb = rgb*(1-chips*.8)+np.array([.52, .54, .52])*(.5+lum)*chips*.8
    rgb += scratches(S, S, 60)[..., None]*.2*(1-i3)
    # hazard strip on the bottom bezel
    strip = ((yy > S-30*SS) & (yy < S-16*SS) & (xx > 150*SS) & (xx < S-150*SS)).astype(np.float32)
    stripe = (((xx+yy)//(9*SS)) % 2).astype(np.float32)
    s3 = (strip*(1-chips[..., 0]))[..., None]*.9
    rgb = rgb*(1-s3)+(np.array([.80, .60, .22])*stripe[..., None]+np.array([.06, .07, .06])*(1-stripe[..., None]))*(.6+.8*lum)*s3
    for cx, cy in [(C+2*SS, 23*SS), (S-C-2*SS, 23*SS), (23*SS, S-C-2*SS), (S-23*SS, S-C-2*SS), (23*SS, C+2*SS), (S-23*SS, C+2*SS), (C+2*SS, S-23*SS), (S-C-2*SS, S-23*SS)]:
        rivet(rgb, cx, cy, 6.5*SS)
    return finish(rgb, outer, path, (512, 512))

card(f"{OUT}/player-card.webp", (.52, .58, .56))
card(f"{OUT}/player-card-self.webp", (.91, .70, .36))
radar(f"{OUT}/radar-frame.webp")
