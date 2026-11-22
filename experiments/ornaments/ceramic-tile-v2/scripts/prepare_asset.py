"""Cut the baked-in checkerboard off the ceramic ornament.

The supplied file is a JPEG. It has no alpha channel. The light and white
squares are real RGB pixels, so the background has to be keyed. The ornament
drawing itself is not changed. Edge pixels that are a mix of ceramic and a
checker square get partial alpha and the checker color is pulled back out.

  /tmp/dogkey/bin/python scripts/prepare_asset.py
"""

from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_JPEG = Path(
    "/Users/jinsunwoo/.cursor/projects/Users-jinsunwoo-Documents-projects-wishing-lights"
    "/assets/Crackle-Glazed_Floral_Tile_Ornament-eaaac653-09c7-4267-bf64-55588050da2d.jpg"
)
ASSETS = ROOT / "assets"


def flood_border(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    seen = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if mask[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if mask[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if ny < 0 or nx < 0 or ny >= height or nx >= width:
                continue
            if seen[ny, nx] or not mask[ny, nx]:
                continue
            seen[ny, nx] = True
            queue.append((ny, nx))
    return seen


def ring_hole(rest: np.ndarray) -> np.ndarray:
    """The checkerboard inside the gold loop is enclosed, so the border flood misses it."""
    hole = np.zeros(rest.shape, dtype=bool)
    window = rest[50:130, 470:560]
    hits = np.argwhere(window)
    if len(hits) < 1000:
        raise SystemExit("could not find the checkerboard inside the gold loop")
    seed_y, seed_x = hits[len(hits) // 2]
    seed = (int(seed_y + 50), int(seed_x + 470))
    height, width = rest.shape
    queue: deque[tuple[int, int]] = deque([seed])
    hole[seed] = True
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if ny < 0 or nx < 0 or ny >= height or nx >= width:
                continue
            if hole[ny, nx] or not rest[ny, nx]:
                continue
            hole[ny, nx] = True
            queue.append((ny, nx))
    return hole


def neighbor_mean(
    color: np.ndarray, gate: np.ndarray, dy: int, dx: int
) -> tuple[np.ndarray, np.ndarray]:
    height, width = gate.shape
    shifted = np.zeros_like(color)
    present = np.zeros((height, width), dtype=bool)
    y_src = slice(max(dy, 0), height + min(dy, 0))
    x_src = slice(max(dx, 0), width + min(dx, 0))
    y_dst = slice(max(-dy, 0), height + min(-dy, 0))
    x_dst = slice(max(-dx, 0), width + min(-dx, 0))
    present[y_dst, x_dst] = gate[y_src, x_src]
    shifted[y_dst, x_dst] = color[y_src, x_src]
    return shifted, present


def cut_background(rgb: np.ndarray) -> np.ndarray:
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    peak = np.maximum(np.maximum(red, green), blue)
    floor = np.minimum(np.minimum(red, green), blue)
    chroma = peak - floor
    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    # Checker squares are bright and almost perfectly gray. Ceramic, glaze,
    # and gold are not.
    checker = (chroma <= 12) & (luma >= 208) & (np.abs(red - green) <= 10) & (np.abs(green - blue) <= 10)
    border = flood_border(checker)
    hole = ring_hole(checker & ~border)
    background = border | hole

    color = rgb.copy()
    alpha = np.where(background, 0.0, 255.0)

    # One-pixel fringe where the checkerboard bled into the silhouette.
    shifts = ((1, 0), (-1, 0), (0, 1), (0, -1))
    background_sum = np.zeros_like(rgb)
    background_count = np.zeros(rgb.shape[:2], dtype=np.float32)
    foreground_sum = np.zeros_like(rgb)
    foreground_count = np.zeros(rgb.shape[:2], dtype=np.float32)
    for dy, dx in shifts:
        shifted, present = neighbor_mean(rgb, background, dy, dx)
        background_sum += shifted
        background_count += present
        solid = (~background) & (chroma >= 48)
        shifted, present = neighbor_mean(rgb, solid, dy, dx)
        foreground_sum += shifted
        foreground_count += present

    fringe = (~background) & (background_count > 0) & (chroma < 48) & (foreground_count > 0)
    background_color = background_sum / np.maximum(background_count, 1)[:, :, None]
    foreground_color = foreground_sum / np.maximum(foreground_count, 1)[:, :, None]
    span = foreground_color - background_color
    usable = np.abs(span) > 18
    estimate = np.divide(
        rgb - background_color,
        span,
        out=np.ones_like(rgb),
        where=usable,
    )
    weight = usable.astype(np.float32)
    coverage = (estimate * weight).sum(axis=2) / np.maximum(weight.sum(axis=2), 1)
    coverage = np.clip(coverage, 0.2, 1.0)
    unmixed = (rgb - background_color * (1 - coverage[:, :, None])) / coverage[:, :, None]
    color[fringe] = np.clip(unmixed[fringe], 0, 255)
    alpha[fringe] = coverage[fringe] * 255
    # Checker pixels that missed the gray test sit just outside the loop and corners.
    drop_specks(alpha, minimum=40)
    color[alpha == 0] = rgb[alpha == 0]

    return np.dstack([color, alpha]).astype(np.uint8)


def drop_specks(alpha: np.ndarray, minimum: int) -> None:
    present = alpha > 20
    height, width = present.shape
    seen = np.zeros((height, width), dtype=bool)
    ys, xs = np.where(present)
    for y0, x0 in zip(ys.tolist(), xs.tolist(), strict=True):
        if seen[y0, x0]:
            continue
        queue: deque[tuple[int, int]] = deque([(y0, x0)])
        seen[y0, x0] = True
        pixels: list[tuple[int, int]] = []
        while queue:
            y, x = queue.popleft()
            pixels.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if ny < 0 or nx < 0 or ny >= height or nx >= width:
                    continue
                if seen[ny, nx] or not present[ny, nx]:
                    continue
                seen[ny, nx] = True
                queue.append((ny, nx))
        if len(pixels) < minimum:
            for y, x in pixels:
                alpha[y, x] = 0


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    original = Image.open(SOURCE_JPEG).convert("RGB")
    original.save(ASSETS / "ceramic-source.png", "PNG")
    shutil.copyfile(SOURCE_JPEG, ASSETS / "ceramic-source.jpg")
    rgb = np.asarray(original).astype(np.float32)
    cut = cut_background(rgb)
    Image.fromarray(cut, "RGBA").save(ASSETS / "ceramic-base.png", "PNG")
    alpha = cut[:, :, 3]
    print(f"source {original.size}")
    print(f"transparent {(alpha == 0).mean():.3f} opaque {(alpha == 255).mean():.3f} partial {((alpha > 0) & (alpha < 255)).mean():.4f}")


if __name__ == "__main__":
    main()
