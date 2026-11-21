export type Technique = 'hsl' | 'luma'

type Rgb = [number, number, number]

interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

/** Tints glass pixels from a palette. The mask's brightness is how much color may land. */
export function recolor(
  source: ImageData,
  mask: Uint8ClampedArray,
  colors: string[],
  technique: Technique,
  strength: number,
): ImageData {
  const palette = (colors.length > 0 ? colors : ['#d7d7d7']).map(parseHex)
  const bounds = maskBounds(mask, source.width, source.height)
  const output = new ImageData(source.width, source.height)
  const src = source.data
  const dst = output.data

  for (let index = 0; index < src.length; index += 4) {
    const pixel = index / 4
    const x = pixel % source.width
    const y = (pixel - x) / source.width
    const weight = (mask[index] / 255) * strength
    dst[index + 3] = src[index + 3]

    if (weight <= 0.001 || src[index + 3] === 0) {
      dst[index] = src[index]
      dst[index + 1] = src[index + 1]
      dst[index + 2] = src[index + 2]
      continue
    }

    const base: Rgb = [src[index], src[index + 1], src[index + 2]]
    const ink = colorAt(x, y, bounds, palette)
    const tinted = technique === 'hsl' ? hslTransfer(base, ink) : lumaTransfer(base, ink)
    dst[index] = mix(base[0], tinted[0], weight)
    dst[index + 1] = mix(base[1], tinted[1], weight)
    dst[index + 2] = mix(base[2], tinted[2], weight)
  }

  return output
}

function colorAt(x: number, y: number, bounds: Bounds, palette: Rgb[]): Rgb {
  if (palette.length === 1) return palette[0]
  const vertical = clamp01((y - bounds.top) / bounds.height)
  const horizontal = clamp01((x - bounds.left) / bounds.width)
  const place = clamp01(vertical * 0.72 + horizontal * 0.28)
  const scaled = place * (palette.length - 1)
  const index = Math.min(palette.length - 2, Math.floor(scaled))
  return lerpRgb(palette[index], palette[index + 1], scaled - index)
}

function hslTransfer(base: Rgb, ink: Rgb): Rgb {
  const source = rgbToHsl(base)
  const target = rgbToHsl(ink)
  return hslToRgb(target.h, Math.max(source.s, target.s * 0.9), source.l)
}

function lumaTransfer(base: Rgb, ink: Rgb): Rgb {
  const baseLuma = luminance(base) * 255
  const inkLuma = luminance(ink) * 255
  // Move hue onto the glass without repainting its highlights and shadows.
  const gain = 0.72
  return [
    clampChannel(baseLuma + (ink[0] - inkLuma) * gain),
    clampChannel(baseLuma + (ink[1] - inkLuma) * gain),
    clampChannel(baseLuma + (ink[2] - inkLuma) * gain),
  ]
}

function maskBounds(mask: Uint8ClampedArray, width: number, height: number): Bounds {
  let left = width
  let top = height
  let right = 0
  let bottom = 0
  for (let index = 0; index < mask.length; index += 4) {
    if (mask[index] < 12) continue
    const pixel = index / 4
    const x = pixel % width
    const y = (pixel - x) / width
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  if (right <= left || bottom <= top) return { left: 0, top: 0, width, height }
  return { left, top, width: right - left, height: bottom - top }
}

function rgbToHsl(rgb: Rgb): { h: number; s: number; l: number } {
  const red = rgb[0] / 255
  const green = rgb[1] / 255
  const blue = rgb[2] / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l: lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return { h: (hue * 60 + 360) % 360, s: saturation, l: lightness }
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  const match = lightness - chroma / 2
  const channels =
    section < 1
      ? [chroma, x, 0]
      : section < 2
        ? [x, chroma, 0]
        : section < 3
          ? [0, chroma, x]
          : section < 4
            ? [0, x, chroma]
            : section < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]
  return [
    clampChannel((channels[0] + match) * 255),
    clampChannel((channels[1] + match) * 255),
    clampChannel((channels[2] + match) * 255),
  ]
}

function luminance(rgb: Rgb): number {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

function parseHex(color: string): Rgb {
  const value = color.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function lerpRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  return [mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount)]
}

function mix(from: number, to: number, amount: number): number {
  return clampChannel(from + (to - from) * amount)
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
