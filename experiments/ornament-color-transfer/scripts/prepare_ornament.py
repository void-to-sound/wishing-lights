"""Turn the generated green-screen ornament into a transparent PNG and a mask.

The mask is grayscale. White means the glass may take color. Black means
keep the pixel: metal cap, specular highlights, dark shadows, and empty space.
Gray is a soft edge. Run with the Pillow and numpy virtualenv:

  /tmp/dogkey/bin/python scripts/prepare_ornament.py SOURCE --out assets/vN
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def smoothstep(value: np.ndarray, edge0: float, edge1: float) -> np.ndarray:
    span = max(edge1 - edge0, 1e-4)
    t = np.clip((value - edge0) / span, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def prepare(source: Path) -> tuple[Image.Image, Image.Image]:
    image = Image.open(source).convert("RGB")
    pixels = np.asarray(image).astype(np.float32)
    height, width = pixels.shape[:2]
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]

    corners = np.concatenate(
        [
            pixels[:32, :32].reshape(-1, 3),
            pixels[:32, -32:].reshape(-1, 3),
            pixels[-32:, :32].reshape(-1, 3),
            pixels[-32:, -32:].reshape(-1, 3),
        ]
    )
    background_green = float(corners[:, 1].mean())
    dominance = green - np.maximum(red, blue)

    alpha = (1.0 - smoothstep(dominance, 16.0, 62.0)) * 255.0
    # A hard cut removes the flat screen that survives inside the hanging ring.
    alpha = np.where(dominance > 78.0, 0.0, alpha)

    subject = alpha > 24.0
    ys, xs = np.where(subject)
    if len(ys) == 0:
        raise SystemExit(f"no ornament found in {source}")
    top, bottom = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())
    center_x = (left + right) / 2.0
    subject_height = max(bottom - top, 1)
    subject_width = max(right - left, 1)

    darker = (green < background_green - 28.0) & (dominance > 40.0)
    shadow = darker & (np.arange(height)[:, None] > bottom - subject_height * 0.08)
    shadow_alpha = np.clip((background_green - green) / 120.0, 0.0, 0.42) * 255.0
    alpha = np.where(shadow, np.maximum(alpha, shadow_alpha), alpha)
    red = np.where(shadow, red * 0.15, red)
    green = np.where(shadow, green * 0.15, green)
    blue = np.where(shadow, blue * 0.15, blue)

    spill = dominance > 0.0
    green = np.where(spill, np.minimum(green, np.maximum(red, blue)), green)

    color = np.dstack([red, green, blue, alpha]).clip(0, 255).astype(np.uint8)
    cut = Image.fromarray(color, "RGBA")
    cut = cut.filter(ImageFilter.GaussianBlur(radius=0.4))

    blurred = np.asarray(cut).astype(np.float32)
    red, green, blue, alpha = (
        blurred[:, :, 0],
        blurred[:, :, 1],
        blurred[:, :, 2],
        blurred[:, :, 3],
    )
    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    max_channel = np.maximum(np.maximum(red, green), blue)
    min_channel = np.minimum(np.minimum(red, green), blue)
    saturation = np.divide(
        max_channel - min_channel,
        np.maximum(max_channel, 1.0),
    )

    cap_band = np.arange(height)[:, None] < top + subject_height * 0.2
    near_center = np.abs(np.arange(width)[None, :] - center_x) < subject_width * 0.16
    cap = cap_band & near_center & (saturation < 0.22) & (alpha > 90.0) & ~shadow

    # Only the hottest specular cores are locked. The pale glass body stays recolorable.
    highlight = smoothstep(luma, 232.0, 252.0)
    shade = 1.0 - smoothstep(luma, 8.0, 36.0)
    presence = np.clip(alpha / 255.0, 0.0, 1.0)
    glass = presence * (1.0 - highlight) * (1.0 - shade)
    glass = np.where(cap | shadow, 0.0, glass)

    mask = Image.fromarray(np.clip(glass * 255.0, 0, 255).astype(np.uint8), "L")
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.1))

    pad = 24
    box = (
        max(0, left - pad),
        max(0, top - pad),
        min(width, right + pad),
        min(height, bottom + pad),
    )
    return cut.crop(box), mask.crop(box)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    ornament, mask = prepare(args.source)
    ornament_path = args.out / "ornament.png"
    mask_path = args.out / "recolor-mask.png"
    ornament.save(ornament_path, "PNG", optimize=True)
    mask.save(mask_path, "PNG", optimize=True)
    print(ornament_path, ornament.size)
    print(mask_path, mask.size)


if __name__ == "__main__":
    main()
