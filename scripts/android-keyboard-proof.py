#!/usr/bin/env python3
"""Compare les boutons ADB au bord réel du clavier Android 35 capturé."""
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

source = Path(sys.argv[1] if len(sys.argv) > 1 else "android-proof")
results = []
expected = {f"{width}-{scale}-keyboard" for width in (320, 360, 393, 430) for scale in ("1", "1.3", "1.5")}
for name in sorted(expected):
    root = ET.parse(source / (name + ".xml")).getroot()
    buttons = [node for node in root.iter("node") if node.get("resource-id") == "review-submit"]
    if len(buttons) != 1:
        raise AssertionError(f"{name}: bouton de publication absent ou ambigu")
    bounds = [int(value) for value in re.findall(r"\d+", buttons[0].get("bounds", ""))]
    dump = (source / (name + "-window.txt")).read_text()
    match = re.search(r"Window #\d+ Window\{[^\n]* InputMethod\}:([\s\S]*?)(?=\n  Window #|\Z)", dump)
    if not match:
        raise AssertionError(f"{name}: fenêtre du clavier absente")
    keyboard = match.group(1)
    if "isVisible=true" not in keyboard or "mViewVisibility=0x0" not in keyboard:
        raise AssertionError(f"{name}: clavier invisible lors de la capture")
    inset = re.search(r"mGivenContentInsets=\[0,(\d+)\]", keyboard)
    origin = re.search(r"Frames:.*? frame=\[0,(\d+)\]", keyboard)
    if not inset or not origin or len(bounds) != 4:
        raise AssertionError(f"{name}: mesures Android incomplètes")
    top = int(origin.group(1)) + int(inset.group(1))
    if not 0 < bounds[3] <= top:
        raise AssertionError(f"{name}: bouton couvert, bas={bounds[3]}, clavier={top}")
    results.append({"config": name, "publishBottomPx": bounds[3], "imeTopPx": top,
                    "clearanceDp": round((top - bounds[3]) / 3, 1), "passed": True})

payload = json.dumps(results, ensure_ascii=False, indent=2) + "\n"
if len(sys.argv) > 2:
    Path(sys.argv[2]).write_text(payload)
print(f"Clavier Android : {len(results)}/12 configurations validées ; marge minimale {min(row['clearanceDp'] for row in results)} dp.")
