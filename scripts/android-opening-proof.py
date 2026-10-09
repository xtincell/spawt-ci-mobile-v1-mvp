#!/usr/bin/env python3
"""Refuse une ouverture où le splash masque tout le surgissement de Moka.

Le journal et une route atteinte ne prouvent pas une animation visible.
On inspecte la vidéo ADB à 30 images/s, avant l'écran d'entrée noir : le
repère natif seul est beige, Moka et ses étoiles contiennent du doré.
Le clin d'œil est comparé aux images du pack, puis l'œil doit se rouvrir.
Ce contrôle prouve les étapes visibles, pas la fluidité sur téléphone.
"""
import json
from pathlib import Path
import subprocess
import sys

import imageio_ffmpeg
from PIL import Image, ImageChops, ImageStat

source = Path(sys.argv[1] if len(sys.argv) > 1 else "android-proof")
width, height, fps = 393, 800, 30
assets = Path(__file__).resolve().parent.parent / "app/assets/brand"
atlas_meta = json.loads((assets / "window-opening.atlas.json").read_text())
atlas = Image.open(assets / "window-opening.atlas.png").convert("RGB")


def reference_frame(index):
    x = index % atlas_meta["columns"] * atlas_meta["frameWidth"]
    y = index // atlas_meta["columns"] * atlas_meta["frameHeight"]
    return atlas.crop((x, y, x + atlas_meta["frameWidth"], y + atlas_meta["frameHeight"])).resize((200, 320), Image.Resampling.LANCZOS)


def black_box(image):
    channels = image.split()
    mask = channels[0].point(lambda value: 255 if value < 100 else 0)
    for channel in channels[1:]:
        mask = ImageChops.multiply(mask, channel.point(lambda value: 255 if value < 100 else 0))
    return mask.getbbox()


eye_box = (65, 107, 105, 140)
closed_refs = [reference_frame(index).crop(eye_box).convert("L") for index in [45, 47, 49, 51]]
open_refs = [reference_frame(index).crop(eye_box).convert("L") for index in [39, 55, 61, 68]]
pin_box = black_box(reference_frame(0))
assert pin_box is not None
origin = None
eye_samples = []


def eye_distance(image, refs):
    # Un pixel de tolérance pour le centrage demi-pixel et le JPEG de screenrecord.
    distances = []
    for dx in [-1, 0, 1]:
        for dy in [-1, 0, 1]:
            left, top, right, bottom = eye_box
            eye = image.crop((origin[0] + left + dx, origin[1] + top + dy,
                              origin[0] + right + dx, origin[1] + bottom + dy)).convert("L")
            distances.extend(ImageStat.Stat(ImageChops.difference(eye, ref)).mean[0] for ref in refs)
    return min(distances)


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
        if origin is None:
            # Le repère initial aligne le viewport sans dépendre du temps de boot.
            initial_box = black_box(image.crop((80, 230, 315, 530)))
            if initial_box and 142 <= initial_box[2] - initial_box[0] <= 150 and 179 <= initial_box[3] - initial_box[1] <= 185:
                origin = (80 + initial_box[0] - pin_box[0], 230 + initial_box[1] - pin_box[1])
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
        if origin is not None:
            closed = eye_distance(image, closed_refs)
            opened = eye_distance(image, open_refs)
            eye_samples.append({"second": round(frame_index / fps, 3),
                                "closedDistance": round(closed, 2), "openDistance": round(opened, 2),
                                "closed": closed <= 18 and closed + 3 < opened,
                                "open": opened <= 18 and opened + 3 < closed})
        consecutive += 1
        longest = max(longest, consecutive)
    else:
        consecutive = 0
    frame_index += 1
if process.wait() != 0:
    raise RuntimeError("Décodage vidéo Android échoué")
early = [frame for frame in visible if frame["second"] <= visible[0]["second"] + .45] if visible else []
travel = max(frame["goldCenterY"] for frame in early) - min(frame["goldCenterY"] for frame in early) if early else 0
closed_samples = [frame for frame in eye_samples if frame["closed"]]
reopened = [frame for frame in eye_samples if frame["open"] and closed_samples and frame["second"] > closed_samples[-1]["second"]]
wink_passed = len(closed_samples) >= 2 and len(reopened) >= 2
passed = longest >= 10 and travel >= 20 and wink_passed
payload = {"passed": passed, "sampleFps": fps, "sampledFrames": frame_index,
           "visibleFrames": len(visible), "longestVisibleSeconds": round(longest / fps, 3),
           "minimumVisibleSeconds": round(10 / fps, 3), "earlyMotionSeconds": .45,
           "earlyGoldTravelPixels": round(travel, 2), "minimumGoldTravelPixels": 20,
           "viewportOrigin": origin, "winkPassed": wink_passed,
           "closedEyeFrames": len(closed_samples), "reopenedEyeFrames": len(reopened),
           "maximumEyeDistance": 18, "minimumEyeDistanceMargin": 3,
           "visible": visible, "eyeSamples": eye_samples}
(source / "opening-visibility.json").write_text(json.dumps(payload, indent=2) + "\n")
print(f"Moka : {len(visible)} images ; présence continue {longest / fps:.3f}s ; déplacement {travel:.2f}px ; clin d'œil {len(closed_samples)} images puis réouverture {len(reopened)} images.")
if not passed:
    raise AssertionError("Animation V2 masquée, sans surgissement ou sans clin d'œil suivi de la réouverture")
