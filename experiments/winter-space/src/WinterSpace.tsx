import { useEffect, useState } from 'react'
import { BranchTree, type GlassOrnament } from './BranchTree.tsx'
import { Exterior } from './Exterior.tsx'
import { Room } from './Room.tsx'
import { WindowSnow } from './WindowSnow.tsx'
import { GLASS, place } from './scene.ts'

const TINTS = [
  { tint: '#e7c98a', highlight: '#fff4d4' },
  { tint: '#c5d7ea', highlight: '#f4f9ff' },
  { tint: '#efc8bc', highlight: '#fff1ec' },
  { tint: '#d5e2d4', highlight: '#f6fbf6' },
  { tint: '#e6d7be', highlight: '#fffaf0' },
]

const SEED: GlassOrnament[] = [
  { id: 'seed-1', x: 0.14, y: 0.74, ...TINTS[0] },
  { id: 'seed-2', x: 0.88, y: 0.52, ...TINTS[1] },
  { id: 'seed-3', x: 0.2, y: 0.36, ...TINTS[2] },
  { id: 'seed-4', x: 0.74, y: 0.28, ...TINTS[3] },
]

const PRISMS = [
  { left: '70%', top: '16%', size: '2.6%', delay: '0s' },
  { left: '79%', top: '24%', size: '1.5%', delay: '1.4s' },
  { left: '74%', top: '33%', size: '1.1%', delay: '2.2s' },
  { left: '86%', top: '20%', size: '1.8%', delay: '0.6s' },
  { left: '63%', top: '84%', size: '2.1%', delay: '1.8s' },
  { left: '76%', top: '89%', size: '1.3%', delay: '0.3s' },
  { left: '88%', top: '82%', size: '0.9%', delay: '2.6s' },
]

let nextId = 0

export function WinterSpace() {
  const reduced = useReducedMotion()
  const [ornaments, setOrnaments] = useState<GlassOrnament[]>(SEED)

  function handlePlace(position: { x: number; y: number }) {
    setOrnaments((current) => {
      if (current.length >= 16) return current
      nextId += 1
      const tint = TINTS[current.length % TINTS.length]
      return [...current, { id: `glass-${nextId}`, x: position.x, y: position.y, ...tint }]
    })
  }

  function handleRemove(id: string) {
    setOrnaments((current) => current.filter((ornament) => ornament.id !== id))
  }

  return (
    <main className={reduced ? 'winter is-still' : 'winter'}>
      <div className="stage">
        <div className="window-stack" style={place(GLASS)}>
          <Exterior />
          <WindowSnow reduced={reduced} />
        </div>
        <Room />
        <div className="prisms" aria-hidden="true">
          {PRISMS.map((prism) => (
            <span
              key={`${prism.left}-${prism.top}`}
              className="prism"
              style={{
                left: prism.left,
                top: prism.top,
                width: prism.size,
                animationDelay: prism.delay,
              }}
            />
          ))}
        </div>
        <BranchTree ornaments={ornaments} onPlace={handlePlace} onRemove={handleRemove} />
      </div>
      <footer className="caption">
        <p>Tap the white tree to hang a glass ornament. Tap an ornament to take it down.</p>
        <button type="button" onClick={() => setOrnaments(SEED)}>
          Reset ornaments
        </button>
      </footer>
    </main>
  )
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return reduced
}
