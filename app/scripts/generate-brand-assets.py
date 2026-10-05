#!/usr/bin/env python3
"""
Cut every icon/launch asset the app ships from the real logo (../logo.jpeg).

Source of truth: logo.jpeg in the repository root (a copy lives at
assets/images/logo.jpeg for the in-app <Logo>; a test keeps the two identical).
Outputs (all committed, so a normal build never needs this script):
  android/.../mipmap-*/ic_launcher{,_round}.png      legacy icons (API < 26)
  android/.../mipmap-*/ic_launcher_foreground.png    adaptive foreground (API 26+)
  android/.../mipmap-anydpi-v26/ic_launcher*.xml     adaptive icon definitions
  android/.../values/ic_launcher_background.xml      adaptive background colour
  android/.../drawable-nodpi/launch_logo.png         + drawable/launch_screen.xml (splash)
  ios/weride/Images.xcassets/AppIcon.appiconset/*    all sizes + Contents.json
  ios/weride/Images.xcassets/LaunchLogo.imageset/*   launch-screen logo @1x/2x/3x

Needs only python3 + Pillow + numpy.   Usage:  python3 scripts/generate-brand-assets.py
"""
import json, pathlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT.parent / 'logo.jpeg'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
IOS = ROOT / 'ios' / 'weride' / 'Images.xcassets'
APPICONSET = IOS / 'AppIcon.appiconset'
BG = '#0E0D0E'            # adaptive-icon background (the tile's dark)

img = Image.open(SRC).convert('RGB')
assert img.size == (1254, 1254), img.size
# The artwork is a rounded dark tile on pure black. TILE is a square that covers it.
TILE = (62, 52, 1190, 1180)
tile = img.crop(TILE)                       # 1128 x 1128 (launch logo keeps the tile's own corners)
# App icons are cut a little tighter so the OS corner mask, not the tile edge, shapes them.
ICON = img.crop((86, 76, 1166, 1156))       # 1080 x 1080
# The mark (W, road, pin, R) inside the tile.
MARK = (112, 222, 1148, 932)
TILE_RADIUS = 0.224


def resized(im, px):
    return im.resize((px, px), Image.LANCZOS)


def rounded(im, px, frac=TILE_RADIUS):
    out = resized(im.convert('RGBA'), px)
    m = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, px * 4 - 1, px * 4 - 1), radius=int(px * 4 * frac), fill=255)
    out.putalpha(m.resize((px, px), Image.LANCZOS))
    return out


def circle(im, px):
    out = resized(im.convert('RGBA'), px)
    m = Image.new('L', (px * 4, px * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    out.putalpha(m.resize((px, px), Image.LANCZOS))
    return out


# ---- Android launcher --------------------------------------------------------
LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTIVE = {k: round(v * 108 / 48) for k, v in LEGACY.items()}      # 108dp canvas

# Adaptive foreground: the mark with its dark backdrop keyed out (alpha from
# brightness), so it sits on the flat adaptive background without a visible box.
mark = img.crop(MARK)
arr = np.asarray(mark).astype(np.float32)
bright = arr.max(axis=2)
# the tile's corner glow peaks around 58, the mark itself is far brighter
alpha = np.clip((bright - 62.0) / 50.0, 0.0, 1.0)
mark_rgba = Image.fromarray(np.dstack([arr, alpha * 255.0]).astype(np.uint8), 'RGBA')
# Keep the mark inside the 66dp-diameter safe circle of the 108dp canvas.
mw, mh = mark_rgba.size
half_diag_frac = 33 / 108
fg_w_frac = 2 * half_diag_frac / (1 + (mh / mw) ** 2) ** 0.5 * 0.97
print(f'adaptive foreground mark = {fg_w_frac:.1%} of the canvas width')

for dens, px in LEGACY.items():
    d = RES / f'mipmap-{dens}'
    d.mkdir(parents=True, exist_ok=True)
    rounded(ICON, px).save(d / 'ic_launcher.png', optimize=True)
    circle(ICON, px).save(d / 'ic_launcher_round.png', optimize=True)
    cpx = ADAPTIVE[dens]
    fw = round(cpx * fg_w_frac)
    fh = round(fw * mh / mw)
    fg = Image.new('RGBA', (cpx, cpx), (0, 0, 0, 0))
    fg.alpha_composite(mark_rgba.resize((fw, fh), Image.LANCZOS), ((cpx - fw) // 2, (cpx - fh) // 2))
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

# ---- Android splash: black window with the logo tile centred ------------------
(RES / 'drawable-nodpi').mkdir(parents=True, exist_ok=True)
rounded(tile, 480).save(RES / 'drawable-nodpi' / 'launch_logo.png', optimize=True)
(RES / 'drawable' / 'launch_screen.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <item android:drawable="@android:color/black"/>\n'
    '    <item android:width="160dp" android:height="160dp" android:gravity="center">\n'
    '        <bitmap android:src="@drawable/launch_logo" android:gravity="fill"/>\n'
    '    </item>\n'
    '</layer-list>\n')

# ---- iOS app icon (full-bleed, no alpha: the OS applies the corner mask) ------
contents = json.loads((APPICONSET / 'Contents.json').read_text())
for entry in contents['images']:
    pts = float(entry['size'].split('x')[0])
    scale_n = int(entry['scale'].rstrip('x'))
    px = round(pts * scale_n)
    fname = f"icon-{entry['size'].split('x')[0]}@{scale_n}x.png" if entry['idiom'] != 'ios-marketing' else 'icon-1024.png'
    resized(ICON, px).convert('RGB').save(APPICONSET / fname, optimize=True)
    entry['filename'] = fname
(APPICONSET / 'Contents.json').write_text(json.dumps(contents, indent=2) + '\n')

# ---- iOS launch-screen logo ---------------------------------------------------
LAUNCH = IOS / 'LaunchLogo.imageset'
LAUNCH.mkdir(parents=True, exist_ok=True)
for n in (1, 2, 3):
    rounded(tile, 160 * n).save(LAUNCH / f'launch-logo@{n}x.png', optimize=True)
(LAUNCH / 'Contents.json').write_text(json.dumps({
    'images': [{'idiom': 'universal', 'scale': f'{n}x', 'filename': f'launch-logo@{n}x.png'} for n in (1, 2, 3)],
    'info': {'author': 'xcode', 'version': 1},
}, indent=2) + '\n')
print('done')
