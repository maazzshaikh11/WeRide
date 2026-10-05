#!/usr/bin/env python3
"""
Rasterise the brand SVGs into every icon/logo asset the app ships.

Source of truth: assets/brand/logo-mark.svg (the "WR + road + pin" mark, no
background) and assets/brand/logo.svg (the same mark on the rounded dark tile).
Outputs (all committed, so a normal build never needs this script):
  assets/brand/app-icon.svg                          full-bleed square, mark centred
  assets/images/logo-mark.png                        in-app logo (transparent, cropped)
  android/.../mipmap-*/ic_launcher{,_round}.png      legacy icons (API < 26)
  android/.../mipmap-*/ic_launcher_foreground.png    adaptive foreground (API 26+)
  android/.../mipmap-anydpi-v26/ic_launcher*.xml     adaptive icon definitions
  android/.../values/ic_launcher_background.xml      adaptive background colour
  ios/weride/Images.xcassets/AppIcon.appiconset/*    all sizes + Contents.json

Needs: python3 + Pillow, and a Chromium/Chrome binary (CHROME=/path/to/chrome) to
render SVG. Usage:  CHROME=/usr/bin/chromium python3 scripts/generate-brand-assets.py
"""
import json, os, pathlib, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND = ROOT / 'assets' / 'brand'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
APPICONSET = ROOT / 'ios' / 'weride' / 'Images.xcassets' / 'AppIcon.appiconset'
CHROME = os.environ.get('CHROME') or sys.exit('Set CHROME to a Chromium/Chrome binary')
BG = '#0E0D0E'            # icon background (matches the tile in logo.svg)
CANVAS = 1254             # logo svg viewBox
SS = 2048                 # supersample size for crisp downscaling


def render(svg_path, size, transparent=True):
    """Render an SVG file to an RGBA PIL image via headless Chromium."""
    with tempfile.TemporaryDirectory() as td:
        html = pathlib.Path(td) / 'r.html'
        png = pathlib.Path(td) / 'r.png'
        html.write_text(
            f'<!doctype html><html><body style="margin:0;background:transparent">'
            f'<img src="file://{svg_path}" width="{size}" height="{size}" style="display:block"></body></html>')
        args = [CHROME, '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                f'--window-size={size},{size}', f'--screenshot={png}']
        if transparent:
            args.append('--default-background-color=00000000')
        subprocess.run(args + [f'file://{html}'], check=True, capture_output=True)
        return Image.open(png).convert('RGBA')


# ---- 1. measure the mark and build the full-bleed icon svg -------------------
mark_img = render(BRAND / 'logo-mark.svg', SS)
bbox = mark_img.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
k = CANVAS / SS
bx0, by0, bx1, by1 = (v * k for v in bbox)
mark_w, mark_h = bx1 - bx0, by1 - by0
cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
print(f'mark bbox (viewBox units): {mark_w:.0f} x {mark_h:.0f} centred at ({cx:.0f},{cy:.0f})')

mark_markup = re.search(r'<g id="mark">.*?</g>', (BRAND / 'logo-mark.svg').read_text(), re.S).group(0)
defs = re.search(r'<defs>(.*?)</defs>', (BRAND / 'logo.svg').read_text(), re.S).group(1)
ICON_MARK_FRAC = 0.74     # mark width as a fraction of the full-bleed icon
scale = CANVAS * ICON_MARK_FRAC / mark_w
tx, ty = CANVAS / 2 - cx * scale, CANVAS / 2 - cy * scale
(BRAND / 'app-icon.svg').write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}">\n'
    f'  <defs>{defs}</defs>\n'
    f'  <rect width="{CANVAS}" height="{CANVAS}" fill="{BG}"/>\n'
    f'  <rect width="{CANVAS}" height="{CANVAS}" fill="url(#glowTL)"/>'
    f'<rect width="{CANVAS}" height="{CANVAS}" fill="url(#glowBR)"/>\n'
    f'  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">{mark_markup}</g>\n</svg>\n')
icon_hi = render(BRAND / 'app-icon.svg', SS, transparent=False).convert('RGB')


def resized(img, px):
    return img.resize((px, px), Image.LANCZOS)


def mask_rounded(img, px, frac):
    out = resized(img.convert('RGBA'), px)
    m = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), radius=int(px * 4 * frac), fill=255)
    out.putalpha(m.resize((px, px), Image.LANCZOS))
    return out


def mask_circle(img, px):
    out = resized(img.convert('RGBA'), px)
    m = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    out.putalpha(m.resize((px, px), Image.LANCZOS))
    return out


# ---- 2. in-app logo: mark only, cropped with a little air --------------------
pad = int(0.04 * max(bbox[2] - bbox[0], bbox[3] - bbox[1]))
crop = mark_img.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(SS, bbox[2] + pad), min(SS, bbox[3] + pad)))
target_w = 720
crop = crop.resize((target_w, round(crop.height * target_w / crop.width)), Image.LANCZOS)
(ROOT / 'assets' / 'images').mkdir(parents=True, exist_ok=True)
crop.save(ROOT / 'assets' / 'images' / 'logo-mark.png', optimize=True)
print('in-app logo:', crop.size)

# ---- 3. Android --------------------------------------------------------------
LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTIVE = {k: round(v * 108 / 48) for k, v in LEGACY.items()}   # 108dp canvas
# Adaptive foreground: mark must sit inside the 66dp-diameter safe circle of the
# 108dp canvas -> half-diagonal of the mark box <= 33dp.
half_diag_frac = 33 / 108
ratio = mark_h / mark_w
max_w_frac = 2 * half_diag_frac / (1 + ratio ** 2) ** 0.5
fg_w_frac = min(max_w_frac, 0.56) * 0.98
print(f'adaptive foreground mark width = {fg_w_frac:.2%} of canvas (safe-zone limit {max_w_frac:.2%})')
mark_only = mark_img.crop(bbox)
for dens, px in LEGACY.items():
    d = RES / f'mipmap-{dens}'
    d.mkdir(parents=True, exist_ok=True)
    mask_rounded(icon_hi, px, 0.22).save(d / 'ic_launcher.png', optimize=True)
    mask_circle(icon_hi, px).save(d / 'ic_launcher_round.png', optimize=True)
    cpx = ADAPTIVE[dens]
    fw = round(cpx * fg_w_frac)
    fh = round(fw * mark_only.height / mark_only.width)
    fg = Image.new('RGBA', (cpx, cpx), (0, 0, 0, 0))
    fg.alpha_composite(mark_only.resize((fw, fh), Image.LANCZOS), ((cpx - fw) // 2, (cpx - fh) // 2))
    fg.save(d / 'ic_launcher_foreground.png', optimize=True)
anydpi = RES / 'mipmap-anydpi-v26'
anydpi.mkdir(parents=True, exist_ok=True)
for name in ('ic_launcher', 'ic_launcher_round'):
    (anydpi / f'{name}.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n')
(RES / 'values' / 'ic_launcher_background.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')

# ---- 4. iOS (full-bleed, no alpha — the OS applies the corner mask) -----------
contents = json.loads((APPICONSET / 'Contents.json').read_text())
for entry in contents['images']:
    pts = float(entry['size'].split('x')[0])
    scale_n = int(entry['scale'].rstrip('x'))
    px = round(pts * scale_n)
    fname = f"icon-{entry['size'].split('x')[0]}@{scale_n}x.png" if entry['idiom'] != 'ios-marketing' else 'icon-1024.png'
    resized(icon_hi, px).convert('RGB').save(APPICONSET / fname, optimize=True)
    entry['filename'] = fname
(APPICONSET / 'Contents.json').write_text(json.dumps(contents, indent=2) + '\n')
print('done')
