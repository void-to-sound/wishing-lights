import type { CameraComposition, Sequence } from './cameraSequence.ts'

/**
 * Saved shot framing. This is separate from ornament storage.
 * Images are not kept here; the close-up plate lives in its own database.
 */
export const FRAMING_STORAGE_KEY = 'wishing-lights.camera-framing'

export interface StoredShotFraming {
  id: string
  duration: number
  startHome: boolean
  start: CameraComposition
  end: CameraComposition
}

export interface StoredFraming {
  version: 1
  shots: StoredShotFraming[]
}

export function framingFromSequence(sequence: Sequence): StoredFraming {
  return {
    version: 1,
    shots: sequence.shots.map((shot) => {
      const start = shot.take.samples[0]
      const end = shot.take.samples[shot.take.samples.length - 1]
      return {
        id: shot.id,
        duration: shot.take.duration,
        startHome: start?.home === true,
        start: start?.composition ?? { focusX: 0.5, focusY: 0.5, viewWidth: 1 },
        end: end?.composition ?? { focusX: 0.5, focusY: 0.5, viewWidth: 1 },
      }
    }),
  }
}

/** Overlay saved start and end frames onto the current sequence. */
export function applyFraming(sequence: Sequence, stored: StoredFraming): Sequence {
  return {
    ...sequence,
    shots: sequence.shots.map((shot) => {
      const saved = stored.shots.find((item) => item.id === shot.id)
      if (!saved || !isComposition(saved.start) || !isComposition(saved.end)) return shot
      const duration = clamp(saved.duration, 100, 8000)
      return {
        ...shot,
        take: {
          ...shot.take,
          duration,
          samples: [
            { time: 0, home: saved.startHome === true, composition: saved.start },
            { time: duration, composition: saved.end },
          ],
        },
      }
    }),
  }
}

export function readFraming(storage: Storage | null = browserStorage()): StoredFraming | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(FRAMING_STORAGE_KEY)
    if (!raw) return null
    return parseFraming(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeFraming(
  sequence: Sequence,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(FRAMING_STORAGE_KEY, JSON.stringify(framingFromSequence(sequence)))
  } catch {
    // A full or blocked store keeps the draft in memory for this visit.
  }
}

export function parseFraming(value: unknown): StoredFraming | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.shots)) return null
  const shots: StoredShotFraming[] = []
  for (const item of value.shots) {
    if (!isRecord(item) || typeof item.id !== 'string') return null
    if (typeof item.duration !== 'number' || !Number.isFinite(item.duration)) return null
    if (!isComposition(item.start) || !isComposition(item.end)) return null
    shots.push({
      id: item.id,
      duration: item.duration,
      startHome: item.startHome === true,
      start: { ...item.start },
      end: { ...item.end },
    })
  }
  return { version: 1, shots }
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isComposition(value: unknown): value is CameraComposition {
  if (!isRecord(value)) return false
  return [value.focusX, value.focusY, value.viewWidth].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
