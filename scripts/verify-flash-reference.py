#!/usr/bin/env python3
"""Read-only integrity and consistency checks for the committed research bundle."""
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "docs/flash-reference"
manifest = json.loads((REFERENCE / "manifest.json").read_text())
report = json.loads((REFERENCE / "oracle-report.json").read_text())
fixtures = json.loads((REFERENCE / "map-fixtures.json").read_text())
art_hashes = json.loads((REFERENCE / "art-sha256.json").read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()

assert sha((ROOT.parent / "dice.swf").read_bytes()) == manifest["source"]["sha256"]
assert manifest["source"]["stage"] == {"width": 800, "height": 600, "background": "#ffffff"}
assert len(manifest["scriptSha256"]) == 66
assert manifest["ownerAssignmentModuloVerified"] is True
assert len(manifest["sounds"]) == 8
assert [sound["id"] for sound in manifest["sounds"] if not sound["matchingPortFiles"]] == [15]
for sound in manifest["sounds"]:
    files = [ROOT / name for name in sound["matchingPortFiles"]]
    if sound["id"] == 15:
        files.append(REFERENCE / "button-sound.mp3")
    for file in files:
        assert sha(file.read_bytes()) == sound["mp3Sha256"], file
    assert sound["seekSamples"] == 1661
for name, digest in report["sourceHashes"].items():
    assert digest == manifest["scriptSha256"][name]
    assert digest == fixtures["sourceHashes"][name]
assert report["mapCases"] == 70 == len(report["cases"])
assert len(report["aiProbes"]) == 6
assert len(report["simulations"]) == 21
assert {r["playerCount"] for r in report["simulations"]} == set(range(2, 9))
assert all(0 <= r["winner"] < r["playerCount"] and r["turns"] < 20000 for r in report["simulations"])
for field, count in report["differences"].items():
    assert count == sum(case["differences"][field] for case in report["cases"])

for fixture in fixtures["fixtures"] + [fixtures["reroll"]["secondMap"]]:
    cells = fixture["cells"]
    territories = fixture["territories"]
    assert len(cells) == 896 and len(territories) == 32
    assert all(0 <= cell < 32 for cell in cells)
    assert sorted(fixture["turnOrder"]) == list(range(fixture["playerCount"]))
    active = [territory for territory in territories if territory["size"]]
    for index, territory in enumerate(active):
        tid = territory["id"]
        assert territory["size"] == cells.count(tid) > 5
        assert territory["owner"] == index % fixture["playerCount"]
        assert 1 <= territory["dice"] <= 8
        assert cells[territory["centerCell"]] == tid
        assert 1 <= len(territory["outline"]) <= 101
        for point in territory["outline"]:
            assert cells[point["cell"]] == tid and 0 <= point["direction"] < 6
        assert territory["outline"][0] == territory["outline"][-1]
        for neighbor in territory["neighbors"]:
            assert territories[neighbor]["size"] > 0 and neighbor != tid
    assert sum(t["dice"] for t in active) == len(active) * 3

for name, digest in art_hashes.items():
    file = REFERENCE / name
    assert sha(file.read_bytes()) == digest, file
    root = ET.fromstring(file.read_bytes())
    ids = [element.get("id") for element in root.iter() if element.get("id")]
    assert len(ids) == len(set(ids)), f"Duplicate SVG IDs: {name}"
    for element in root.iter():
        for key, value in element.attrib.items():
            if key.endswith("}href") or key == "href":
                assert value.startswith("#") and value[1:] in ids, (name, value)
            for target in re.findall(r"url\(#([^)]*)\)", value):
                assert target in ids, (name, target)
        assert element.tag.rsplit("}", 1)[-1] not in ["script", "foreignObject", "image"]
atlas = (REFERENCE / "atlas.html").read_text()
for source in re.findall(r'src="([^"]+)"', atlas):
    assert (REFERENCE / source).is_file(), source
for document in [ROOT / "docs/FLASH_PORT_REFERENCE.md", ROOT / "docs/FLASH_FIDELITY_PLAN.md", REFERENCE / "README.md"]:
    for target in re.findall(r'\]\(([^)]+)\)', document.read_text()):
        if not target.startswith(("https://", "http://", "#")):
            assert (document.parent / target).exists(), (document, target)

print("Verified: pinned SWF, 66 script identities, 8 sound payloads, 8 vector plates, 70 comparisons, 6 AI probes, 21 completed simulations, 8 map fixtures, and local reference links.")
current = sha((ROOT / "app/game-engine.ts").read_bytes())
print("Compared engine:", "matches recorded baseline" if current == report["comparedEngineSha256"] else "changed since recorded baseline; rerun the oracle for current comparison")
