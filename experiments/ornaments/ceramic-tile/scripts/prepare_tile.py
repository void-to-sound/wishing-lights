"""Cut the ceramic tile off the pine photo and mask each glaze.

Writes a transparent ornament plus three grayscale masks. White in a mask
means that glaze may take a new color. Cream crackle, the gold hanger, and
the empty background stay out of every mask.

Run with the Pillow and numpy virtualenv:

  /tmp/dogkey/bin/python scripts/prepare_tile.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source.png"


def hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    peak = np.maximum(np.maximum(red, green), blue)
    floor = np.minimum(np.minimum(red, green), blue)
    span = peak - floor
    hue = np.zeros_like(red)
    safe = np.maximum(span, 1e-6)
    hue = np.where((peak == red) & (span > 0), ((green - blue) / safe) % 6, hue)
    hue = np.where((peak == green) & (span > 0), ((blue - red) / safe) + 2, hue)
    hue = np.where((peak == blue) & (span > 0), ((red - green) / safe) + 4, hue)
    hue = (hue * 60.0) % 360.0
    saturation = np.divide(span, np.maximum(peak, 1.0))
    return hue, saturation, peak


def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]


def shift(mask: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(mask)
    y_dst = slice(max(dy, 0), mask.shape[0] + min(dy, 0))
    x_dst = slice(max(dx, 0), mask.shape[1] + min(dx, 0))
    y_src = slice(y_dst.start - dy, y_dst.stop - dy)
    x_src = slice(x_dst.start - dx, x_dst.stop - dx)
    out[y_dst, x_dst] = mask[y_src, x_src]
    return out


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            out |= shift(mask, dy, dx)
    return out


def erode(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            out &= shift(mask, dy, dx)
    return out


def close(mask: np.ndarray, radius: int) -> np.ndarray:
    return erode(dilate(mask, radius), radius)


def tile_box(luma: np.ndarray) -> tuple[int, int, int, int]:
    """Axis-aligned ceramic square, found from the bright glaze edge."""
    height, width = luma.shape
    lefts: list[int] = []
    rights: list[int] = []
    for y in range(180, 440):
        row = luma[y]
        left = None
        for x in range(90, 220):
            if row[x] - row[x - 3] > 45 and row[x] > 80:
                left = x
                break
        right = None
        for x in range(width - 40, 300, -1):
            if row[x - 3] - row[x] > 40 and row[x - 3] > 80:
                right = x
                break
        if left is not None and 120 <= left <= 150:
            lefts.append(left)
        if right is not None and 410 <= right <= 450:
            rights.append(right)

    tops: list[int] = []
    bottoms: list[int] = []
    for x in range(160, 400, 4):
        column = luma[:, x]
        top = None
        for y in range(140, 230):
            if column[y] - column[y - 3] > 40 and column[y] > 80:
                top = y
                break
        bottom = None
        for y in range(height - 40, 360, -1):
            if column[y - 3] - column[y] > 35 and column[y - 3] > 70:
                bottom = y
                break
        if top is not None and 160 <= top <= 190:
            tops.append(top)
        if bottom is not None and 440 <= bottom <= 470:
            bottoms.append(bottom)

    if not lefts or not rights or not tops or not bottoms:
        raise SystemExit("could not find the ceramic tile")
    # The measured edge is the first bright pixel. Step inside one pixel so
    # the pine fringe mixed into that edge does not stay in the cutout.
    left = int(np.median(lefts)) + 1
    right = int(np.median(rights)) - 1
    top = int(np.median(tops)) + 1
    bottom = int(np.median(bottoms)) - 1
    return left, top, right, bottom


def corner_fringe(
    rgb: np.ndarray, luma: np.ndarray, box: tuple[int, int, int, int]
) -> np.ndarray:
    """Pine caught where the square overlaps a rounded corner.

    Dark pixels there have a high saturation only because every channel is
    small. Real glaze in the corners is lighter and more chromatic.
    """
    left, top, right, bottom = box
    height, width = luma.shape
    rows, cols = np.mgrid[0:height, 0:width]
    from_left = cols - left
    from_right = right - 1 - cols
    from_top = rows - top
    from_bottom = bottom - 1 - rows
    inside = (from_left >= 0) & (from_right >= 0) & (from_top >= 0) & (from_bottom >= 0)
    corner = inside & ((from_left <= 16) | (from_right <= 16)) & (
        (from_top <= 16) | (from_bottom <= 16)
    )
    peak = np.maximum(np.maximum(rgb[:, :, 0], rgb[:, :, 1]), rgb[:, :, 2])
    floor = np.minimum(np.minimum(rgb[:, :, 0], rgb[:, :, 1]), rgb[:, :, 2])
    return corner & (luma < 95) & ((peak - floor) < 52)


def hanger_mask(rgb: np.ndarray, luma: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """Gold ring and cord above the tile. Flood fill so warm bokeh stays out."""
    left, top, right, _bottom = box
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    gold = (
        (red > 85)
        & (red > green + 18)
        & (green > blue + 8)
        & (red - blue > 50)
        & (luma > 50)
        & (luma < 230)
    )
    center = (left + right) // 2
    seed_band = gold[top - 24 : top + 2, center - 18 : center + 18]
    if not seed_band.any():
        return np.zeros(gold.shape, dtype=bool)

    height, width = gold.shape
    seen = np.zeros_like(gold)
    stack: list[tuple[int, int]] = []
    ys, xs = np.where(seed_band)
    for y, x in zip(ys, xs, strict=True):
        stack.append((int(y + top - 24), int(x + center - 18)))

    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= height or x >= width or seen[y, x] or not gold[y, x]:
            continue
        # Keep the flood on the cord. Cream on the tile is also warm.
        if y > top + 2 or x < center - 36 or x > center + 36:
            continue
        seen[y, x] = True
        stack.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))

    # A one-pixel halo keeps the cord's soft edge without pulling in needles.
    return dilate(seen, 1)


def glaze_masks(
    rgb: np.ndarray, tile: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    hue, saturation, _peak = hsv(rgb)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    luma = luminance(rgb)
    ratio = green / np.maximum(red, 1.0)

    blue = tile & (hue >= 190) & (hue <= 255) & (saturation >= 0.15) & (blue > red + 2)
    orange = (
        tile
        & (hue >= 10)
        & (hue <= 42)
        & (saturation >= 0.52)
        & (red > 125)
        & ((red - blue) > 105)
        & (ratio < 0.67)
        & (blue < 100)
    )
    purple = (
        tile
        & ((hue >= 330) | (hue <= 18))
        & (saturation >= 0.30)
        & (luma < 120)
        & (red > green + 12)
        & (red > blue + 6)
        & ~orange
    )

    # Cracks are dark lines inside a glaze. Closing fills those lines and
    # leaves the wider cream gaps between motifs alone.
    blue = close(blue, 1)
    orange = close(orange, 1)
    purple = close(purple, 1)
    blue &= tile
    orange &= tile
    purple &= tile

    # A pixel belongs to one glaze. Prefer the more chromatic claim.
    chroma = saturation
    overlap = (blue & orange) | (blue & purple) | (orange & purple)
    if overlap.any():
        scores = np.stack(
            [
                np.where(blue, chroma, 0),
                np.where(purple, chroma + 0.02, 0),
                np.where(orange, chroma + 0.04, 0),
            ]
        )
        winner = scores.argmax(axis=0)
        blue &= ~overlap | (winner == 0)
        purple &= ~overlap | (winner == 1)
        orange &= ~overlap | (winner == 2)

    return blue, purple, orange


def mask_image(mask: np.ndarray) -> Image.Image:
    blurred = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L")
    # Soften only the boundary. Cream a pixel away should stay untouched.
    blurred = blurred.filter(ImageFilter.GaussianBlur(radius=0.45))
    values = np.asarray(blurred).astype(np.float32)
    values = np.where(mask, np.maximum(values, 210), values)
    values = np.where(~mask & (values < 28), 0, values)
    return Image.fromarray(values.clip(0, 255).astype(np.uint8), "L")


def median_hex(rgb: np.ndarray, mask: np.ndarray) -> str:
    pixels = rgb[mask]
    if len(pixels) == 0:
        return "#888888"
    color = np.median(pixels, axis=0)
    return "#{:02x}{:02x}{:02x}".format(*np.round(color).astype(int))


def prepare(source: Path, out: Path) -> None:
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image).astype(np.float32)
    luma = luminance(rgb)
    left, top, right, bottom = tile_box(luma)
    height, width = luma.shape

    tile = np.zeros((height, width), dtype=bool)
    tile[top:bottom, left:right] = True
    tile &= ~corner_fringe(rgb, luma, (left, top, right, bottom))
    hanger = hanger_mask(rgb, luma, (left, top, right, bottom))
    # The ring overlaps the tile's top edge. That metal is not glaze.
    tile[hanger] = False

    blue, purple, orange = glaze_masks(rgb, tile)
    subject = tile | hanger

    alpha = np.zeros((height, width), dtype=np.float32)
    alpha[subject] = 255.0
    cut = Image.fromarray(
        np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8), "RGBA"
    )
    cut = cut.filter(ImageFilter.GaussianBlur(radius=0.35))
    cut_px = np.asarray(cut).astype(np.float32)
    # Blur must not revive pixels outside the ornament or tint the cut edge
    # with pine. Keep the original tile color and only soften alpha.
    color = rgb.copy()
    soft_alpha = cut_px[:, :, 3]
    soft_alpha = np.where(subject, np.maximum(soft_alpha, 230), soft_alpha)
    soft_alpha = np.where(~subject & (soft_alpha < 24), 0, soft_alpha)

    pad = 8
    ys, xs = np.where(soft_alpha > 8)
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(width, int(xs.max()) + pad + 1),
        min(height, int(ys.max()) + pad + 1),
    )
    ornament = Image.fromarray(
        np.dstack([color, soft_alpha]).clip(0, 255).astype(np.uint8), "RGBA"
    ).crop(box)

    out.mkdir(parents=True, exist_ok=True)
    ornament.save(out / "ornament.png", "PNG")
    mask_image(blue).crop(box).save(out / "mask-blue.png", "PNG")
    mask_image(purple).crop(box).save(out / "mask-purple.png", "PNG")
    mask_image(orange).crop(box).save(out / "mask-orange.png", "PNG")

    print(f"tile box left={left} top={top} right={right} bottom={bottom}")
    print(f"ornament {ornament.size}")
    print(f"blue {int(blue.sum())} {median_hex(rgb, blue)}")
    print(f"purple {int(purple.sum())} {median_hex(rgb, purple)}")
    print(f"orange {int(orange.sum())} {median_hex(rgb, orange)}")
    print(f"hanger {int(hanger.sum())}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--out", type=Path, default=ROOT / "assets")
    args = parser.parse_args()
    prepare(args.source, args.out)


if __name__ == "__main__":
    main()
