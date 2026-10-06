#!/usr/bin/env python3
"""Builds compare/<name>.png = [demo | real] side by side, contact sheets (4 pairs per image) and compare/INDEX.md.
usage: compare.py <demo_dir> <real_dir> <compare_dir> <results.json>"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

demo_dir, real_dir, out_dir, results_path = sys.argv[1:5]
os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    if f.endswith('.png') or f == 'INDEX.md':
        os.remove(os.path.join(out_dir, f))
results = json.load(open(results_path)) if os.path.exists(results_path) else {}
names = sorted(os.path.splitext(f)[0] for f in os.listdir(demo_dir) if f.endswith('.png'))
H = 1688  # 844 * 2
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception:
    font = ImageFont.load_default()

def fit(im):
    im = im.convert('RGB')
    return im.resize((round(im.width * H / im.height), H), Image.LANCZOS)

pairs, lines = [], ['# Visual parity index', '', 'Each `<name>.png` is `[demo reference | real app]`.', '']
for n in names:
    rp = os.path.join(real_dir, n + '.png')
    r = results.get(n)
    ok = r is not None and r.get('ready') == 'ok' and os.path.exists(rp)
    errs = (r or {}).get('errors', [])
    if not r:
        status = 'NOT RENDERED (no scene)'
    elif r.get('ready') != 'ok':
        status = 'NO SCENE registered'
    elif errs:
        status = 'rendered with errors: ' + ' | '.join(e.replace('\n', ' ')[:240] for e in errs[:3])
    else:
        status = 'rendered ok'
    lines.append(f'- `{n}`: {status}')
    d = fit(Image.open(os.path.join(demo_dir, n + '.png')))
    if ok:
        rl = fit(Image.open(rp))
    else:
        rl = Image.new('RGB', (780, H), (230, 200, 200))
        ImageDraw.Draw(rl).text((40, 100), 'NOT RENDERED', fill=(120, 0, 0), font=font)
    gap = 24
    im = Image.new('RGB', (d.width + gap + rl.width, H), (255, 255, 255))
    im.paste(d, (0, 0)); im.paste(rl, (d.width + gap, 0))
    im.save(os.path.join(out_dir, n + '.png'))
    pairs.append((n, im))
open(os.path.join(out_dir, 'INDEX.md'), 'w').write('\n'.join(lines) + '\n')
# contact sheets: 4 pairs per image (2x2 for compactness), scaled down
S = 0.5
for i in range(0, len(pairs), 4):
    chunk = pairs[i:i + 4]
    cw = max(im.width for _, im in chunk); cell_w = int(cw * S); cell_h = int(H * S) + 40
    sheet = Image.new('RGB', (cell_w * 4 + 30, cell_h), (255, 255, 255))
    dr = ImageDraw.Draw(sheet)
    for j, (n, im) in enumerate(chunk):
        x = j * (cell_w + 10)
        dr.text((x + 4, 4), n, fill=(0, 0, 0), font=font)
        sheet.paste(im.resize((int(im.width * S), int(im.height * S)), Image.LANCZOS), (x, 40))
    sheet.save(os.path.join(out_dir, f'sheet-{i // 4 + 1:02d}.png'))
print(len(names), 'pairs,', (len(pairs) + 3) // 4, 'sheets')
