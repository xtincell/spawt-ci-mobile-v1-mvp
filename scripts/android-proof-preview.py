#!/usr/bin/env python3
"""Aperçus de recette, dérivés des captures ADB originales conservées séparément."""
from PIL import Image, ImageDraw
import pathlib, re, shutil, sys

source = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'android-proof')
target = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'android-preview'); target.mkdir(exist_ok=True)
groups = {}
for path in sorted(source.glob('*.png')):
    match = re.match(r'(320|360|393|430)-(1|1\.3|1\.5)-(.+)\.png$', path.name)
    if match:
        groups.setdefault(match[3], []).append(path)
    else:
        image = Image.open(path).convert('RGB')
        image.thumbnail((640, 1600))
        image.save(target / (path.stem + '.jpg'), quality=85)
for kind, paths in groups.items():
    sheet = Image.new('RGB', (1280, 3 * 700), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        x, y = (index % 4) * 320, (index // 4) * 700
        draw.text((x + 8, y + 5), path.stem, fill='black')
        image = Image.open(path).convert('RGB'); image.thumbnail((310, 672))
        sheet.paste(image, (x + 5, y + 24))
    sheet.save(target / (kind + '-matrix.jpg'), quality=85)
for path in source.glob('*.xml'):
    shutil.copy2(path, target / path.name)
for name in ['assertions.json', 'logcat.txt', 'package.txt', 'apk.url']:
    if (source / name).exists(): shutil.copy2(source / name, target / name)
