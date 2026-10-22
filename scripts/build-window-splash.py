#!/usr/bin/env python3
"""Première pose du pack V2 en VectorDrawable, cadrée pour le splash Android.
Android masque l'icône dans un cercle de 192 dp :
https://developer.android.com/develop/ui/views/launch/splash-screen
Les tracés fournis sont conservés ; seul leur cadrage est centré.
"""
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
paths = json.loads((root / 'app/assets/brand/window-opening.paths.json').read_text())
art = (root / 'app/src/components/brand/window-opening-art.ts').read_text()
pin = re.search(r'export const PIN = "([^"]+)";', art).group(1)
scale, center_x, center_y = .49, 309, 241.5

# Vérifier le contour complet, épaisseur comprise, avant de produire le XML.
numbers = list(map(float, re.findall(r'-?\d+(?:\.\d+)?', pin)))
point = tuple(numbers[:2])
radii = []
for start in range(2, len(numbers), 6):
    a, b, c = [tuple(numbers[start + k:start + k + 2]) for k in (0, 2, 4)]
    for step in range(101):
        t = step / 100
        xy = [((1-t)**3*point[i] + 3*(1-t)**2*t*a[i] + 3*(1-t)*t*t*b[i] + t**3*c[i]) for i in (0, 1)]
        radii.append(math.hypot(xy[0] - center_x, xy[1] - center_y) * scale + 5.5 * scale)
    point = c
if max(radii) > 96:
    raise AssertionError('Le contour dépasse le masque natif Android')

ns = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', ns)
def attrs(**values):
    return {f'{{{ns}}}{key}': str(value) for key, value in values.items()}
def path(parent, d, fill='#00000000', **values):
    if len(fill) == 4:
        fill = '#' + ''.join(char * 2 for char in fill[1:])
    return ET.SubElement(parent, 'path', attrs(pathData=d, fillColor=fill, **values))

vector = ET.Element('vector', attrs(width='288dp', height='288dp', viewportWidth=288, viewportHeight=288))
scene = ET.SubElement(vector, 'group', attrs(scaleX=scale, scaleY=scale, translateX=144-center_x*scale, translateY=144-center_y*scale))
path(scene, pin, '#FBF9F5')
aperture = ET.SubElement(scene, 'group')
ET.SubElement(aperture, 'clip-path', attrs(pathData=pin))
for ident in [*range(22, 37), 40, 41]:
    shape = paths[str(ident)]
    if shape['tag'] == 'circle':
        x, y, r = shape['cx'], shape['cy'], shape['r']
        d = f'M{x-r},{y} a{r},{r} 0 1,0 {2*r},0 a{r},{r} 0 1,0 {-2*r},0'
    else:
        d = shape['d']
    path(aperture, d, shape['fill'])
edge = ET.SubElement(aperture, 'group', attrs(translateY=7))
path(edge, pin, strokeColor='#E8E2D6', strokeWidth=7)
path(scene, pin, strokeColor='#333333', strokeWidth=11, strokeLineJoin='round')
rim = ET.SubElement(scene, 'group')
ET.SubElement(rim, 'clip-path', attrs(pathData='M100,181 H550 V501 H100 Z'))
path(rim, pin, strokeColor='#333333', strokeWidth=11, strokeLineJoin='round')
ET.indent(vector, '  ')
target = root / 'app/assets/brand/window-repere.android.xml'
ET.ElementTree(vector).write(target, encoding='utf-8', xml_declaration=True)
print(f'Contour natif entier : rayon maximal {max(radii):.2f} dp / 96 dp ; {target.name}')
