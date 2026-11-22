type Rgb = [number, number, number]

export interface GlazeRegion {
  mask: Uint8ClampedArray
  color: string
}

/**
 * Luminance-preserving recolor from experiments/ornament-color-transfer.
 * Each glaze pixel keeps its brightness and takes the chosen color's chroma.
 */
export function recolorRegions(
  source: ImageData,
  regions: GlazeRegion[],
  strength: number,
): ImageData {
  const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const src = source.data
  const destination = output.data
  const inks = regions.map((region) => {
    const ink = parseHex(region.color)
    return { ink, inkLuma: luminance(ink) * 255, mask: region.mask }
  })

  for (let index = 0; index < src.length; index += 4) {
    if (src[index + 3] === 0) continue
    let weight = 0
    let chosen = 0
    for (let region = 0; region < inks.length; region += 1) {
      const coverage = (inks[region].mask[index] / 255) * strength
      if (coverage > weight) {
        weight = coverage
        chosen = region
      }
    }
    if (weight <= 0.001) continue
    const base: Rgb = [src[index], src[index + 1], src[index + 2]]
    const tinted = lumaTransfer(base, inks[chosen].ink, inks[chosen].inkLuma)
    destination[index] = mix(base[0], tinted[0], weight)
    destination[index + 1] = mix(base[1], tinted[1], weight)
    destination[index + 2] = mix(base[2], tinted[2], weight)
  }

  return output
}

function lumaTransfer(base: Rgb, ink: Rgb, inkLuma: number): Rgb {
  const baseLuma = luminance(base) * 255
  const gain = 0.72
  return [
    clampChannel(baseLuma + (ink[0] - inkLuma) * gain),
    clampChannel(baseLuma + (ink[1] - inkLuma) * gain),
    clampChannel(baseLuma + (ink[2] - inkLuma) * gain),
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

function mix(from: number, to: number, amount: number): number {
  return clampChannel(from + (to - from) * amount)
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}
