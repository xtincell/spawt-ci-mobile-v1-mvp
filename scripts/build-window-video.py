#!/usr/bin/env python3
"""Recadrer le MP4 fourni pour le lecteur natif, sans refaire son animation."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image

root = Path(__file__).resolve().parent.parent
target = root / "app/assets/brand"
source = target / "window-opening.source.mp4"
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

subprocess.run([
    ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(source),
    "-vf", "fps=60,crop=600:960:240:578,scale=350:560:flags=lanczos",
    "-frames:v", "69", "-an", "-c:v", "libx264", "-crf", "12",
    "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    str(target / "window-opening.native.mp4"),
], check=True)

# Les poses correspondent aux mêmes images exactes du pack, déjà extraites.
atlas = Image.open(target / "window-opening.atlas.png").convert("RGB")
for index, name in [(0, "first"), (68, "final")]:
    x = index % 10 * 350
    y = index // 10 * 560
    atlas.crop((x, y, x + 350, y + 560)).save(target / f"window-opening.{name}.png", optimize=True)

metadata = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "nativeSha256": hashlib.sha256((target / "window-opening.native.mp4").read_bytes()).hexdigest(),
            "frames": 69, "fps": 60, "width": 350, "height": 560,
            "pixelRatio": 1.75, "poseDurationMs": 1150, "exitDurationMs": 260,
            "crop": {"x": 240, "y": 578, "width": 600, "height": 960}}
(target / "window-opening.media.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(f"MP4 natif V2 : {metadata['frames']} images, 350 × 560 px, {metadata['poseDurationMs']} ms.")
