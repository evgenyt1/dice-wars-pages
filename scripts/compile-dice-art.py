#!/usr/bin/env python3
"""Resolve the preserved dice SVG references into resident, direct path data.

No geometry, colors, draw ordering or registration is redesigned. The compiler
rejects unsupported SVG rather than silently losing rendering semantics.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def compile_art():
    paths, path_ids, frames = [], {}, {}
    for theme, filename in [('original', 'symbols'), ('midnight', 'midnight')]:
        root = ET.parse(ROOT / f'public/game-assets/vector/{filename}.svg').getroot()
        ids = {node.get('id'): node for node in root.iter() if node.get('id')}

        def draw(node, transforms=()):
            tag = node.tag.rsplit('}', 1)[-1]
            if tag == 'defs':
                return []
            attrs = dict(node.attrib)
            attrs.pop('id', None)
            transform = attrs.pop('transform', None)
            if transform:
                transforms = (*transforms, transform)
            if tag == 'use':
                href = attrs.pop('href', None) or attrs.pop('{http://www.w3.org/1999/xlink}href')
                attrs.pop('width', None)
                attrs.pop('height', None)
                assert not attrs and href.startswith('#'), (tag, attrs)
                target = ids[href[1:]]
                assert target.tag.endswith('}g')
                return draw(target, transforms)
            if tag == 'g':
                assert not attrs, attrs
                return [path for child in node for path in draw(child, transforms)]
            assert tag == 'path', tag
            assert set(attrs) <= {'d', 'fill', 'fill-opacity', 'fill-rule', 'stroke'}, attrs
            assert attrs['stroke'] == 'none' and attrs['fill-rule'] == 'evenodd'
            assert attrs['fill'].startswith('#'), attrs
            d = attrs['d']
            if d not in path_ids:
                path_ids[d] = len(paths)
                paths.append(d)
            result = {'path': path_ids[d], 'fill': attrs['fill'], 'transform': ' '.join(transforms)}
            if 'fill-opacity' in attrs:
                result['fillOpacity'] = attrs['fill-opacity']
            return [result]

        for kind, maximum, sprite in [('stack', 8, 124), ('face', 6, 43)]:
            for owner in range(8):
                for count in range(1, maximum + 1):
                    symbol = f'vs{sprite}-f{owner * 10 + count}' if theme == 'original' else f'{kind}-{owner}-{count}'
                    frames[f'{theme}-{kind}-{owner}-{count}'] = draw(ids[symbol])
    return {'paths': paths, 'frames': frames}


if __name__ == '__main__':
    content = json.dumps(compile_art(), separators=(',', ':')) + '\n'
    target = ROOT / 'app/dice-art.json'
    if '--check' in sys.argv:
        assert target.read_text() == content, 'Run python3 scripts/compile-dice-art.py'
        print('All 224 resident dice frames match the preserved SVG banks.')
    else:
        target.write_text(content)
