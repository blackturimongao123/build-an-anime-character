"""One-off helper: white chroma key + fit to roster portrait size (230x345)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

TARGET_W, TARGET_H = 230, 345
WHITE = 248
BLACK = 28
PAD = 0.06


def process(src: Path, dest: Path, key: str = "white") -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            if key == "black":
                if r <= BLACK and g <= BLACK and b <= BLACK:
                    px[x, y] = (r, g, b, 0)
            else:
                if r >= WHITE and g >= WHITE and b >= WHITE:
                    px[x, y] = (r, g, b, 0)

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    max_w = int(TARGET_W * (1 - PAD * 2))
    max_h = int(TARGET_H * (1 - PAD * 2))
    scale = min(max_w / im.width, max_h / im.height, 1.0)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    canvas.paste(im, ((TARGET_W - nw) // 2, (TARGET_H - nh) // 2), im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, optimize=True)
    print(f"Wrote {dest} ({TARGET_W}x{TARGET_H})")


def fit_cover(src: Path, dest: Path, bias_y: float = 0.5) -> None:
    """Center-cover crop to roster size (keeps full artwork backgrounds)."""
    im = Image.open(src).convert("RGB")
    scale = max(TARGET_W / im.width, TARGET_H / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - TARGET_W) // 2
    top = int((nh - TARGET_H) * bias_y)
    top = max(0, min(top, nh - TARGET_H))
    im = im.crop((left, top, left + TARGET_W, top + TARGET_H))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, optimize=True)
    print(f"Wrote {dest} ({TARGET_W}x{TARGET_H}, cover)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            "Usage: process-portrait-chromakey.py <src> <dest> "
            "[--cover] [--bias-y=0.5] [--key=white|black]"
        )
        sys.exit(1)
    src, dest = Path(sys.argv[1]), Path(sys.argv[2])
    key = "white"
    for arg in sys.argv:
        if arg.startswith("--key="):
            key = arg.split("=", 1)[1]
    if "--cover" in sys.argv:
        bias = 0.5
        for arg in sys.argv:
            if arg.startswith("--bias-y="):
                bias = float(arg.split("=", 1)[1])
        fit_cover(src, dest, bias_y=bias)
    else:
        process(src, dest, key=key)
