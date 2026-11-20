/**
 * Turns a decoded photograph into a short list of representative colors.
 *
 * This is intentionally separate from the React components so a later color
 * harmony algorithm can replace `extractColors` without touching the UI.
 * Callers only depend on the returned #rrggbb strings.
 */

interface Rgb {
  r: number
  g: number
  b: number
}

const FALLBACK_COLORS = ['#7a1f33', '#d4a017', '#1f6a45', '#f4f0e6', '#243044']

export function extractColors(bitmap: ImageBitmap, count = 5): string[] {
  if (count <= 0) return []

  const pixels = samplePixels(bitmap)
  if (pixels.length === 0) return fallback(count)

  const ranked = rankBuckets(pixels)
  return selectDiverse(ranked, count).map(toHex)
}

function samplePixels(bitmap: ImageBitmap): Rgb[] {
  if (bitmap.width < 1 || bitmap.height < 1) return []

  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > 64 ? 64 / longest : 1
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []

  context.drawImage(bitmap, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  const pixels: Rgb[] = []

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 200) continue
    pixels.push({
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    })
  }

  return pixels
}

function rankBuckets(pixels: Rgb[]): Rgb[] {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()

  for (const pixel of pixels) {
    // Coarse 16-step channels group near-identical pixels together.
    const key = `${pixel.r >> 4},${pixel.g >> 4},${pixel.b >> 4}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += pixel.r
      bucket.g += pixel.g
      bucket.b += pixel.b
      bucket.n += 1
    } else {
      buckets.set(key, { r: pixel.r, g: pixel.g, b: pixel.b, n: 1 })
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((bucket) => ({
      r: bucket.r / bucket.n,
      g: bucket.g / bucket.n,
      b: bucket.b / bucket.n,
    }))
}

/**
 * Walks common colors first, keeping only those that are far enough apart,
 * then relaxes the distance until `count` colors are filled.
 */
function selectDiverse(ranked: Rgb[], count: number): Rgb[] {
  const chosen: Rgb[] = []
  const thresholds = [90 * 90, 50 * 50, 25 * 25, 0]

  for (const threshold of thresholds) {
    for (const color of ranked) {
      if (chosen.length >= count) return chosen
      const distinct = chosen.every(
        (existing) => colorDistance(existing, color) > threshold,
      )
      if (distinct) chosen.push(color)
    }
  }

  while (chosen.length < count) {
    chosen.push(chosen[chosen.length - 1] ?? { r: 136, g: 136, b: 136 })
  }

  return chosen
}

function colorDistance(a: Rgb, b: Rgb): number {
  const red = a.r - b.r
  const green = a.g - b.g
  const blue = a.b - b.b
  return red * red + green * green + blue * blue
}

function toHex(color: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')

  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`
}

function fallback(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  )
}
