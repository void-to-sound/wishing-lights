import { JEWELRY_BOX } from './cameraPresets.ts'

/**
 * The jewelry box visit.
 * Playback of the camera lives outside this module.
 * Repeated events during a transition leave the state unchanged.
 */
export type JewelryPhase =
  | 'closed'
  | 'opening'
  | 'open'
  | 'designing'
  | 'completing'
  | 'closing'
  | 'returning'

export type JewelryEvent =
  | 'activate'
  | 'arrived'
  | 'opened'
  | 'photo'
  | 'finish'
  | 'cancel'
  | 'sealed'
  | 'closed'
  | 'returned'

export interface JewelryState {
  phase: JewelryPhase
  /** A camera move the scene should play. Null once that move has finished. */
  travel: 'forward' | 'back' | null
  /** The lid animation running after the camera arrives, or before it leaves. */
  lid: 'open' | 'close' | null
}

export const JEWELRY_BOX_INITIAL: JewelryState = {
  phase: 'closed',
  travel: null,
  lid: null,
}

/**
 * Matched transparent frames. The visit plays these in order, then backwards.
 * A reference photo or storyboard is not one of these files: the lid, scale,
 * angle, and lighting have to match across the set, with no text in the art.
 */
export const JEWELRY_BOX_FRAME_FILES = {
  closed: '/assets/jewelry-box/closed.png',
  opening: ['/assets/jewelry-box/opening-1.png', '/assets/jewelry-box/opening-2.png'],
  open: '/assets/jewelry-box/open.png',
} as const

export const LID_OPEN_MS = 1200
export const LID_CLOSE_MS = 900

/** How far a 0–1 lid amount is between two neighboring frames. */
export function frameBlend(
  frameCount: number,
  progress: number,
): { index: number; next: number; mix: number } {
  if (frameCount <= 1) return { index: 0, next: 0, mix: 0 }
  const spanned = clamp(progress, 0, 1) * (frameCount - 1)
  const index = Math.min(frameCount - 2, Math.floor(spanned))
  return { index, next: index + 1, mix: spanned - index }
}

/**
 * The four lid frames in public/assets/jewelry-box.
 * They share one canvas, with the feet on the same baseline.
 */
export const JEWELRY_BOX_FRAMES: {
  closed: string | null
  opening: readonly string[]
  open: string | null
} = {
  closed: JEWELRY_BOX_FRAME_FILES.closed,
  opening: JEWELRY_BOX_FRAME_FILES.opening,
  open: JEWELRY_BOX_FRAME_FILES.open,
}

export const MISSING_JEWELRY_BOX_ASSETS = [
  'Optional high-resolution close-up plate of the box, used as the background of the second shot.',
] as const

export function jewelryBoxFramesReady(): boolean {
  return Boolean(JEWELRY_BOX_FRAMES.closed && JEWELRY_BOX_FRAMES.open)
}

/** Click target on the room photograph, as fractions of that picture. */
export const JEWELRY_BOX_HIT = {
  x: JEWELRY_BOX.x - 0.055,
  y: JEWELRY_BOX.y - 0.11,
  width: 0.12,
  height: 0.2,
} as const

/** Where the ornament and glow sit in the active picture. */
export function jewelryStagePoint(usingPlate: boolean): { x: number; y: number } {
  if (usingPlate) return { x: 0.5, y: 0.7 }
  return { x: JEWELRY_BOX.x, y: JEWELRY_BOX.y }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function jewelryTransition(state: JewelryState, event: JewelryEvent): JewelryState {
  const still: JewelryState = { ...state, travel: null, lid: null }

  switch (state.phase) {
    case 'closed':
      if (event === 'activate') return { phase: 'opening', travel: 'forward', lid: null }
      return state
    case 'opening':
      if (event === 'arrived' && state.travel === 'forward') {
        return { phase: 'opening', travel: null, lid: 'open' }
      }
      if (event === 'opened' && state.lid === 'open') return { phase: 'open', travel: null, lid: null }
      return state
    case 'open':
      if (event === 'photo') return { ...still, phase: 'designing' }
      if (event === 'cancel') return { phase: 'closing', travel: null, lid: 'close' }
      return state
    case 'designing':
      if (event === 'finish') return { ...still, phase: 'completing' }
      if (event === 'cancel') return { phase: 'closing', travel: null, lid: 'close' }
      return state
    case 'completing':
      if (event === 'sealed') return { phase: 'closing', travel: null, lid: 'close' }
      return state
    case 'closing':
      if (event === 'closed' && state.lid === 'close') {
        return { phase: 'returning', travel: 'back', lid: null }
      }
      return state
    case 'returning':
      if (event === 'returned') return { ...JEWELRY_BOX_INITIAL }
      return state
    default:
      return state
  }
}
