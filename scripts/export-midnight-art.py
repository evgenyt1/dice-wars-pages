"""Recolor original registered vector paths for the approved Midnight design."""
from pathlib import Path
import xml.etree.ElementTree as ET
import re
from math import floor

ROOT = Path(__file__).resolve().parents[1]
SVG = 'http://www.w3.org/2000/svg'
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
COLORS = re.findall(r"color: '(#[0-9a-f]{6})'", (ROOT / 'app/game-presentation.ts').read_text())
assert len(COLORS) == 8


def mix(a, b, amount):
    # Match Math.round and the mixing order used in the approved preview.
    return '#' + ''.join(f'{floor(int(a[i:i+2],16)+(int(b[i:i+2],16)-int(a[i:i+2],16))*amount+.5):02x}' for i in [1,3,5])


result = ET.Element(f'{{{SVG}}}svg')
defs = ET.SubElement(result, f'{{{SVG}}}defs')
for owner, color in enumerate(COLORS):
    face = mix(color, '#f3ecd7', .82)
    left = mix(color, '#c2d3ca', .44)
    right = mix(color, '#193947', .72)
    pip = mix(color, '#344d5b', .88)
    shades = {
        '#b544ff': mix(left, right, .35),
        '#7502e6': face,
        '#6500c9': face,
        '#4a0094': left,
        '#330067': mix(face, right, .35),
        '#1c0037': right,
        '#0a0013': mix(right, '#45585b', .25),
        '#ffffff': pip,
        '#cccccc': mix(left, pip, .80),
        '#999999': mix(right, '#d9ddc9', .70),
    }
    for kind, sprite, count in [('stack', 124, 8), ('face', 43, 6)]:
        for index in range(1, count + 1):
            source = ET.parse(ROOT / f'public/game-assets/vector/s{sprite}-f{index}.svg').getroot()
            name = f'{kind}-{owner}-{index}'
            ids = {e.attrib['id']: name+'-'+e.attrib['id'] for e in source.iter() if 'id' in e.attrib}
            for element in source.iter():
                if 'id' in element.attrib:
                    element.set('id', ids[element.attrib['id']])
                for key, value in list(element.attrib.items()):
                    if key == f'{{{XLINK}}}href':
                        del element.attrib[key]
                        element.set('href', '#'+ids[value[1:]])
                    elif key in ['fill', 'stroke'] and value in shades:
                        element.set(key, shades[value])
                    elif key == 'fill-opacity':
                        element.set(key, '.24')
            group = ET.SubElement(defs, f'{{{SVG}}}g', id=name)
            group.extend(list(source))
output = ROOT / 'public/game-assets/vector/midnight.svg'
ET.ElementTree(result).write(output, encoding='utf-8', xml_declaration=True)
print(f'Wrote {output.stat().st_size} bytes; registration, path geometry, and stack counts preserved.')
