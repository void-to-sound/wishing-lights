import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { extractColors } from '../lib/colorExtraction.ts'
import {
  JEWELRY_BOX_INITIAL,
  LID_CLOSE_MS,
  LID_OPEN_MS,
  jewelryTransition,
  type JewelryEvent,
  type JewelryState,
} from '../lib/jewelryBox.ts'
import { sampleSequence, type Sequence } from '../lib/cameraSequence.ts'
import { PhotoReadError, preparePhoto } from '../lib/preparePhoto.ts'
import type { RoomCamera } from '../lib/roomCamera.ts'
import type { OrnamentDraft, OrnamentMaterial } from '../types/ornament.ts'

interface UseJewelryVisitOptions {
  enabled: boolean
  viewport: { width: number; height: number }
  sequence: Sequence | null
  aspects: Record<string, number>
  onCommit?: (draft: OrnamentDraft) => void
  onActive?: (active: boolean) => void
}

export interface JewelryVisit {
  phase: JewelryState['phase']
  lid: JewelryState['lid']
  camera: RoomCamera | null
  sceneId: string | null
  photoUrl: string | null
  colors: string[]
  accent: string | null
  material: Exclude<OrnamentMaterial, 'flat'>
  error: string | null
  activate: () => void
  choosePhoto: (file: File) => void
  chooseMaterial: (material: Exclude<OrnamentMaterial, 'flat'>) => void
  chooseAccent: (color: string) => void
  finish: () => void
  cancel: () => void
}

/**
 * Plays the existing two-shot sequence, then opens the designer.
 * The camera editor does not use this. Pass enabled=false there.
 */
export function useJewelryVisit({
  enabled,
  viewport,
  sequence,
  aspects,
  onCommit,
  onActive,
}: UseJewelryVisitOptions): JewelryVisit {
  const [state, dispatch] = useReducer(jewelryTransition, JEWELRY_BOX_INITIAL)
  const [camera, setCamera] = useState<RoomCamera | null>(null)
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [photo, setPhoto] = useState<OrnamentDraft['photo'] | null>(null)
  const [accent, setAccent] = useState<string | null>(null)
  const [material, setMaterial] = useState<Exclude<OrnamentMaterial, 'flat'>>('glass')
  const [error, setError] = useState<string | null>(null)
  const viewRef = useRef(viewport)
  const sequenceRef = useRef(sequence)
  const aspectsRef = useRef(aspects)
  const commitRef = useRef(onCommit)
  const activeRef = useRef(onActive)
  const photoRef = useRef(photo)
  const accentRef = useRef(accent)
  const materialRef = useRef(material)
  const requestRef = useRef(0)

  useLayoutEffect(() => {
    viewRef.current = viewport
    sequenceRef.current = sequence
    aspectsRef.current = aspects
    commitRef.current = onCommit
    activeRef.current = onActive
    photoRef.current = photo
    accentRef.current = accent
    materialRef.current = material
  })

  useEffect(() => {
    activeRef.current?.(state.phase !== 'closed')
  }, [state.phase])

  useEffect(() => {
    if (!enabled || !state.travel) return
    const direction = state.travel
    let frame = 0
    let cancelled = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let begin = 0

    const tick = (now: number) => {
      if (cancelled) return
      if (begin === 0) begin = now
      const current = sequenceRef.current
      const view = viewRef.current
      if (!current || view.width <= 0) {
        frame = requestAnimationFrame(tick)
        return
      }
      const total = current.shots.reduce((sum, shot) => sum + shot.take.duration, 0)
      const elapsed = reduced ? total : Math.min(now - begin, total)
      const clock = direction === 'forward' ? elapsed : Math.max(0, total - elapsed)
      const sample = sampleSequence(current, clock, view.width, view.height, {
        reducedMotion: reduced,
        aspects: aspectsRef.current,
      })
      setCamera(sample.camera)
      setSceneId(sample.sceneId)
      if (elapsed >= total) {
        if (direction === 'back') {
          setCamera(null)
          setSceneId(null)
          send('returned')
        } else {
          send('arrived')
        }
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [enabled, state.travel])

  useEffect(() => {
    if (!enabled || state.travel || state.phase === 'closed' || state.phase === 'returning') return
    const current = sequenceRef.current
    const view = viewRef.current
    if (!current || view.width <= 0) return
    const total = current.shots.reduce((sum, shot) => sum + shot.take.duration, 0)
    const sample = sampleSequence(current, total, view.width, view.height, {
      aspects: aspectsRef.current,
    })
    setCamera(sample.camera)
    setSceneId(sample.sceneId)
  }, [enabled, state.phase, state.travel, viewport.width, viewport.height])

  useEffect(() => {
    if (!enabled || !state.lid) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lid = state.lid
    const ms = reduced ? 0 : lid === 'open' ? LID_OPEN_MS : LID_CLOSE_MS
    const timer = window.setTimeout(() => send(lid === 'open' ? 'opened' : 'closed'), ms)
    return () => window.clearTimeout(timer)
  }, [enabled, state.lid])

  useEffect(() => {
    if (!enabled || state.phase !== 'completing') return
    const frame = requestAnimationFrame(() => {
      const current = photoRef.current
      if (current) {
        photoRef.current = null
        setPhoto(null)
        commitRef.current?.({
          photo: current,
          material: materialRef.current,
          colors: orderedColors(current.colors, accentRef.current),
        })
      }
      send('sealed')
    })
    return () => cancelAnimationFrame(frame)
  }, [enabled, state.phase])

  useEffect(() => {
    return () => {
      const current = photoRef.current
      if (current) URL.revokeObjectURL(current.photoUrl)
    }
  }, [])

  function send(event: JewelryEvent) {
    dispatch(event)
  }

  function clearPhoto() {
    const current = photoRef.current
    if (current) URL.revokeObjectURL(current.photoUrl)
    photoRef.current = null
    setPhoto(null)
    setAccent(null)
  }

  function activate() {
    if (!enabled || state.phase !== 'closed') return
    clearPhoto()
    setMaterial('glass')
    setError(null)
    send('activate')
  }

  function choosePhoto(file: File) {
    if (state.phase !== 'open' && state.phase !== 'designing') return
    const request = ++requestRef.current
    setError(null)
    void readPhoto(file).then((result) => {
      if (request !== requestRef.current) {
        if (result.photo) URL.revokeObjectURL(result.photo.photoUrl)
        return
      }
      if (result.error) {
        setError(result.error)
        return
      }
      if (!result.photo) return
      const previous = photoRef.current
      if (previous) URL.revokeObjectURL(previous.photoUrl)
      photoRef.current = result.photo
      setPhoto(result.photo)
      setAccent(result.photo.colors[0] ?? null)
      if (state.phase === 'open') send('photo')
    })
  }

  function finish() {
    if (state.phase !== 'designing' || !photoRef.current) return
    send('finish')
  }

  function cancel() {
    if (state.phase !== 'open' && state.phase !== 'designing') return
    requestRef.current += 1
    clearPhoto()
    setError(null)
    send('cancel')
  }

  return {
    phase: state.phase,
    lid: state.lid,
    camera,
    sceneId,
    photoUrl: photo?.photoUrl ?? null,
    colors: photo?.colors ?? [],
    accent,
    material,
    error,
    activate,
    choosePhoto,
    chooseMaterial: setMaterial,
    chooseAccent: setAccent,
    finish,
    cancel,
  }
}

function orderedColors(colors: string[], accent: string | null): string[] {
  if (!accent) return colors
  return [accent, ...colors.filter((color) => color !== accent)]
}

async function readPhoto(file: File): Promise<{ photo: OrnamentDraft['photo'] | null; error: string | null }> {
  try {
    const decoded = await preparePhoto(file)
    try {
      const colors = extractColors(decoded.bitmap)
      return {
        photo: {
          photoUrl: URL.createObjectURL(decoded.displayBlob),
          photo: decoded.displayBlob,
          colors,
        },
        error: null,
      }
    } finally {
      decoded.bitmap.close()
    }
  } catch (caught) {
    return { photo: null, error: messageFor(caught) }
  }
}

function messageFor(error: unknown): string {
  if (error instanceof PhotoReadError && error.reason === 'format') {
    return 'Choose a JPEG, PNG, HEIC, or HEIF photo.'
  }
  if (error instanceof PhotoReadError && error.reason === 'conversion') {
    return "This HEIC photo couldn't be converted. Try a JPEG or PNG."
  }
  return "This photo couldn't be read. Try a different JPEG or PNG."
}
