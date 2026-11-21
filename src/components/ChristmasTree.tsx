import { useEffect, useState, type MouseEvent } from 'react'
import { Ornament } from './Ornament.tsx'
import type { Ornament as OrnamentModel, TreePosition } from '../types/ornament.ts'

const ROOM_SRC = '/assets/winter-room.png'
const TREE_SRC = '/assets/white-light-tree.png'

type PlacedOrnament = OrnamentModel & { position: TreePosition }

interface ChristmasTreeProps {
  ornaments: PlacedOrnament[]
  placing: boolean
  onPlace: (position: TreePosition) => void
  onSelect: (id: string) => void
}

/**
 * Photographic room with the birch tree as its own layer.
 * A tap records a fraction of the tree image, so an ornament stays on the
 * same branch when the screen size changes. Only the visible branches accept
 * a new ornament. Ornament taps open a memory instead of placing.
 */
export function ChristmasTree({
  ornaments,
  placing,
  onPlace,
  onSelect,
}: ChristmasTreeProps) {
  const branches = useBranchMap(TREE_SRC)

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!placing) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    if (!branches || !isOnBranch(branches, x, y, rect.width)) return

    onPlace({
      x: clamp(x, 0.02, 0.98),
      y: clamp(y, 0.02, 0.98),
    })
  }

  return (
    <div className="tree-frame">
      <div className="room-stage">
        <img className="room-photo" src={ROOM_SRC} alt="" draggable={false} />
        <div
          className={placing ? 'tree-anchor is-placing' : 'tree-anchor'}
          onClick={handleClick}
        >
          <img className="tree-photo" src={TREE_SRC} alt="" draggable={false} />
          <ul className="ornament-layer" aria-label="Ornaments on the tree">
            {ornaments.map((ornament) => (
              <li
                key={ornament.id}
                className="ornament-slot"
                style={{
                  left: `${ornament.position.x * 100}%`,
                  top: `${ornament.position.y * 100}%`,
                }}
              >
                <Ornament
                  id={ornament.id}
                  colors={ornament.colors}
                  label="Open memory"
                  onPress={() => onSelect(ornament.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function useBranchMap(src: string): HTMLCanvasElement | null {
  const [map, setMap] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled || image.naturalWidth < 1) return
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(image, 0, 0)
      setMap(canvas)
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  return map
}

/** True when the point, or a fingertip-sized neighborhood, lands on the tree. */
function isOnBranch(
  map: HTMLCanvasElement,
  x: number,
  y: number,
  displayWidth: number,
): boolean {
  const context = map.getContext('2d', { willReadFrequently: true })
  if (!context || map.width < 1 || map.height < 1) return false

  const slop = (18 / displayWidth) * map.width
  const px = Math.round(x * (map.width - 1))
  const py = Math.round(y * (map.height - 1))
  const radius = Math.max(2, Math.round(slop))
  const x0 = clamp(px - radius, 0, map.width - 1)
  const y0 = clamp(py - radius, 0, map.height - 1)
  const x1 = clamp(px + radius, 0, map.width - 1)
  const y1 = clamp(py + radius, 0, map.height - 1)
  const data = context.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 48) return true
  }
  return false
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
