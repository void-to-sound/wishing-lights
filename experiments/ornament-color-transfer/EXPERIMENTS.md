# Ornament color transfer

One page, shared recoloring code, and a folder of frozen assets per version. Opening the page shows V1. The ornament menu can show V2 alone or both together.

```text
experiments/ornament-color-transfer/
  EXPERIMENTS.md
  index.html
  src/main.ts                 shared page
  src/recolor.ts              shared HSL and luminance algorithms
  src/versions.ts             which assets each version uses
  src/styles.css
  assets/v1/                  frozen: ornament.png, recolor-mask.png, source.jpg
  assets/v2/
  scripts/prepare_ornament.py
```

To add a version, generate one green-screen ornament, then key it into a new folder. Do not write into an existing version folder.

```text
/tmp/dogkey/bin/python scripts/prepare_ornament.py SOURCE --out assets/vN
```

Add an entry to `src/versions.ts` and append a log entry below. Fill observations only after looking at the page. Leave `recolor.ts` and earlier asset files as they are.

## V1 — 2026-11-20

### Hypothesis

A nearly colorless photorealistic glass ornament can take five colors from a photograph and still look like glass.

### What changed

First version. An AI-generated soft glass ball, keyed to a transparent PNG, with a soft mask. The page extracts five colors from each of three local photos and paints them across the ball with either HSL transfer or luminance compositing.

### What stayed constant

Color extraction is the app's existing `extractColors`. The app itself was not changed.

### Observations

HSL transfer looked more like glass. It keeps each pixel's lightness, so the reflections stay nearer to white (highlight channel spread about 0.9 at full strength) while the body takes a pastel hue (chroma about 0.20, lightness about 205). On the same three palettes the ball read as peach, mint, and a teal-to-pink gradient. The silver cap, clear edges, and facet shading stayed.

### Limitations

The glass is so bright that even a strong palette only stains it. It is not deeply colored enough for the tree.

### Next question

Would a clearer, higher-contrast faceted crystal take the same palettes more visibly without losing the glass?

## V2 — 2026-11-20

### Hypothesis

A clear, high-contrast faceted crystal, with darker facet shadows and sharper speculars, will accept the same HSL transfer more visibly, while the cap and reflections stay intact.

### What changed

A new base image and mask only: `assets/v2/ornament.png`, `recolor-mask.png`, and the green-screen `source.jpg`. The page can show V1, V2, or both.

### What stayed constant

The HSL and luminance algorithms, the five-color placement, the strength slider, photo extraction, and the mask rules in `prepare_ornament.py`. The V1 image and mask were not regenerated.

### Observations

Tested with the same three palettes at full HSL strength, side by side with V1. V2 body chroma was about 0.38, against 0.20 on V1, and body lightness was about 163, against 205. The warm photo reads peach, the cool photo green, and the third a teal, gold, and pink gradient across the facets. The silver cap stays silver, and the brightest facet cores stay nearly white. A few highlights pick up more tint than on V1 (highlight spread about 1.5, against 0.9). The result still reads as cut crystal.

### Limitations

The mask locks the darkest and brightest facets, so color sits in the mid facets instead of filling the ball. V2 is more convincing than V1, and still lighter than a solid colored ornament.

### Next question

Can the mask let mid-bright facets take more color without tinting the true specular cores?
