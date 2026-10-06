#!/usr/bin/env python3
"""Aggregates the per-config layout JSON written by shoot.mjs (LAYOUT=<dir>) into
   <out>/layout-report.md   human summary (counts per device x font scale, worst offenders)
   <out>/summary.json       machine-readable counts
   <out>/sheets/<device>__fs<scale>-NN.png   contact sheets of the PNGs in <shots>/<device>/fs<scale>/ (optional)
usage: report.py <layout_dir> <out_dir> [--title T] [--baseline <layout_dir>] [--sheets dev:fs,dev:fs ...] [--shots <dir>]"""
import json, os, sys, glob, collections, argparse

ap = argparse.ArgumentParser()
ap.add_argument('layout'); ap.add_argument('out')
ap.add_argument('--title', default='Layout report')
ap.add_argument('--baseline')
ap.add_argument('--sheets', default='')
ap.add_argument('--shots')
ap.add_argument('--only-scenes', default='')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

def load(d):
    res = {}
    for f in glob.glob(os.path.join(d, '*__fs*', '*.json')):
        j = json.load(open(f))
        if 'violations' not in j: continue
        res[(j['device'], float(j['fontScale']), j['scene'].split(':')[0])] = j
    return res

def count(res):
    c = collections.defaultdict(lambda: collections.Counter())
    for (dev, fs, scene), j in res.items():
        for v in j['violations']:
            c[(dev, fs)][v['type'] if v['sev'] == 'error' else 'warn:' + v['type']] += 1
            c[(dev, fs)]['_errors' if v['sev'] == 'error' else '_warns'] += 1
        c[(dev, fs)]['_scenes'] += 1
        if any(v['sev'] == 'error' for v in j['violations']): c[(dev, fs)]['_scenes_with_errors'] += 1
    return c

cur = load(a.layout)
base = load(a.baseline) if a.baseline else {}
cc, bc = count(cur), count(base)
DEVS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'devices.json')))
order = lambda k: (list(DEVS).index(k[0]) if k[0] in DEVS else 99, k[1])
keys = sorted(cc.keys(), key=order)
TYPES = ['page-hscroll', 'scroll-hclip', 'beyond-viewport', 'offscreen', 'text-clipped', 'text-word-broken', 'target-small', 'overlap-text', 'overlap-control', 'overlap-control-text']

lines = [f'# {a.title}', '', 'Errors = page-hscroll, scroll-hclip, beyond-viewport, offscreen, text-clipped, text-word-broken, target-small (<44 pt incl. hitSlop), overlap-text, overlap-control, overlap-control-text.',
         'Warnings (not counted) = text-truncated (ellipsis / line clamp). Counts are per (scene x device x font scale).', '']
summary = {}
hdr = '| device | font | scenes | scenes with errors | errors | ' + ('before | ' if base else '') + ' | '.join(TYPES) + ' | truncated (warn) |'
lines += [hdr, '|' + '---|' * (hdr.count('|') - 1)]
for k in keys:
    c = cc[k]; b = bc.get(k)
    row = f'| {k[0]} | {k[1]:g} | {c["_scenes"]} | {c["_scenes_with_errors"]} | **{c["_errors"]}** | ' + (f'{b["_errors"] if b else "-"} | ' if base else '') + ' | '.join(str(c[t]) for t in TYPES) + f' | {c["_warns"]} |'
    lines.append(row)
    summary[f'{k[0]}|{k[1]:g}'] = {'scenes': c['_scenes'], 'scenes_with_errors': c['_scenes_with_errors'], 'errors': c['_errors'], 'before_errors': (b['_errors'] if b else None), **{t: c[t] for t in TYPES}, 'truncated': c['_warns']}
tot = sum(c['_errors'] for c in cc.values()); totb = sum(c['_errors'] for c in bc.values()) if base else None
lines += ['', f'Total errors: **{tot}**' + (f' (baseline {totb})' if base else ''), '']

# worst offenders: group by (scene, type, desc, text) across configs
agg = collections.defaultdict(lambda: {'n': 0, 'cfg': set()})
for (dev, fs, scene), j in cur.items():
    for v in j['violations']:
        if v['sev'] != 'error': continue
        key = (scene, v['type'] + (' (end of scroll)' if v.get('phase') else ''), v['desc'], v.get('text', '')[:40] if v['type'] not in ('target-small',) else v['desc'])
        agg[key]['n'] += 1; agg[key]['cfg'].add(f'{dev}@{fs:g}')
lines += ['## Worst offenders (error, by scene / element, number of device x font configurations affected)', '', '| n | scene | type | element | text / size | e.g. configs |', '|---|---|---|---|---|---|']
for key, v in sorted(agg.items(), key=lambda kv: -kv[1]['n'])[:60]:
    lines.append(f'| {v["n"]} | {key[0]} | {key[1]} | `{key[2]}` | {key[3]} | {", ".join(sorted(v["cfg"])[:3])} |')
by_scene = collections.Counter()
for (dev, fs, scene), j in cur.items(): by_scene[scene] += sum(1 for v in j['violations'] if v['sev'] == 'error')
lines += ['', '## Errors per scene (all configurations)', '', '| scene | errors |', '|---|---|'] + [f'| {s} | {n} |' for s, n in by_scene.most_common() if n]
open(os.path.join(a.out, 'layout-report.md'), 'w').write('\n'.join(lines) + '\n')
json.dump(summary, open(os.path.join(a.out, 'summary.json'), 'w'), indent=1)
print('\n'.join(lines[:40]))

if a.sheets and a.shots:
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs(os.path.join(a.out, 'sheets'), exist_ok=True)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    except Exception: font = ImageFont.load_default()
    for spec in a.sheets.split(','):
        dev, fs = spec.split(':')
        d = os.path.join(a.shots, dev, f'fs{fs}')
        if not os.path.isdir(d): print('no shots', d); continue
        names = sorted(f[:-4] for f in os.listdir(d) if f.endswith('.png'))
        if a.only_scenes: names = [n for n in names if n in a.only_scenes.split(',')]
        D = DEVS[dev]; th = 520; tw = int(D['w'] * th / D['h'])
        cols = max(2, min(8, 1600 // (tw + 8)))
        per = cols * 2
        for pi in range(0, len(names), per):
            chunk = names[pi:pi + per]
            rows = (len(chunk) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * (tw + 8) + 8, rows * (th + 34) + 8), (60, 60, 60))
            dr = ImageDraw.Draw(sheet)
            for i, n in enumerate(chunk):
                x = 8 + (i % cols) * (tw + 8); y = 8 + (i // cols) * (th + 34)
                nerr = sum(1 for v in cur.get((dev, float(fs), n), {'violations': []})['violations'] if v['sev'] == 'error')
                dr.text((x, y), f'{n} [{nerr}]', fill=(255, 255, 255) if nerr == 0 else (255, 160, 120), font=font)
                im = Image.open(os.path.join(d, n + '.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
                sheet.paste(im, (x, y + 26))
            sheet.save(os.path.join(a.out, 'sheets', f'{dev}__fs{fs}-{pi // per + 1:02d}.png'))
        print('sheets', dev, fs, len(names))
