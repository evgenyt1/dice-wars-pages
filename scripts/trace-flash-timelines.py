#!/usr/bin/env python3
"""Add frame-name/GetTime traces to a research COPY of the pinned exported XML.
Run FFDec -xml2swf on the output, then use Ruffle traceObserver after load resolves.
Never serves, modifies or embeds the authoritative SWF in the production site.
"""
import argparse,hashlib,struct
from pathlib import Path
import xml.etree.ElementTree as ET
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('input_xml',type=Path);p.add_argument('output_xml',type=Path)
a=p.parse_args()
source=Path(__file__).resolve().parents[2]/'dice.swf'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='0690936010c150a0f2592e838dbbb9deebaef24e448c89f8c60f2f6667dbb7d1'
assert a.input_xml.resolve()!=a.output_xml.resolve()
r=ET.parse(a.input_xml)
for sprite in r.getroot().find('tags'):
    if sprite.get('type')!='DefineSpriteTag' or sprite.get('spriteId') not in ['149','169']:continue
    frame=1;tags=sprite.find('subTags')
    for tag in list(tags):
        if tag.get('type')!='ShowFrameTag':continue
        payload=b'\x00'+f'S{sprite.get("spriteId")}/f{frame}'.encode()+b'\x00'
        # ActionPush string; ActionTrace; ActionGetTime; ActionTrace; end.
        action=b'\x96'+struct.pack('<H',len(payload))+payload+b'\x26\x34\x26\x00'
        tags.insert(list(tags).index(tag),ET.Element('item',{'type':'DoActionTag','actionBytes':action.hex(),'forceWriteAsLong':'true'}))
        frame+=1
r.write(a.output_xml)
