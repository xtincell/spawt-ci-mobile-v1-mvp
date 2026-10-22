#!/usr/bin/env python3
"""Images V2 sur deux textures sous 2048 px ; aucun décodage vidéo au lancement."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from PIL import Image

root = Path(__file__).resolve().parent.parent
target = root / "app/assets/brand"
source = target / "window-opening.source.mp4"
expected = "ae4bc3d7a519e94438816b72c70da070ac75711501fb45a2eb80a5a07383b45f"
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
width, height, frames, columns, rows = 250, 400, 69, 7, 5
capacity = columns * rows
sheets = [Image.new("RGB", (width * columns, height * rows), "white") for _ in range(2)]
process = subprocess.Popen([
    ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(source),
    "-vf", f"fps=60,crop=600:960:240:578,scale={width}:{height}:flags=lanczos",
    "-frames:v", str(frames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
], stdout=subprocess.PIPE)
assert process.stdout is not None
for frame in range(frames):
    data = process.stdout.read(width * height * 3)
    if len(data) != width * height * 3:
        raise RuntimeError("Une image V2 manque")
    picture = Image.frombytes("RGB", (width, height), data)
    if any(min(picture.getpixel(p)) < 245 for p in [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]):
        raise RuntimeError("Le cadrage coupe le dessin")
    local = frame % capacity
    sheets[frame // capacity].paste(picture, ((local % columns) * width, (local // columns) * height))
assert process.wait() == 0
hashes = []
for index, sheet in enumerate(sheets):
    assert max(sheet.size) <= 2048
    path = target / f"window-opening.sheet-{index}.png"
    sheet.save(path, optimize=True)
    hashes.append(hashlib.sha256(path.read_bytes()).hexdigest())
metadata = {"sourceSha256": expected, "sheetSha256": hashes, "frames": frames, "fps": 60,
            "columns": columns, "rows": rows, "framesPerSheet": capacity,
            "frameWidth": width, "frameHeight": height, "pixelRatio": 1.25,
            "poseDurationMs": frames * 1000 // 60, "exitDurationMs": 260,
            "crop": {"x": 240, "y": 578, "width": 600, "height": 960}}
(target / "window-opening.sprites.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(f"V2 : {frames} images originales, deux textures {width*columns} × {height*rows} px.")
