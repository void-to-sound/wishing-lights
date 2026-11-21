import { FIRE, FLOOR_Y, GLASS, SCENE_H, SCENE_W, frameAround, panes } from './scene.ts'

const FRAME = frameAround(GLASS, 22)
const OPENINGS = panes()

/**
 * Static architecture: paneled ivory walls, a left window, a fireplace, marble.
 * The glass panes are holes, so the winter view and snow show through.
 */
export function Room() {
  return (
    <svg
      className="room"
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wall-wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f3ec" />
          <stop offset="0.7" stopColor="#efe8dc" />
          <stop offset="1" stopColor="#e6ddd0" />
        </linearGradient>
        <linearGradient id="floor-wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4efe6" />
          <stop offset="0.4" stopColor="#e7e0d4" />
          <stop offset="1" stopColor="#d9d0c3" />
        </linearGradient>
        <linearGradient id="mantel-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffcf7" />
          <stop offset="1" stopColor="#e8e0d4" />
        </linearGradient>
        <radialGradient id="fire-core" cx="50%" cy="70%" r="65%">
          <stop offset="0" stopColor="#ffe1a8" />
          <stop offset="0.45" stopColor="#ff9a45" />
          <stop offset="1" stopColor="#8a3418" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="window-light" cx="30%" cy="40%" r="55%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="fire-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id="firebox">
          <rect x={FIRE.x} y={FIRE.y} width={FIRE.w} height={FIRE.h} />
        </clipPath>
        <radialGradient id="fire-floor" cx="50%" cy="0%" r="80%">
          <stop offset="0" stopColor="#ffb15a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffb15a" stopOpacity="0" />
        </radialGradient>
        <mask id="wall-holes" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width={SCENE_W} height={SCENE_H}>
          <rect width={SCENE_W} height={SCENE_H} fill="white" />
          {OPENINGS.map((pane) => (
            <rect key={`${pane.x}-${pane.y}`} x={pane.x} y={pane.y} width={pane.w} height={pane.h} fill="black" />
          ))}
        </mask>
      </defs>

      <g mask="url(#wall-holes)">
        <rect width={SCENE_W} height={FLOOR_Y} fill="url(#wall-wash)" />
        <rect width={SCENE_W} height="26" fill="#fbf8f3" />
        <rect y="26" width={SCENE_W} height="8" fill="#e4dccf" />
        <Panel x={760} y={86} w={250} h={300} />
        <Panel x={1036} y={86} w={250} h={180} />
        <Panel x={1310} y={86} w={220} h={300} />
        <rect y="430" width={SCENE_W} height="11" fill="#f8f4ee" />
        <rect y="441" width={SCENE_W} height="4" fill="#ddd4c6" />
        <Panel x={760} y={470} w={250} h={240} />
        <Panel x={1310} y={430} w={220} h={280} />
        <rect y={FLOOR_Y - 18} width={SCENE_W} height="18" fill="#fbf8f3" />
        <ellipse cx="390" cy="300" rx="280" ry="220" fill="url(#window-light)" />
      </g>

      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.w}
        height={FRAME.h}
        fill="none"
        stroke="#fbf8f3"
        strokeWidth="22"
      />
      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.w}
        height={FRAME.h}
        fill="none"
        stroke="#ddd4c6"
        strokeWidth="1.5"
      />

      <Fireplace />

      <rect y={FLOOR_Y} width={SCENE_W} height={SCENE_H - FLOOR_Y} fill="url(#floor-wash)" />
      <path d="M40 800 C260 792 420 808 680 796" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5" />
      <path d="M860 834 C1100 826 1280 844 1500 830" fill="none" stroke="#cfc6b8" strokeOpacity="0.28" strokeWidth="1.5" />
      <path d="M180 910 C460 900 640 922 980 906" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
      <ellipse cx="1194" cy="790" rx="170" ry="36" fill="url(#fire-floor)" />
      <rect y={FLOOR_Y} width={SCENE_W} height="3" fill="#d9d0c2" />
    </svg>
  )
}

function Panel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#f4efe6" stroke="#e6ded2" strokeWidth="1.5" />
      <rect x={x + 12} y={y + 12} width={w - 24} height={h - 24} fill="none" stroke="#efe8dc" strokeWidth="1" />
    </g>
  )
}

function Fireplace() {
  return (
    <g>
      <rect x="1008" y="708" width="372" height="40" fill="#f7f2ea" stroke="#e0d7c9" />
      <rect x="1036" y="668" width="316" height="42" fill="#fbf7f1" />
      <rect x="1064" y="430" width="260" height="250" fill="url(#mantel-face)" stroke="#e4dccf" />
      <rect x="1032" y="404" width="324" height="28" rx="2" fill="#fffcf8" stroke="#e0d7c9" />
      <g clipPath="url(#firebox)">
        <rect x={FIRE.x} y={FIRE.y} width={FIRE.w} height={FIRE.h} fill="#241c18" />
        <ellipse className="flame flame-a" cx="1194" cy="646" rx="92" ry="48" fill="url(#fire-core)" filter="url(#fire-blur)" />
        <rect x="1110" y="652" width="168" height="14" rx="2" fill="#4a3024" />
      </g>
    </g>
  )
}
