export interface MaskLayer {
  id: string
  label: string
  /** RGBA image. The red channel is coverage. */
  image: ImageData
}

export interface MaskValidationIssue {
  level: 'problem' | 'review'
  message: string
}

export interface MaskLayerReport {
  id: string
  label: string
  coveredPixels: number
  outsideSilhouette: number
  components: number
  smallComponents: number
  smallComponentPixels: number
}

export interface MaskValidationReport {
  width: number
  height: number
  aligned: boolean
  ornamentPixels: number
  coveredOrnamentPixels: number
  overlapPixels: number
  layers: MaskLayerReport[]
  issues: MaskValidationIssue[]
}

const COVERAGE = 16
const SMALL_REGION = 80

/**
 * Checks alignment, silhouette leaks, overlap, and tiny regions.
 * Unmasked highlights and cracks are not treated as failures.
 */
export function validateMasks(base: ImageData, layers: MaskLayer[]): MaskValidationReport {
  const width = base.width
  const height = base.height
  const issues: MaskValidationIssue[] = []
  const aligned = layers.every((layer) => layer.image.width === width && layer.image.height === height)
  if (!aligned) {
    issues.push({
      level: 'problem',
      message: 'A mask does not match the base image size, so the layers are not aligned.',
    })
  }

  const ornament = base.data
  let ornamentPixels = 0
  for (let index = 3; index < ornament.length; index += 4) {
    if (ornament[index] > 0) ornamentPixels += 1
  }

  const reports: MaskLayerReport[] = []
  const covered = new Uint8Array(width * height)
  let overlapPixels = 0

  for (const layer of layers) {
    if (layer.image.width !== width || layer.image.height !== height) {
      reports.push({
        id: layer.id,
        label: layer.label,
        coveredPixels: 0,
        outsideSilhouette: 0,
        components: 0,
        smallComponents: 0,
        smallComponentPixels: 0,
      })
      continue
    }
    const data = layer.image.data
    let coveredPixels = 0
    let outsideSilhouette = 0
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const coverage = data[pixel * 4]
      if (coverage <= COVERAGE) continue
      coveredPixels += 1
      if (ornament[pixel * 4 + 3] === 0) outsideSilhouette += 1
      if (covered[pixel] === 0) covered[pixel] = 1
      else if (covered[pixel] === 1) {
        covered[pixel] = 2
        overlapPixels += 1
      }
    }
    const areas = componentAreas(data, width, height)
    const small = areas.filter((area) => area < SMALL_REGION)
    reports.push({
      id: layer.id,
      label: layer.label,
      coveredPixels,
      outsideSilhouette,
      components: areas.length,
      smallComponents: small.length,
      smallComponentPixels: small.reduce((sum, area) => sum + area, 0),
    })
    if (outsideSilhouette > 0) {
      issues.push({
        level: 'problem',
        message: `${layer.label} has ${outsideSilhouette.toLocaleString()} pixels outside the ornament silhouette.`,
      })
    }
    if (small.length > 0) {
      issues.push({
        level: 'review',
        message: `${layer.label} has ${small.length} region${small.length === 1 ? '' : 's'} under ${SMALL_REGION} pixels (${small.reduce((sum, area) => sum + area, 0).toLocaleString()} px). They may be noise or small glaze details.`,
      })
    }
  }

  if (overlapPixels > 0) {
    issues.push({
      level: 'problem',
      message: `${overlapPixels.toLocaleString()} pixels belong to more than one mask.`,
    })
  }

  let coveredOrnamentPixels = 0
  for (let pixel = 0; pixel < covered.length; pixel += 1) {
    if (covered[pixel] > 0 && ornament[pixel * 4 + 3] > 0) coveredOrnamentPixels += 1
  }

  return {
    width,
    height,
    aligned,
    ornamentPixels,
    coveredOrnamentPixels,
    overlapPixels,
    layers: reports,
    issues,
  }
}

function componentAreas(data: Uint8ClampedArray, width: number, height: number): number[] {
  const seen = new Uint8Array(width * height)
  const areas: number[] = []
  const stack: number[] = []
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] || data[start * 4] <= COVERAGE) continue
    let area = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const pixel = stack.pop() as number
      area += 1
      const x = pixel % width
      const y = (pixel - x) / width
      if (x > 0) push(pixel - 1)
      if (x + 1 < width) push(pixel + 1)
      if (y > 0) push(pixel - width)
      if (y + 1 < height) push(pixel + width)
    }
    areas.push(area)
  }
  return areas

  function push(pixel: number) {
    if (seen[pixel] || data[pixel * 4] <= COVERAGE) return
    seen[pixel] = 1
    stack.push(pixel)
  }
}
