import { extractColors } from '../../../src/lib/colorExtraction.ts'
import { recolor, type Technique } from './recolor.ts'
import { versions, type OrnamentVersion } from './versions.ts'

interface PhotoSlot {
  url: string
  colors: string[]
}

interface Stage {
  version: OrnamentVersion
  source: ImageData
  mask: Uint8ClampedArray
  root: HTMLElement
  detail: HTMLCanvasElement
  original: HTMLCanvasElement
  recolors: HTMLCanvasElement[]
}

const photos: Array<PhotoSlot | null> = [null, null, null]
let technique: Technique = 'luma'
let strength = 0.8
let selected = 0
let view = 'v1'

const boards = document.querySelector<HTMLElement>('#boards')
const techniqueInput = document.querySelector<HTMLSelectElement>('#technique')
const strengthInput = document.querySelector<HTMLInputElement>('#strength')
const strengthValue = document.querySelector<HTMLElement>('#strength-value')
const versionInput = document.querySelector<HTMLSelectElement>('#version')

if (!boards) throw new Error('Missing ornament boards.')

const stages: Stage[] = []
for (const version of versions) {
  const ornament = await loadImage(version.ornament)
  const maskImage = await loadImage(version.mask)
  stages.push(mount(version, imageDataOf(ornament), imageDataOf(maskImage).data))
}

render()

techniqueInput?.addEventListener('change', () => {
  technique = techniqueInput.value === 'hsl' ? 'hsl' : 'luma'
  render()
})

versionInput?.addEventListener('change', () => {
  view = versionInput.value
  render()
})

strengthInput?.addEventListener('input', () => {
  strength = Number(strengthInput.value) / 100
  if (strengthValue) strengthValue.textContent = `${strengthInput.value}%`
  render()
})

document.querySelectorAll<HTMLInputElement>('.photo input').forEach((input) => {
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const slot = Number(input.dataset.slot)
    void readPhoto(slot, file)
  })
})

boards.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const slot = target.closest<HTMLElement>('[data-slot]')
  if (!slot) return
  selected = Number(slot.dataset.slot)
  render()
})

async function readPhoto(slot: number, file: File) {
  if (!file.type.startsWith('image/')) return
  const previous = photos[slot]
  if (previous) URL.revokeObjectURL(previous.url)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const colors = extractColors(bitmap, 5)
  bitmap.close()
  photos[slot] = { url: URL.createObjectURL(file), colors }
  selected = slot
  render()
}

function render() {
  document.querySelectorAll<HTMLElement>('.photo[data-slot]').forEach((element) => {
    element.classList.toggle('is-selected', Number(element.dataset.slot) === selected)
  })

  photos.forEach((photo, index) => {
    const card = document.querySelector<HTMLElement>(`.photo[data-slot="${index}"]`)
    const preview = card?.querySelector<HTMLImageElement>('img')
    const palette = card?.querySelector<HTMLElement>('.palette')
    if (!card || !preview || !palette) return
    if (!photo) {
      preview.removeAttribute('src')
      preview.hidden = true
      palette.replaceChildren()
      return
    }
    preview.src = photo.url
    preview.hidden = false
    palette.replaceChildren(
      ...photo.colors.map((color) => {
        const swatch = document.createElement('span')
        swatch.className = 'swatch'
        swatch.style.backgroundColor = color
        swatch.title = color
        return swatch
      }),
    )
  })

  for (const stage of stages) {
    const visible = view === 'both' || view === stage.version.id
    stage.root.hidden = !visible
    if (!visible) continue
    paint(stage.original, stage.source)
    stage.recolors.forEach((canvas, index) => {
      const photo = photos[index]
      const figure = canvas.closest('figure')
      figure?.classList.toggle('is-selected', index === selected)
      paint(
        canvas,
        photo ? recolor(stage.source, stage.mask, photo.colors, technique, strength) : stage.source,
      )
    })
    const chosen = photos[selected]
    paint(
      stage.detail,
      chosen ? recolor(stage.source, stage.mask, chosen.colors, technique, strength) : stage.source,
    )
  }
}

function mount(version: OrnamentVersion, source: ImageData, mask: Uint8ClampedArray): Stage {
  const root = document.createElement('section')
  root.className = 'board'
  root.dataset.version = version.id

  const heading = document.createElement('h2')
  heading.textContent = version.label

  const detail = document.createElement('canvas')
  detail.className = 'detail'
  detail.setAttribute('aria-label', `${version.label} preview`)

  const compare = document.createElement('section')
  compare.className = 'compare'
  compare.setAttribute('aria-label', version.label)
  const original = figureCanvas(compare, 'Original glass')
  const recolors = [0, 1, 2].map((index) => figureCanvas(compare, `Photo ${index + 1}`, index))

  root.append(heading, detail, compare)
  boards?.append(root)
  return { version, source, mask, root, detail, original, recolors }
}

function figureCanvas(parent: HTMLElement, captionText: string, slot?: number): HTMLCanvasElement {
  const figure = document.createElement('figure')
  if (slot !== undefined) figure.dataset.slot = String(slot)
  const canvas = document.createElement('canvas')
  const caption = document.createElement('figcaption')
  caption.textContent = captionText
  figure.append(canvas, caption)
  parent.append(figure)
  return canvas
}

function paint(canvas: HTMLCanvasElement, image: ImageData) {
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) return
  context.putImageData(image, 0, 0)
}

function imageDataOf(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read the ornament image.')
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function loadImage(url: URL): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${url.pathname}`))
    image.src = url.href
  })
}
