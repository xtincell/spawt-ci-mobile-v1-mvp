#!/usr/bin/env python3
"""Refuse une ouverture où le splash masque tout le surgissement de Moka.

Le journal et une route atteinte ne prouvent pas une animation visible.
On inspecte la vidéo ADB à 30 images/s, avant l'écran d'entrée noir : le
repère natif seul est beige, Moka et ses étoiles contiennent du doré.
Ce contrôle prouve une présence et un surgissement visibles, pas la fluidité sur téléphone.
"""
import json
from pathlib import Path
import subprocess
import sys

import imageio_ffmpeg
from PIL import Image, ImageChops

source = Path(sys.argv[1] if len(sys.argv) > 1 else "android-proof")
width, height, fps = 393, 800, 30
process = subprocess.Popen([
    imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error",
    "-i", str(source / "opening.mp4"), "-vf", f"fps={fps},scale={width}:{height}",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
], stdout=subprocess.PIPE)
assert process.stdout is not None
visible = []
frame_index = consecutive = longest = 0
while True:
    frame = process.stdout.read(width * height * 3)
    if not frame:
        break
    if len(frame) != width * height * 3:
        raise RuntimeError("Image vidéo Android incomplète")
    image = Image.frombytes("RGB", (width, height), frame)
    white = all(min(image.getpixel(point)) >= 245 for point in
                [(10, 100), (383, 100), (10, 400), (383, 400)])
    gold_count = 0
    if white:
        red, green, blue = image.crop((80, 190, 315, 490)).split()
        masks = [red.point(lambda value: 255 if 135 <= value <= 245 else 0),
                 green.point(lambda value: 255 if 85 <= value <= 210 else 0),
                 blue.point(lambda value: 255 if value <= 130 else 0),
                 ImageChops.subtract(red, green).point(lambda value: 255 if value > 10 else 0)]
        mask = masks[0]
        for item in masks[1:]:
            mask = ImageChops.multiply(mask, item)
        gold_count = mask.histogram()[255]
    if gold_count >= 120:
        # Le build 18 affichait une pose presque fixe puis un fondu : compter
        # seulement les images visibles ne détectait pas ce défaut. Le centre
        # du doré doit monter pendant les premières 450 ms du surgissement.
        rows = mask.resize((1, mask.height), Image.Resampling.BOX).tobytes()
        center_y = 190 + sum(y * value for y, value in enumerate(rows)) / sum(rows)
        visible.append({"second": round(frame_index / fps, 3), "goldPixels": gold_count,
                        "goldCenterY": round(center_y, 2)})
        consecutive += 1
        longest = max(longest, consecutive)
    else:
        consecutive = 0
    frame_index += 1
if process.wait() != 0:
    raise RuntimeError("Décodage vidéo Android échoué")
early = [frame for frame in visible if frame["second"] <= visible[0]["second"] + .45]
travel = max(frame["goldCenterY"] for frame in early) - min(frame["goldCenterY"] for frame in early) if early else 0
passed = longest >= 10 and travel >= 20
payload = {"passed": passed, "sampleFps": fps, "sampledFrames": frame_index,
           "visibleFrames": len(visible), "longestVisibleSeconds": round(longest / fps, 3),
           "minimumVisibleSeconds": round(10 / fps, 3), "earlyMotionSeconds": .45,
           "earlyGoldTravelPixels": round(travel, 2), "minimumGoldTravelPixels": 20,
           "visible": visible}
(source / "opening-visibility.json").write_text(json.dumps(payload, indent=2) + "\n")
print(f"Moka sur fond blanc : {len(visible)} images ; présence continue {longest / fps:.3f}s ; déplacement {travel:.2f}px.")
if not passed:
    raise AssertionError("Animation V2 masquée ou sans surgissement visible")
