#!/usr/bin/env python3
"""Regenerate evidence from the pinned SWF without modifying the playable port.

Raw FFDec exports stay in --work-dir. --reference-dir receives only curated,
permanent research artifacts. Requires FFDec 26.2.1, Java, Python, and SWFTools.
"""
import argparse
from collections import Counter
import copy
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_SWF = "0690936010c150a0f2592e838dbbb9deebaef24e448c89f8c60f2f6667dbb7d1"
SVG = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", XLINK)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def matrix(element):
    if element is None:
        return None
    a = element.attrib
    return [float(a.get("scaleX", 1)), float(a.get("rotateSkew0", 0)),
            float(a.get("rotateSkew1", 0)), float(a.get("scaleY", 1)),
            int(a.get("translateX", 0)) / 20, int(a.get("translateY", 0)) / 20]


def summarize_timeline(tags):
    frame = 1
    records = []
    for tag in tags:
        kind = tag.get("type")
        if kind == "ShowFrameTag":
            frame += 1
            continue
        if kind in ["SoundStreamHead2Tag", "EndTag"]:
            continue
        record = {"frame": frame, "type": kind}
        for field in ["characterId", "depth", "name", "ratio", "soundId", "clipDepth"]:
            if tag.get(field) is not None:
                record[field] = tag.get(field) if field == "name" else int(tag.get(field))
        transform = matrix(tag.find("matrix"))
        if transform is not None:
            record["matrix"] = transform
        color = tag.find("colorTransform")
        if color is not None:
            record["colorTransform"] = {k: v for k, v in color.attrib.items() if k not in ["type", "nbits"]}
        if kind == "DoActionTag":
            record["actionSha256"] = sha(bytes.fromhex(tag.get("actionBytes")))
        if kind == "PlaceObject2Tag":
            record["move"] = tag.get("placeFlagMove") == "true"
        records.append(record)
    return records


def svg_file(path, prefix):
    """Namespace fragment IDs so independently exported symbols can coexist."""
    text = path.read_text()
    identifiers = re.findall(r'\bid="([^"]+)"', text)
    for identifier in sorted(identifiers, key=len, reverse=True):
        text = text.replace(f'id="{identifier}"', f'id="{prefix}-{identifier}"')
        text = text.replace(f'"#{identifier}"', f'"#{prefix}-{identifier}"')
        text = text.replace(f'url(#{identifier})', f'url(#{prefix}-{identifier})')
    return ET.fromstring(text)


def canvas(width, height):
    result = ET.Element(f"{{{SVG}}}svg", {"width": str(width), "height": str(height), "viewBox": f"0 0 {width} {height}"})
    ET.SubElement(result, f"{{{SVG}}}rect", {"width": "100%", "height": "100%", "fill": "white"})
    return result


def save_svg(path, element):
    ET.ElementTree(element).write(path, encoding="utf-8", xml_declaration=True)


def stage_art(export, destination, sprite, frame, transform):
    source = svg_file(export / f"sprites/DefineSprite_{sprite}/{frame}.svg", f"s{sprite}")
    stage = canvas(800, 600)
    group = source.find(f"{{{SVG}}}g")
    # FFDec's outer transform only shifts its crop; restore registration coordinates.
    group.set("transform", "matrix(" + ",".join(map(str, transform)) + ")")
    for child in source:
        stage.append(copy.deepcopy(child))
    save_svg(destination, stage)


def make_sheet(export, destination, sprite, columns, rows, cell_width, cell_height):
    sheet = canvas(columns * cell_width + 70, rows * cell_height + 30)
    for owner in range(rows):
        text = ET.SubElement(sheet, f"{{{SVG}}}text", {"x": "8", "y": str(30 + owner * cell_height + cell_height / 2), "font-size": "14", "font-family": "sans-serif"})
        text.text = f"P{owner}"
        for item in range(columns):
            frame = owner * 10 + item + 1
            asset = svg_file(export / f"sprites/DefineSprite_{sprite}/{frame}.svg", f"s{sprite}f{frame}")
            width, height = [float(asset.get(key).replace("px", "")) for key in ["width", "height"]]
            asset.set("viewBox", f"0 0 {width} {height}")
            asset.set("x", str(70 + item * cell_width))
            asset.set("y", str(30 + owner * cell_height))
            asset.set("width", str(cell_width - 8))
            asset.set("height", str(cell_height - 12))
            sheet.append(asset)
    for item in range(columns):
        text = ET.SubElement(sheet, f"{{{SVG}}}text", {"x": str(70 + item * cell_width + cell_width / 2), "y": "20", "font-size": "14", "font-family": "sans-serif"})
        text.text = str(item + 1)
    save_svg(destination, sheet)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--swf", type=Path, default=ROOT.parent / "dice.swf")
    parser.add_argument("--ffdec-jar", type=Path, required=True)
    parser.add_argument("--java", default="java")
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--reference-dir", type=Path, required=True)
    args = parser.parse_args()
    args.swf = args.swf.resolve()
    args.ffdec_jar = args.ffdec_jar.resolve()
    work = args.work_dir.resolve()
    reference = args.reference_dir.resolve()
    data = args.swf.read_bytes()
    if sha(data) != EXPECTED_SWF:
        raise SystemExit("SWF fingerprint differs. Audit the new artifact before replacing reference evidence.")
    if data[:3] != b"CWS":
        raise SystemExit("Expected zlib-compressed SWF.")
    uncompressed = data[:8] + zlib.decompress(data[8:])
    if len(uncompressed) != struct.unpack_from("<I", data, 4)[0]:
        raise SystemExit("Invalid SWF declared size.")
    work.mkdir(parents=True, exist_ok=True)
    reference.mkdir(parents=True, exist_ok=True)
    java = [args.java, "-Djava.awt.headless=true", "-jar", str(args.ffdec_jar)]
    commands = [
        ["-swf2xml", str(args.swf), str(work / "original.xml")],
        ["-export", "script", str(work / "as"), str(args.swf)],
        ["-format", "script:pcode", "-export", "script", str(work / "pcode"), str(args.swf)],
        ["-format", "sprite:svg,button:svg,text:svg", "-export", "shape,sprite,button,text,font,sound", str(work / "assets"), str(args.swf)],
    ]
    for index, command in enumerate(commands):
        with (work / f"export-{index}.log").open("w") as log:
            subprocess.run(java + command, cwd=work, stdout=log, stderr=subprocess.STDOUT, check=True)
    with (work / "swfdump.txt").open("w") as log:
        subprocess.run(["swfdump", "-at", str(args.swf)], cwd=work, stdout=log, check=True)
    root = ET.parse(work / "original.xml").getroot()
    tags = root.find("tags")
    if root.get("_generator") != "JPEXS Free Flash Decompiler v.26.2.1":
        raise SystemExit("This evidence parser is pinned to FFDec 26.2.1. Review differences before changing the pin.")
    pcode = (work / "pcode/scripts/__Packages/dw/Game.pcode").read_text()
    owner_remainder = re.search(r'Push register12\s+Modulo\s+Push 1, "Math"', pcode) is not None
    if not owner_remainder:
        raise SystemExit("Expected owner-assignment Modulo bytecode not found.")
    source_names = {}
    for tag in tags:
        if tag.get("type") == "ExportAssetsTag":
            source_names.update(zip([int(x.text) for x in tag.find("tags")], [x.text for x in tag.find("names")]))
    sounds = []
    for tag in tags:
        if tag.get("type") != "DefineSoundTag":
            continue
        raw = bytes.fromhex(tag.get("soundData"))
        mp3 = raw[2:]
        # The embedded MPEG frame header says MPEG-2.5, Layer III, 11025 Hz,
        # 16 kbps, mono. Verify bytes, do not infer duration from filename.
        assert mp3[:4] == bytes.fromhex("ffe320c0")
        digest = sha(mp3)
        matches = [str(p.relative_to(ROOT)) for p in sorted((ROOT / "public/game-assets/audio").glob("*")) if sha(p.read_bytes()) == digest]
        sound_id = int(tag.get("soundId"))
        samples = int(tag.get("soundSampleCount"))
        sounds.append({"id": sound_id, "linkage": source_names.get(sound_id), "sampleRate": 11025,
                       "channels": 1, "bitrateKbps": 16, "seekSamples": int.from_bytes(raw[:2], "little", signed=True),
                       "soundSampleCount": samples, "declaredDurationSeconds": samples / 11025,
                       "mp3Bytes": len(mp3), "mp3Sha256": digest, "matchingPortFiles": matches})
    timelines = {"root": summarize_timeline(tags)}
    for tag in tags:
        if tag.get("type") == "DefineSpriteTag":
            timelines[tag.get("spriteId")] = {"frameCount": int(tag.get("frameCount")), "records": summarize_timeline(tag.find("subTags"))}
    fonts = []
    for tag in tags:
        if tag.get("type") == "DefineFont2Tag":
            fonts.append({"id": int(tag.get("fontID")), "name": tag.get("fontName"),
                          "glyphCount": len(tag.find("glyphShapeTable")),
                          "codes": [int(x.text) for x in tag.find("codeTable")]})
    button_sounds = [{k: v for k, v in tag.attrib.items() if k not in ["type", "forceWriteAsLong"]}
                     for tag in tags if tag.get("type") == "DefineButtonSoundTag"]
    source_hashes = {str(p.relative_to(work / "as")): sha(p.read_bytes()) for p in sorted((work / "as").rglob("*.as"))}
    manifest = {
        "schemaVersion": 1, "source": {"sha256": sha(data), "compressedBytes": len(data),
            "uncompressedBytes": len(uncompressed), "version": data[3], "frameRate": float(root.get("frameRate")),
            "rootFrames": int(root.get("frameCount")), "stage": {"width": 800, "height": 600, "background": "#ffffff"}},
        "tool": root.get("_generator"), "topLevelTagCounts": dict(sorted(Counter(t.get("type") for t in tags).items())),
        "ownerAssignmentModuloVerified": owner_remainder, "sounds": sounds, "buttonSounds": button_sounds,
        "fonts": fonts, "scriptSha256": source_hashes, "timelines": timelines,
        "renderWarning": "FFDec exports authored display lists; it does not execute AS2. Dynamic dice, text, visibility, map geometry and replay state require scripts. These are not Flash Player screenshots.",
    }
    dump(reference / "manifest.json", manifest)
    art = reference / "art"
    art.mkdir(exist_ok=True)
    assets = work / "assets"
    screens = [
        ("title-authored", 54, 1, [1.0001373, 0, 0, 1.0006561, 0, -20], "Title artwork", "Before AS2: player digits are placeholder 1s and dice colors/faces are not randomized. The live title uses 2–8 with 7 selected."),
        ("preview-controls", 134, 3, [1.0001678, 0, 0, 1.0024414, 0, 0], "Map preview controls", "The procedural map and global Back to Title button are separate layers."),
        ("battle-authored", 147, 1, [1, 0, 0, 1, 0, 0], "Battle authored layout", "Before AS2: all 16 default dice and placeholder totals are visible. Runtime hides them, then reveals attacker (right), defender (left). Map and HUD remain behind this layer."),
        ("loss-final", 159, 50, [1, 0, 0, 1, 2, -43.2], "Loss, final overlay", "The real map remains behind the translucent rectangle; this reference has white behind it."),
        ("win-final", 163, 40, [1, 0, 0, 1.0011444, 0, 0], "Win, final overlay", "The real map and HUD remain visible behind this layer. Only History is added here; the global title button remains."),
        ("history-controls", 169, 20, [1.0000458, 0, 0, 1, 0, 0], "History controls", "The replay map is drawn by AS2. No mcBar, mcSlider, or mcReplay instance exists in this SWF despite script references."),
    ]
    for name, sprite, frame, transform, _, _ in screens:
        stage_art(assets, art / f"{name}.svg", sprite, frame, transform)
    make_sheet(assets, art / "territory-dice.svg", 124, 8, 8, 95, 110)
    make_sheet(assets, art / "roll-dice.svg", 43, 6, 8, 105, 115)
    # A permanent copy of the overlooked sound, kept in reference material until
    # the production sound scheduler implements its correct press trigger.
    shutil.copyfile(assets / "sounds/15.mp3", reference / "button-sound.mp3")
    sections = []
    for name, _, _, _, title, note in screens:
        sections.append(f'<section><h2>{html.escape(title)}</h2><p>{html.escape(note)}</p><img src="art/{name}.svg" alt="{html.escape(title)}"></section>')
    for name, title in [("territory-dice", "All 64 active territory stacks"), ("roll-dice", "All 48 active rolling faces")]:
        sections.append(f'<section><h2>{title}</h2><p>Direct vector exports; rows are player IDs. Registration and scale are specified in the reference.</p><img src="art/{name}.svg" alt="{title}"></section>')
    sections.append('<section><h2>Missing button sound (symbol 15)</h2><audio controls src="button-sound.mp3"></audio><p>Raw MP3 evidence. This browser player does not apply the SWF seek/sample-count metadata.</p></section>')
    (reference / "atlas.html").write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dice Wars — original SWF artwork atlas</title><style>body{margin:32px auto;padding:0 20px;max-width:1000px;font:16px/1.5 system-ui;color:#222;background:#f4f4f4}section{margin:40px 0}img{display:block;max-width:100%;height:auto;background:white;border:1px solid #bbb}h1,h2{line-height:1.2}p{max-width:850px}code{font-size:13px}</style><h1>Original SWF artwork atlas</h1><p>Permanent research evidence for the native Dice Wars port. The drawings are exported from the original vectors, so enlargement preserves their shapes. These are authored-layer reconstructions, <strong>not screenshots of a running Flash Player</strong>. Read the note above every image.</p><p>Source SHA-256: <code>''' + EXPECTED_SWF + '</code></p>' + ''.join(sections) + '</html>\n')
    dump(reference / "art-sha256.json", {str(p.relative_to(reference)): sha(p.read_bytes()) for p in sorted(art.glob("*.svg"))})
    print(json.dumps({"sourceVerified": True, "scriptCount": len(source_hashes), "soundCount": len(sounds), "missingSounds": [s["id"] for s in sounds if not s["matchingPortFiles"]], "referenceDirectory": str(reference)}, indent=2))


if __name__ == "__main__":
    main()
