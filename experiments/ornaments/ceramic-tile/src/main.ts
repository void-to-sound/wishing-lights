import { recolorRegions } from './recolor.ts'

interface RegionSpec {
  id: string
  label: string
  original: string
  trial: string
  maskUrl: URL
}

const regions: RegionSpec[] = [
  {
    id: 'blue',
    label: '파랑',
    original: '#313a4d',
    trial: '#1f8a56',
    maskUrl: new URL('../assets/mask-blue.png', import.meta.url),
  },
  {
    id: 'purple',
    label: '자주',
    original: '#572422',
    trial: '#6a3dcc',
    maskUrl: new URL('../assets/mask-purple.png', import.meta.url),
  },
  {
    id: 'orange',
    label: '주황',
    original: '#b46138',
    trial: '#e23d5c',
    maskUrl: new URL('../assets/mask-orange.png', import.meta.url),
  },
]

const ornamentUrl = new URL('../assets/ornament.png', import.meta.url)
const originalCanvas = document.querySelector<HTMLCanvasElement>('#original')
const recoloredCanvas = document.querySelector<HTMLCanvasElement>('#recolored')
const strengthInput = document.querySelector<HTMLInputElement>('#strength')
const strengthValue = document.querySelector<HTMLElement>('#strength-value')
const stage = document.querySelector<HTMLElement>('#stage')

if (!originalCanvas || !recoloredCanvas || !strengthInput || !stage) {
  throw new Error('Missing ceramic tile experiment markup.')
}

const [source, masks] = await Promise.all([
  loadImageData(ornamentUrl),
  Promise.all(regions.map((region) => loadImageData(region.maskUrl))),
])

paint(originalCanvas, source)
let strength = Number(strengthInput.value) / 100

for (const region of regions) {
  const input = colorInput(region.id)
  const readout = document.querySelector<HTMLElement>(`#${region.id}-value`)
  input.value = region.original
  if (readout) readout.textContent = region.original
  input.addEventListener('input', () => {
    if (readout) readout.textContent = input.value
    render()
  })
}

strengthInput.addEventListener('input', () => {
  strength = Number(strengthInput.value) / 100
  if (strengthValue) strengthValue.textContent = `${strengthInput.value}%`
  render()
})

document.querySelector('#use-original')?.addEventListener('click', () => {
  applyPalette(regions.map((region) => region.original))
})

document.querySelector('#use-trial')?.addEventListener('click', () => {
  applyPalette(regions.map((region) => region.trial))
})

document.querySelectorAll<HTMLInputElement>('input[name="backdrop"]').forEach((input) => {
  input.addEventListener('change', () => {
    stage.classList.toggle('is-tree', input.value === 'tree' && input.checked)
  })
})

render()

function render() {
  paint(
    recoloredCanvas,
    recolorRegions(
      source,
      regions.map((region, index) => ({
        mask: masks[index].data,
        color: colorInput(region.id).value,
      })),
      strength,
    ),
  )
}

function applyPalette(colors: string[]) {
  regions.forEach((region, index) => {
    const input = colorInput(region.id)
    const readout = document.querySelector<HTMLElement>(`#${region.id}-value`)
    input.value = colors[index]
    if (readout) readout.textContent = colors[index]
  })
  render()
}

function colorInput(id: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`#color-${id}`)
  if (!input) throw new Error(`Missing color picker for ${id}.`)
  return input
}

function paint(canvas: HTMLCanvasElement, image: ImageData) {
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) return
  context.putImageData(image, 0, 0)
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
        reject(new Error('Could not read the tile image.'))
        return
      }
      context.drawImage(image, 0, 0)
      resolve(context.getImageData(0, 0, canvas.width, canvas.height))
    }
    image.onerror = () => reject(new Error(`Could not load ${url.pathname}`))
    image.src = url.href
  })
}
