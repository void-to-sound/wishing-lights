import type { MouseEvent } from 'react'

export interface GlassOrnament {
  id: string
  x: number
  y: number
  tint: string
  highlight: string
}

interface BranchTreeProps {
  ornaments: GlassOrnament[]
  onPlace: (position: { x: number; y: number }) => void
  onRemove: (id: string) => void
}

const BRANCHES: { d: string; width: number }[] = [
  { d: 'M250 840 C200 830 130 845 78 802', width: 2.4 },
  { d: 'M78 802 C58 788 46 766 64 748', width: 1.1 },
  { d: 'M160 822 C150 800 168 784 184 792', width: 0.9 },
  { d: 'M252 808 C310 796 380 808 442 768', width: 2.3 },
  { d: 'M442 768 C462 754 470 732 452 718', width: 1.05 },
  { d: 'M360 792 C372 770 358 754 344 760', width: 0.85 },
  { d: 'M248 746 C180 724 110 742 56 692', width: 2 },
  { d: 'M56 692 C38 676 34 654 54 642', width: 1 },
  { d: 'M140 720 C128 700 146 684 162 692', width: 0.8 },
  { d: 'M254 728 C330 700 400 712 468 662', width: 1.9 },
  { d: 'M468 662 C486 646 488 624 468 614', width: 0.95 },
  { d: 'M380 690 C394 668 380 652 366 660', width: 0.8 },
  { d: 'M247 650 C170 616 96 628 42 568', width: 1.7 },
  { d: 'M42 568 C24 552 26 528 48 518', width: 0.9 },
  { d: 'M120 610 C108 590 126 574 140 582', width: 0.75 },
  { d: 'M255 632 C340 590 412 572 472 522', width: 1.65 },
  { d: 'M472 522 C490 506 492 484 472 474', width: 0.9 },
  { d: 'M370 580 C384 558 370 542 356 550', width: 0.75 },
  { d: 'M249 548 C186 500 118 486 68 428', width: 1.45 },
  { d: 'M68 428 C50 412 52 390 72 380', width: 0.85 },
  { d: 'M150 490 C138 470 156 456 170 464', width: 0.7 },
  { d: 'M253 530 C332 478 404 452 462 394', width: 1.4 },
  { d: 'M462 394 C480 378 478 356 458 348', width: 0.8 },
  { d: 'M250 456 C196 400 140 372 96 316', width: 1.25 },
  { d: 'M96 316 C80 300 86 278 106 272', width: 0.75 },
  { d: 'M254 438 C318 382 376 352 428 302', width: 1.2 },
  { d: 'M428 302 C446 286 444 266 424 260', width: 0.7 },
  { d: 'M251 360 C214 290 184 230 206 150', width: 1.15 },
  { d: 'M206 150 C198 122 208 92 228 78', width: 0.7 },
  { d: 'M250 312 C304 258 346 220 368 162', width: 1 },
  { d: 'M368 162 C380 144 374 124 358 118', width: 0.65 },
  { d: 'M248 270 C200 224 164 190 146 140', width: 0.9 },
  { d: 'M146 140 C134 122 142 104 160 100', width: 0.6 },
]

const LIGHTS: { x: number; y: number; delay: number }[] = [
  { x: 78, y: 802, delay: 0.2 },
  { x: 64, y: 748, delay: 1.2 },
  { x: 184, y: 792, delay: 0.7 },
  { x: 442, y: 768, delay: 0.4 },
  { x: 452, y: 718, delay: 1.6 },
  { x: 344, y: 760, delay: 1.0 },
  { x: 56, y: 692, delay: 0.5 },
  { x: 54, y: 642, delay: 1.8 },
  { x: 162, y: 692, delay: 0.15 },
  { x: 468, y: 662, delay: 1.35 },
  { x: 468, y: 614, delay: 0.85 },
  { x: 366, y: 660, delay: 1.55 },
  { x: 42, y: 568, delay: 0.3 },
  { x: 48, y: 518, delay: 1.7 },
  { x: 140, y: 582, delay: 0.95 },
  { x: 472, y: 522, delay: 1.25 },
  { x: 472, y: 474, delay: 0.6 },
  { x: 356, y: 550, delay: 1.9 },
  { x: 68, y: 428, delay: 0.45 },
  { x: 72, y: 380, delay: 1.4 },
  { x: 170, y: 464, delay: 0.75 },
  { x: 462, y: 394, delay: 1.05 },
  { x: 458, y: 348, delay: 1.65 },
  { x: 96, y: 316, delay: 0.25 },
  { x: 106, y: 272, delay: 1.15 },
  { x: 428, y: 302, delay: 0.55 },
  { x: 424, y: 260, delay: 1.85 },
  { x: 206, y: 150, delay: 0.9 },
  { x: 228, y: 78, delay: 1.5 },
  { x: 368, y: 162, delay: 0.35 },
  { x: 358, y: 118, delay: 1.75 },
  { x: 146, y: 140, delay: 1.1 },
  { x: 160, y: 100, delay: 0.65 },
  { x: 250, y: 250, delay: 1.45 },
]

export function BranchTree({ ornaments, onPlace, onRemove }: BranchTreeProps) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = clamp((event.clientX - rect.left) / rect.width, 0.05, 0.95)
    const y = clamp((event.clientY - rect.top) / rect.height, 0.05, 0.93)
    onPlace({ x, y })
  }

  return (
    <div className="tree-layer" onClick={handleClick}>
      <svg className="tree-drawing" viewBox="0 0 500 920" aria-hidden="true">
        <defs>
          <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e4ddd2" />
            <stop offset="0.42" stopColor="#fbf8f3" />
            <stop offset="1" stopColor="#d5cdc0" />
          </linearGradient>
        </defs>
        <ellipse cx="250" cy="892" rx="54" ry="10" fill="#c9c0b2" opacity="0.28" />
        <path
          d="M242 900 C238 760 244 600 248 460 C250 390 248 300 250 220 L260 220 C258 300 262 400 264 470 C270 610 264 770 262 900 Z"
          fill="url(#trunk)"
        />
        <path d="M250 860 V240" stroke="#e7e0d4" strokeWidth="1" opacity="0.7" />
        {BRANCHES.map((branch) => (
          <path
            key={`${branch.d}-shade`}
            d={branch.d}
            fill="none"
            stroke="#c9bfb2"
            strokeWidth={branch.width + 1.3}
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}
        {BRANCHES.map((branch) => (
          <path
            key={branch.d}
            d={branch.d}
            fill="none"
            stroke="#f7f2ea"
            strokeWidth={branch.width}
            strokeLinecap="round"
          />
        ))}
        {LIGHTS.map((light) => (
          <g key={`${light.x}-${light.y}`} className="fairy" style={{ animationDelay: `${light.delay}s` }}>
            <circle cx={light.x} cy={light.y} r="8" fill="#ffd48a" opacity="0.55" />
            <circle cx={light.x} cy={light.y} r="2.3" fill="#fff4d4" />
          </g>
        ))}
      </svg>

      <ul className="glass-layer" aria-label="Glass ornaments">
        {ornaments.map((ornament) => (
          <li
            key={ornament.id}
            className="glass-slot"
            style={{ left: `${ornament.x * 100}%`, top: `${ornament.y * 100}%` }}
          >
            <button
              type="button"
              className="glass-button"
              aria-label="Take down ornament"
              onClick={(event) => {
                event.stopPropagation()
                onRemove(ornament.id)
              }}
            >
              <svg viewBox="0 0 64 76" aria-hidden="true">
                <path d="M32 6 v10" stroke="#c6a15a" strokeWidth="2" />
                <circle cx="32" cy="6" r="3" fill="#e4c98a" />
                <rect x="26" y="14" width="12" height="6" rx="1.5" fill="#d7b56a" />
                <defs>
                  <radialGradient id={`glass-${ornament.id}`} cx="38%" cy="34%" r="70%">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="0.28" stopColor={ornament.highlight} />
                    <stop offset="1" stopColor={ornament.tint} />
                  </radialGradient>
                </defs>
                <circle cx="32" cy="44" r="20" fill={`url(#glass-${ornament.id})`} />
                <ellipse cx="25" cy="36" rx="6" ry="3.5" fill="#ffffff" opacity="0.7" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
