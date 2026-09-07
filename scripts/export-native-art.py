#!/usr/bin/env python3
"""Extract registered native SVG assets and authored placements from pinned FFDec exports.
No SWF/code interpreter is included in the application. Run after audit-flash.py.
"""
import copy, hashlib, json, re, sys
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
WORK=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/dice-permanent-audit')
OUT=ROOT/'public/game-assets/vector'; OUT.mkdir(exist_ok=True)
SVG='http://www.w3.org/2000/svg'; FF='https://www.free-decompiler.com/flash'
ET.register_namespace('',SVG); ET.register_namespace('xlink','http://www.w3.org/1999/xlink')
manifest=json.loads((ROOT/'docs/flash-reference/manifest.json').read_text())
assert hashlib.sha256((ROOT.parent/'dice.swf').read_bytes()).hexdigest()==manifest['source']['sha256']
xml=ET.parse(WORK/'original.xml').getroot()
tags=list(xml.find('tags')); assets={}; scenes={}; fields={}; glyphs={}

def emit(key, source):
    tree=ET.parse(source); root=tree.getroot(); group=root.find(f'{{{SVG}}}g')
    width=float(root.get('width').replace('px','')); height=float(root.get('height').replace('px',''))
    transform=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',group.get('transform'))))
    assert transform[:4]==[1,0,0,1]
    x,y=-transform[4],-transform[5]
    root.set('viewBox',f'{x} {y} {width} {height}'); group.attrib.pop('transform')
    for node in root.iter():
        for k in list(node.attrib):
            if k.startswith('{'+FF+'}'): del node.attrib[k]
    path=OUT/f'{key}.svg'; tree.write(path,encoding='utf-8',xml_declaration=True)
    assets[key]={'x':x,'y':y,'width':width,'height':height,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':str(source.relative_to(WORK/'assets'))}

scene_ids=[8,11,44,50,52,54,134,141,154,159,162,163,169]
for id in scene_ids:
    timeline=manifest['timelines'][str(id)]; display={}; frames=[]
    for frame in range(1,timeline['frameCount']+1):
        for rec in timeline['records']:
            if rec['frame']!=frame: continue
            if rec['type']=='RemoveObject2Tag': display.pop(rec['depth'],None)
            if rec['type']=='PlaceObject2Tag':
                old=display.get(rec['depth'],{}) if rec.get('move') else {}
                display[rec['depth']]={**old,**{k:v for k,v in rec.items() if k in ['characterId','depth','matrix','name','colorTransform']}}
        frames.append([copy.deepcopy(display[d]) for d in sorted(display)])
    scenes[str(id)]=frames
needed=set(r['characterId'] for frames in scenes.values() for frame in frames for r in frame)
# The original stage's fixed instructions, title button and roll registrations.
stage=manifest['timelines']['170']['records']
placements=[r for r in stage if r['type']=='PlaceObject2Tag' and r.get('characterId') in [134,137,142,143,144,130,159,163,169]]
needed.update(r['characterId'] for r in placements)
for id in needed:
    if id in scene_ids or id in [43,124,10,49,139,145,146]: continue
    candidates=list((WORK/'assets/shapes').glob(f'{id}.svg'))+list((WORK/'assets/texts').glob(f'{id}.svg'))
    buttons=list((WORK/'assets/buttons').glob(f'DefineButton2_{id}'))
    if buttons:
        for name in ['1_up','2_over','3_down','4_hittest']: emit(f'b{id}-{name}',buttons[0]/f'{name}.svg')
    elif candidates: emit(str(id),candidates[0])
    else: raise ValueError(f'Missing symbol {id}')
for id,count in [(43,6),(124,8)]:
    for owner in range(8):
        for n in range(1,count+1):
            frame=owner*10+n
            emit(f's{id}-f{frame}',WORK/f'assets/sprites/DefineSprite_{id}/{frame}.svg')
# Dynamic fields: preserve original glyph outlines, 1024-unit advances and baseline.
fonts={t.get('fontID'):t for t in tags if t.get('type')=='DefineFont2Tag'}
for font_id in ['9','17']:
    font=fonts[font_id]
    for code,shape,advance in zip(font.find('codeTable'),font.find('glyphShapeTable'),font.find('fontAdvanceTable')):
        if int(code.text) not in list(range(48,58))+[37]: continue
        x=y=0; commands=[]
        for r in shape.find('shapeRecords'):
            kind=r.get('type')
            if kind=='StyleChangeRecord' and r.get('stateMoveTo')=='true':
                x=int(r.get('moveDeltaX','0'));y=int(r.get('moveDeltaY','0')); commands.append(f'M{x} {y}')
            elif kind=='StraightEdgeRecord':
                x+=int(r.get('deltaX','0'));y+=int(r.get('deltaY','0'));commands.append(f'L{x} {y}')
            elif kind=='CurvedEdgeRecord':
                cx=x+int(r.get('controlDeltaX','0'));cy=y+int(r.get('controlDeltaY','0'))
                x=cx+int(r.get('anchorDeltaX','0'));y=cy+int(r.get('anchorDeltaY','0'));commands.append(f'Q{cx} {cy} {x} {y}')
        glyphs[font_id+':'+chr(int(code.text))]={'path':' '.join(commands),'advance':int(advance.text)}
for t in tags:
    if t.get('type')!='DefineEditTextTag':continue
    font=fonts[t.get('fontId')]
    b=t.find('bounds');fields[t.get('characterID')]={'fontId':t.get('fontId'),'size':int(t.get('fontHeight'))/20,'align':int(t.get('align')),'x':int(b.get('Xmin'))/20,'y':int(b.get('Ymin'))/20,'width':(int(b.get('Xmax'))-int(b.get('Xmin')))/20,'ascent':int(font.get('fontAscent'))}
# A shared SVG symbol document keeps exact path hit testing and avoids per-frame requests.
sheet=ET.Element('{'+SVG+'}svg')
for key in assets:
    text=(OUT/f'{key}.svg').read_text()
    ids=re.findall(r'\bid="([^"]+)"',text)
    for identifier in sorted(ids,key=len,reverse=True):
        text=text.replace(f'id="{identifier}"',f'id="{key}-{identifier}"').replace(f'"#{identifier}"',f'"#{key}-{identifier}"').replace(f'url(#{identifier})',f'url(#{key}-{identifier})')
    node=ET.fromstring(text)
    wrapper=ET.SubElement(sheet,'{'+SVG+'}g',{'id':'v'+key})
    for child in node:wrapper.append(child)
ET.ElementTree(sheet).write(OUT/'symbols.svg',encoding='utf-8',xml_declaration=True)
result={'sourceSha256':manifest['source']['sha256'],'assets':assets,'scenes':scenes,'placements':placements,'rollPlacements':[r for r in manifest['timelines']['147']['records'] if r['type']=='PlaceObject2Tag'],'fields':fields,'glyphs':glyphs}
(ROOT/'app/flash-art.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
(ROOT/'docs/flash-reference/native-art-manifest.json').write_text(json.dumps({'sourceSha256':result['sourceSha256'],'tool':manifest['tool'],'assets':assets},indent=2)+'\n')
print(f'Exported {len(assets)} registered SVGs, original numeric glyph outlines, {len(scenes)} authored compositions.')
