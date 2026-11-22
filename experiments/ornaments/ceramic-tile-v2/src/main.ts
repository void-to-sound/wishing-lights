import { maskedRecolor } from '../../shared/maskedRecolor.ts'
import { validateMasks, type MaskValidationReport } from '../../shared/maskValidator.ts'

interface Layer {
  id: 'blue' | 'burgundy' | 'orange'
  label: string
  tint: [number, number, number]
  trial: string
  mask: ImageData
  original: string
}

interface View {
  scale: number
  focusX: number
  focusY: number
}

const TINTS = {
  blue: [52, 132, 255] as [number, number, number],
  burgundy: [214, 52, 140] as [number, number, number],
  orange: [255, 154, 36] as [number, number, number],
}

const baseUrl = new URL('../assets/ceramic-base.png', import.meta.url)
const maskUrls = {
  blue: new URL('../assets/mask-blue.png', import.meta.url),
  burgundy: new URL('../assets/mask-burgundy.png', import.meta.url),
  orange: new URL('../assets/mask-orange.png', import.meta.url),
}

const source = await loadImageData(baseUrl)
const layers: Layer[] = [
  {
    id: 'blue',
    label: 'Blue',
    tint: TINTS.blue,
    trial: '#1f8a56',
    mask: await loadImageData(maskUrls.blue),
    original: '#888888',
  },
  {
    id: 'burgundy',
    label: 'Burgundy',
    tint: TINTS.burgundy,
    trial: '#6a3dcc',
    mask: await loadImageData(maskUrls.burgundy),
    original: '#888888',
  },
  {
    id: 'orange',
    label: 'Orange',
    tint: TINTS.orange,
    trial: '#e23d5c',
    mask: await loadImageData(maskUrls.orange),
    original: '#888888',
  },
]

for (const layer of layers) layer.original = medianHex(source, layer.mask)

const report = validateMasks(
  source,
  layers.map((layer) => ({ id: layer.id, label: layer.label, image: layer.mask })),
)
renderReport(report)

const view: View = { scale: 1, focusX: source.width / 2, focusY: source.height / 2 }
let opacity = 0.7
let strength = 1
let mode = 'overlay'
let fitted = false

const baseSprite = spriteOf(source)
const maskSprites = new Map(layers.map((layer) => [layer.id, maskSprite(layer.mask)]))
let overlaySprite = colorSprite(source, layers, opacity)
let overlapSprite = overlapSpriteOf(source, layers, opacity)
const thumbSprites = new Map(layers.map((layer) => [layer.id, colorSprite(source, [layer], opacity)]))
let recolorSprite = spriteOf(recolored())

const originalCanvas = requiredCanvas('#original')
const recoloredCanvas = requiredCanvas('#recolored')
const inspectorCanvas = requiredCanvas('#inspector')
const thumbCanvases = {
  blue: requiredCanvas('#thumb-blue'),
  burgundy: requiredCanvas('#thumb-burgundy'),
  orange: requiredCanvas('#thumb-orange'),
}
const stages = document.querySelectorAll<HTMLElement>('.stage')
const zoomValue = document.querySelector<HTMLElement>('#zoom-value')

bindViewport(originalCanvas)
bindViewport(recoloredCanvas)
bindViewport(inspectorCanvas)

for (const layer of layers) {
  const input = requiredInput(`#color-${layer.id}`)
  const readout = document.querySelector<HTMLElement>(`#${layer.id}-value`)
  input.value = layer.trial
  if (readout) readout.textContent = layer.trial
  input.addEventListener('input', () => {
    if (readout) readout.textContent = input.value
    refreshRecolor()
  })
}

const strengthInput = requiredInput('#strength')
strengthInput.addEventListener('input', () => {
  strength = Number(strengthInput.value) / 100
  const readout = document.querySelector<HTMLElement>('#strength-value')
  if (readout) readout.textContent = `${strengthInput.value}%`
  refreshRecolor()
})

document.querySelector('#reset')?.addEventListener('click', () => {
  for (const layer of layers) {
    const input = requiredInput(`#color-${layer.id}`)
    const readout = document.querySelector<HTMLElement>(`#${layer.id}-value`)
    input.value = layer.original
    if (readout) readout.textContent = layer.original
  }
  strengthInput.value = '100'
  strength = 1
  const readout = document.querySelector<HTMLElement>('#strength-value')
  if (readout) readout.textContent = '100%'
  refreshRecolor()
})

requiredInput('#opacity').addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  opacity = Number(input.value) / 100
  const readout = document.querySelector<HTMLElement>('#opacity-value')
  if (readout) readout.textContent = `${input.value}%`
  overlaySprite = colorSprite(source, layers, opacity)
  overlapSprite = overlapSpriteOf(source, layers, opacity)
  for (const layer of layers) thumbSprites.set(layer.id, colorSprite(source, [layer], opacity))
  paintAll()
})

document.querySelectorAll<HTMLInputElement>('input[name="backdrop"]').forEach((input) => {
  input.addEventListener('change', () => {
    const dark = input.value === 'dark' && input.checked
    stages.forEach((stage) => stage.classList.toggle('is-dark', dark))
  })
})

document.querySelectorAll<HTMLInputElement>('input[name="inspect"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) return
    mode = input.value
    paintAll()
  })
})

document.querySelector('#zoom-in')?.addEventListener('click', () => setScale(view.scale * 1.25))
document.querySelector('#zoom-out')?.addEventListener('click', () => setScale(view.scale / 1.25))
document.querySelector('#zoom-fit')?.addEventListener('click', () => {
  fitted = false
  fit()
})

const observer = new ResizeObserver(() => {
  if (!fitted) fit()
  else paintAll()
})
observer.observe(originalCanvas)
requestAnimationFrame(() => fit())

function refreshRecolor() {
  recolorSprite = spriteOf(recolored())
  paintAll()
}

function recolored(): ImageData {
  return maskedRecolor(
    source,
    layers.map((layer) => ({
      mask: layer.mask.data,
      color: requiredInput(`#color-${layer.id}`).value,
    })),
    strength,
  )
}

function fit() {
  const width = originalCanvas.clientWidth
  const height = originalCanvas.clientHeight
  if (width < 20 || height < 20) return
  view.scale = Math.min((width - 12) / source.width, (height - 12) / source.height)
  view.focusX = source.width / 2
  view.focusY = source.height / 2
  fitted = true
  paintAll()
}

function setScale(next: number) {
  view.scale = clamp(next, 0.2, 16)
  fitted = true
  paintAll()
}

function paintAll() {
  paint(originalCanvas, baseSprite)
  paint(recoloredCanvas, recolorSprite)
  paint(inspectorCanvas, inspectorSprite())
  for (const layer of layers) {
    const thumb = thumbSprites.get(layer.id)
    if (thumb) paintFit(thumbCanvases[layer.id], thumb)
  }
  if (zoomValue) zoomValue.textContent = `${Math.round(view.scale * 100)}%`
}

function inspectorSprite(): HTMLCanvasElement {
  if (mode === 'original') return baseSprite
  if (mode === 'overlay') return overlaySprite
  if (mode === 'overlap') return overlapSprite
  return maskSprites.get(mode as Layer['id']) ?? baseSprite
}

function paint(canvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const bitmapWidth = Math.max(1, Math.round(width * ratio))
  const bitmapHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = view.scale < 1.6
  const originX = width / 2 - view.focusX * view.scale
  const originY = height / 2 - view.focusY * view.scale
  context.setTransform(ratio * view.scale, 0, 0, ratio * view.scale, ratio * originX, ratio * originY)
  context.drawImage(sourceCanvas, 0, 0)
}

function paintFit(canvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const bitmapWidth = Math.max(1, Math.round(width * ratio))
  const bitmapHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }
  const scale = Math.min((width - 8) / source.width, (height - 8) / source.height)
  const originX = (width - source.width * scale) / 2
  const originY = (height - source.height * scale) / 2
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = scale < 1.6
  context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * originX, ratio * originY)
  context.drawImage(sourceCanvas, 0, 0)
}

function bindViewport(canvas: HTMLCanvasElement) {
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const originX = canvas.clientWidth / 2 - view.focusX * view.scale
      const originY = canvas.clientHeight / 2 - view.focusY * view.scale
      const imageX = (pointerX - originX) / view.scale
      const imageY = (pointerY - originY) / view.scale
      const next = clamp(view.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), 0.2, 16)
      const nextOriginX = pointerX - imageX * next
      const nextOriginY = pointerY - imageY * next
      view.scale = next
      view.focusX = (canvas.clientWidth / 2 - nextOriginX) / next
      view.focusY = (canvas.clientHeight / 2 - nextOriginY) / next
      fitted = true
      paintAll()
    },
    { passive: false },
  )

  let drag: { x: number; y: number; focusX: number; focusY: number } | null = null
  canvas.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY, focusX: view.focusX, focusY: view.focusY }
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return
    view.focusX = drag.focusX - (event.clientX - drag.x) / view.scale
    view.focusY = drag.focusY - (event.clientY - drag.y) / view.scale
    fitted = true
    paintAll()
  })
  canvas.addEventListener('pointerup', () => {
    drag = null
  })
  canvas.addEventListener('pointercancel', () => {
    drag = null
  })
}

function renderReport(result: MaskValidationReport) {
  const root = document.querySelector<HTMLElement>('#report')
  if (!root) return
  const problems = result.issues.filter((issue) => issue.level === 'problem')
  const reviews = result.issues.filter((issue) => issue.level === 'review')
  const covered = result.layers
    .map((layer) => `${layer.label} ${layer.coveredPixels.toLocaleString()}`)
    .join(' · ')
  const unmasked = result.ornamentPixels - result.coveredOrnamentPixels
  const facts = document.createElement('p')
  facts.textContent = result.aligned
    ? `Aligned ${result.width}×${result.height}. Overlap ${result.overlapPixels.toLocaleString()}. Outside silhouette ${result.layers.reduce((sum, layer) => sum + layer.outsideSilhouette, 0).toLocaleString()}. ${covered}. Unmasked ornament pixels ${unmasked.toLocaleString()}, including cream, gold, cracks, and highlights.`
    : 'The mask sizes do not match the ceramic image.'
  root.replaceChildren(facts)
  for (const issue of problems) root.append(note(issue.message, 'problem'))
  for (const issue of reviews) root.append(note(issue.message, 'review'))
  if (problems.length === 0) {
    root.append(note('No alignment, overlap, or silhouette problems.', 'ok'))
  }
}

function note(message: string, kind: string) {
  const line = document.createElement('p')
  line.className = kind
  line.textContent = message
  return line
}

function colorSprite(base: ImageData, paints: Layer[], amount: number): HTMLCanvasElement {
  const image = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height)
  const pixels = image.data
  for (const layer of paints) {
    const mask = layer.mask.data
    const [red, green, blue] = layer.tint
    for (let index = 0; index < pixels.length; index += 4) {
      const weight = (mask[index] / 255) * amount
      if (weight <= 0) continue
      pixels[index] = mixByte(pixels[index], red, weight)
      pixels[index + 1] = mixByte(pixels[index + 1], green, weight)
      pixels[index + 2] = mixByte(pixels[index + 2], blue, weight)
    }
  }
  return spriteOf(image)
}

function overlapSpriteOf(base: ImageData, paints: Layer[], amount: number): HTMLCanvasElement {
  const image = colorSprite(base, paints, amount * 0.85)
  const pixels = image.getContext('2d')?.getImageData(0, 0, image.width, image.height)
  if (!pixels) return image
  const data = pixels.data
  for (let pixel = 0; pixel < base.width * base.height; pixel += 1) {
    let owners = 0
    for (const layer of paints) {
      if (layer.mask.data[pixel * 4] > 16) owners += 1
    }
    if (owners < 2) continue
    const index = pixel * 4
    data[index] = 255
    data[index + 1] = 220
    data[index + 2] = 70
    data[index + 3] = base.data[index + 3]
  }
  image.getContext('2d')?.putImageData(pixels, 0, 0)
  return image
}

function maskSprite(mask: ImageData): HTMLCanvasElement {
  const image = new ImageData(mask.width, mask.height)
  const sourcePixels = mask.data
  const pixels = image.data
  for (let index = 0; index < sourcePixels.length; index += 4) {
    pixels[index] = 255
    pixels[index + 1] = 255
    pixels[index + 2] = 255
    pixels[index + 3] = sourcePixels[index]
  }
  return spriteOf(image)
}

function spriteOf(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')?.putImageData(image, 0, 0)
  return canvas
}

function medianHex(base: ImageData, mask: ImageData): string {
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []
  const sourcePixels = base.data
  const maskPixels = mask.data
  for (let index = 0; index < sourcePixels.length; index += 4) {
    if (maskPixels[index] < 220 || sourcePixels[index + 3] < 200) continue
    reds.push(sourcePixels[index])
    greens.push(sourcePixels[index + 1])
    blues.push(sourcePixels[index + 2])
  }
  if (reds.length === 0) return '#888888'
  return hex(median(reds), median(greens), median(blues))
}

function median(values: number[]): number {
  values.sort((left, right) => left - right)
  return values[values.length >> 1]
}

function hex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function mixByte(from: number, to: number, amount: number): number {
  return Math.max(0, Math.min(255, Math.round(from + (to - from) * amount)))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function requiredCanvas(selector: string): HTMLCanvasElement {
  const canvas = document.querySelector<HTMLCanvasElement>(selector)
  if (!canvas) throw new Error(`Missing ${selector}.`)
  return canvas
}

function requiredInput(selector: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Missing ${selector}.`)
  return input
}

function loadImageData(url: URL): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Could not read the ceramic image.'))
        return
      }
      context.drawImage(image, 0, 0)
      resolve(context.getImageData(0, 0, canvas.width, canvas.height))
    }
    image.onerror = () => reject(new Error(`Could not load ${url.pathname}`))
    image.src = url.href
  })
}
