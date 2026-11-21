"""Cut a flat green screen out of a generated dog pose.

The frames in ../assets/poses were made with this. It is a one-off: install
Pillow and numpy in a virtualenv, then point it at the green-screen JPEGs.

White fur stays because the matte only removes pixels whose green channel
leads red and blue. A dark green shadow is dropped. Remaining fringe is
despilled by pulling green down to the stronger of red or blue.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def erode(alpha: np.ndarray, radius: int) -> np.ndarray:
    tightened = alpha
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx == 0 and dy == 0:
                continue
            tightened = np.minimum(tightened, np.roll(np.roll(alpha, dy, axis=0), dx, axis=1))
    return tightened


def key_frame(path: Path, max_edge: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    pixels = np.asarray(image).astype(np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    dominance = green - np.maximum(red, blue)

    mix = np.clip((dominance - 6.0) / (36.0 - 6.0), 0.0, 1.0)
    mix = mix * mix * (3.0 - 2.0 * mix)
    alpha = (1.0 - mix) * 255.0
    alpha = np.where(dominance > 28.0, 0.0, alpha)

    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    alpha = np.where((dominance > 10.0) & (luma < 110.0), 0.0, alpha)
    alpha = erode(alpha, 2)
    alpha_image = Image.fromarray(alpha.clip(0, 255).astype(np.uint8), "L")
    alpha = np.asarray(alpha_image.filter(ImageFilter.GaussianBlur(radius=0.7))).astype(np.float32)

    stronger = np.maximum(red, blue)
    green = np.minimum(green, stronger)
    green = np.where(dominance > 2.0, np.minimum(green, stronger * 0.96), green)

    composited = np.dstack([red, green, blue, alpha]).clip(0, 255).astype(np.uint8)
    cut = Image.fromarray(composited, "RGBA")
    mask = cut.getchannel("A").point(lambda value: 255 if value > 18 else 0)
    box = mask.getbbox()
    if box is None:
        raise SystemExit(f"no subject in {path}")
    pad = 6
    cut = cut.crop(
        (
            max(0, box[0] - pad),
            max(0, box[1] - pad),
            min(cut.width, box[2] + pad),
            min(cut.height, box[3] + pad),
        )
    )
    if max(cut.size) > max_edge:
        cut.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return cut


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--max-edge", type=int, default=1100)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for source in args.sources:
        frame = key_frame(source, args.max_edge)
        destination = args.out / f"{source.stem}.png"
        frame.save(destination, "PNG", optimize=True)
        print(destination)


if __name__ == "__main__":
    main()
