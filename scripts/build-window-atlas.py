#!/usr/bin/env python3
"""Cadres exacts du MP4 V2 fourni, sans réinterpréter ses tracés SVG.

Une seule texture, chargée avant le retrait du splash, évite les décodages
par image. L'atlas reste sous 4096 px dans chaque direction. Le mouvement
est joué à 60 images/s ; la pose finale reste disponible pendant la reprise.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "app/assets/brand/window-opening.source.mp4"
target = root / "app/assets/brand"
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
width, height, frames, columns = 350, 560, 69, 10
atlas = Image.new("RGB", (width * columns, height * 7), "white")
process = subprocess.Popen([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(source),
    "-vf", "fps=60,crop=600:960:240:578,scale=350:560:flags=lanczos",
    "-frames:v", str(frames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
], stdout=subprocess.PIPE)
assert process.stdout is not None
for frame in range(frames):
    data = process.stdout.read(width * height * 3)
    if len(data) != width * height * 3:
        raise RuntimeError("Le MP4 fourni ne contient pas les 69 cadres attendus")
    picture = Image.frombytes("RGB", (width, height), data)
    if any(min(picture.getpixel(point)) < 245 for point in
           [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]):
        raise RuntimeError("Le cadrage coupe l'illustration fournie")
    atlas.paste(picture, ((frame % columns) * width, (frame // columns) * height))
assert process.wait() == 0
stars = sum(135 <= r <= 245 and 85 <= g <= 210 and b <= 130 and r - g > 10
            for r, g, b in picture.crop((0, 0, width, height // 5)).getdata())
if stars < 100:
    raise RuntimeError("Les étoiles de la pose finale sont hors du cadrage")
atlas.save(target / "window-opening.atlas.png", optimize=True)
metadata = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "frames": frames, "fps": 60, "columns": columns, "rows": 7,
            "frameWidth": width, "frameHeight": height, "pixelRatio": 1.75,
            "crop": {"x": 240, "y": 578, "width": 600, "height": 960},
            "poseDurationMs": 1140, "exitDurationMs": 260}
(target / "window-opening.atlas.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(f"Atlas V2 : {frames} cadres, {atlas.width} × {atlas.height} px.")
