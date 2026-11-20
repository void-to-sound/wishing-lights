import type { MouseEvent } from 'react'
import { Ornament } from './Ornament.tsx'
import type { Ornament as OrnamentModel, TreePosition } from '../types/ornament.ts'

type PlacedOrnament = OrnamentModel & { position: TreePosition }

interface ChristmasTreeProps {
  ornaments: PlacedOrnament[]
  placing: boolean
  onPlace: (position: TreePosition) => void
  onSelect: (id: string) => void
}

/**
 * Shows the tree and the ornaments hanging on it.
 * A tap records a position as a fraction of this box, so it stays put when
 * the screen size changes. Ornament taps open a memory instead of placing.
 */
export function ChristmasTree({
  ornaments,
  placing,
  onPlace,
  onSelect,
}: ChristmasTreeProps) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!placing) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const x = clamp((event.clientX - rect.left) / rect.width, 0.08, 0.92)
    const y = clamp((event.clientY - rect.top) / rect.height, 0.08, 0.9)
    onPlace({ x, y })
  }

  return (
    <div className="tree-frame">
      <div
        className={placing ? 'tree-stage is-placing' : 'tree-stage'}
        onClick={handleClick}
      >
        <svg
          className="tree-svg"
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <rect width="200" height="300" fill="#163024" />
          <polygon points="100,34 158,126 42,126" fill="#2f8f4e" />
          <polygon points="100,84 178,194 22,194" fill="#257a40" />
          <polygon points="100,142 192,256 8,256" fill="#1d6636" />
          <rect x="86" y="256" width="28" height="32" fill="#6a4424" />
          <polygon
            points="100,10 106,26 100,22 94,26"
            fill="#f2d56b"
          />
        </svg>

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
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
