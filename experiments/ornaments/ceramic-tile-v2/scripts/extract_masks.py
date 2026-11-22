"""Build three glaze masks from the exact pixels of ceramic-base.png.

White means the glaze may take color. Cream, the gold loop, and empty space stay black.
Masks do not overlap. Edges are soft only where the glaze meets cream or the silhouette.

  /tmp/dogkey/bin/python scripts/extract_masks.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


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
    return (hue * 60.0) % 360.0, span / np.maximum(peak, 1.0), peak


def shift(mask: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(mask)
    y_dst = slice(max(dy, 0), mask.shape[0] + min(dy, 0))
    x_dst = slice(max(dx, 0), mask.shape[1] + min(dx, 0))
    out[y_dst, x_dst] = mask[y_dst.start - dy : y_dst.stop - dy, x_dst.start - dx : x_dst.stop - dx]
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


def tile_span(alpha: np.ndarray) -> tuple[int, int]:
    widths = (alpha > 128).sum(axis=1)
    rows = np.where(widths > widths.max() * 0.55)[0]
    if len(rows) == 0:
        raise SystemExit("could not find the ceramic tile")
    return int(rows.min()), int(rows.max())


def keep_components(mask: np.ndarray, predicate) -> np.ndarray:
    height, width = mask.shape
    seen = np.zeros((height, width), dtype=bool)
    kept = np.zeros((height, width), dtype=bool)
    ys, xs = np.where(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist(), strict=True):
        if seen[y0, x0]:
            continue
        queue = [(y0, x0)]
        seen[y0, x0] = True
        pixels: list[tuple[int, int]] = []
        minx = maxx = x0
        miny = maxy = y0
        head = 0
        while head < len(queue):
            y, x = queue[head]
            head += 1
            pixels.append((y, x))
            minx = min(minx, x)
            maxx = max(maxx, x)
            miny = min(miny, y)
            maxy = max(maxy, y)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if ny < 0 or nx < 0 or ny >= height or nx >= width:
                    continue
                if seen[ny, nx] or not mask[ny, nx]:
                    continue
                seen[ny, nx] = True
                queue.append((ny, nx))
        if predicate(len(pixels), minx, miny, maxx, maxy):
            for y, x in pixels:
                kept[y, x] = True
    return kept


def cores(rgb: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    hue, saturation, _peak = hsv(rgb)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    top, _bottom = tile_span(alpha)
    # The gold loop sits above the tile. The bail overlaps the top edge by a few pixels.
    on_tile = (alpha > 32) & (np.arange(rgb.shape[0])[:, None] >= top - 2)

    blue = on_tile & (hue >= 188) & (hue <= 255) & (saturation >= 0.16) & (blue > red + 1) & (luma > 12)
    burgundy = (
        on_tile
        & ((hue >= 328) | (hue <= 14))
        & (saturation >= 0.24)
        & (luma < 168)
        & (red > green + 8)
        & (red > blue)
    )
    ratio = green / np.maximum(red, 1.0)
    orange = (
        on_tile
        & (hue >= 12)
        & (hue <= 36)
        & (saturation >= 0.62)
        & ((red - blue) > 115)
        & (ratio < 0.66)
        & (luma > 55)
        & (luma < 200)
        & (blue < 100)
    )

    # Cracks and thin specular lines sit inside a motif. Closing fills them.
    # The wider cream gaps between motifs stay open.
    cream = (saturation < 0.30) & (luma > 165) & (hue > 16) & (hue < 52)
    blue = (erode(dilate(blue, 1), 1) | blue) & on_tile & ~cream
    burgundy = (erode(dilate(burgundy, 1), 1) | burgundy) & on_tile & ~cream
    orange = (erode(dilate(orange, 1), 1) | orange) & on_tile & ~cream

    overlap = (blue & burgundy) | (blue & orange) | (burgundy & orange)
    if overlap.any():
        scores = np.stack(
            [
                np.where(blue, saturation, 0),
                np.where(burgundy, saturation + 0.01, 0),
                np.where(orange, saturation + 0.02, 0),
            ]
        )
        winner = scores.argmax(axis=0)
        blue &= ~overlap | (winner == 0)
        burgundy &= ~overlap | (winner == 1)
        orange &= ~overlap | (winner == 2)

    # The warm ceramic rim and crackle shadows share a hue with the orange stars.
    # The stars are the only large orange shapes. The bottom rim is wide and short.
    orange = keep_components(
        orange,
        lambda area, x0, y0, x1, y1: area >= 2000 and not (x1 - x0 > 400 and y1 - y0 < 55),
    )
    # The dark center of each star is a hole. Closing fills it without crossing the cream.
    orange = erode(dilate(orange, 5), 5) & on_tile & ~cream
    # A thin crack keeps that center connected to the cream, so closing alone misses it.
    # Pixels this dark, this deep inside an orange shape, are the star's own center.
    for blur, limit, minimum in ((8, 80, 0.55), (6, 45, 0.40)):
        density = np.asarray(
            Image.fromarray(orange.astype(np.uint8) * 255).filter(ImageFilter.BoxBlur(blur))
        ).astype(np.float32) / 255.0
        orange |= on_tile & (luma < limit) & (density > minimum)

    # Specks on the gold bail, and the star centers that read as burgundy.
    burgundy = keep_components(burgundy, lambda area, _x0, _y0, _x1, _y1: area >= 200)
    blue = keep_components(blue, lambda area, _x0, _y0, _x1, _y1: area >= 100)
    burgundy &= ~orange
    return blue, burgundy, orange


def soften(mask: np.ndarray, blocked: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    image = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L")
    blurred = np.asarray(image.filter(ImageFilter.GaussianBlur(radius=0.8))).astype(np.float32)
    blurred[mask] = np.maximum(blurred[mask], 242)
    blurred[blocked] = 0
    blurred[alpha == 0] = 0
    blurred *= np.clip(alpha.astype(np.float32) / 255.0, 0, 1)
    return np.clip(blurred, 0, 255).astype(np.uint8)


def exclusive(masks: list[np.ndarray]) -> list[np.ndarray]:
    stack = np.stack([mask.astype(np.int16) for mask in masks])
    order = stack.argmax(axis=0)
    peak = stack.max(axis=0)
    out = []
    for index, mask in enumerate(masks):
        kept = np.where((order == index) & (peak > 0), peak, 0)
        out.append(kept.astype(np.uint8))
    return out


def main() -> None:
    base = np.asarray(Image.open(ASSETS / "ceramic-base.png").convert("RGBA"))
    rgb = base[:, :, :3].astype(np.float32)
    alpha = base[:, :, 3]
    blue, burgundy, orange = cores(rgb, alpha)
    soft = [
        soften(blue, burgundy | orange, alpha),
        soften(burgundy, blue | orange, alpha),
        soften(orange, blue | burgundy, alpha),
    ]
    blue_m, burgundy_m, orange_m = exclusive(soft)
    Image.fromarray(blue_m, "L").save(ASSETS / "mask-blue.png", "PNG")
    Image.fromarray(burgundy_m, "L").save(ASSETS / "mask-burgundy.png", "PNG")
    Image.fromarray(orange_m, "L").save(ASSETS / "mask-orange.png", "PNG")

    overlap = ((blue_m > 0) & (burgundy_m > 0)).sum()
    overlap += ((blue_m > 0) & (orange_m > 0)).sum()
    overlap += ((burgundy_m > 0) & (orange_m > 0)).sum()
    outside = ((blue_m > 0) | (burgundy_m > 0) | (orange_m > 0)) & (alpha == 0)
    print("blue", int((blue_m > 16).sum()), "burgundy", int((burgundy_m > 16).sum()), "orange", int((orange_m > 16).sum()))
    print("overlap", int(overlap), "outside silhouette", int(outside.sum()))


if __name__ == "__main__":
    main()
