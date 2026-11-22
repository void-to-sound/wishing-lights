import { useEffect, useState } from 'react'
import { JEWELRY_BOX } from '../lib/cameraPresets.ts'
import {
  JEWELRY_BOX_FRAME_FILES,
  LID_CLOSE_MS,
  LID_OPEN_MS,
  frameBlend,
  type JewelryPhase,
} from '../lib/jewelryBox.ts'

interface JewelryHotspotProps {
  onOpen: () => void
}

/** Glass label over the box. The words are text, so the typeface can change later. */
export function JewelryHotspot({ onOpen }: JewelryHotspotProps) {
  return (
    <button
      type="button"
      className="glass-pill jewelry-hit"
      style={{
        left: `${(JEWELRY_BOX.x + 0.13) * 100}%`,
        top: `${(JEWELRY_BOX.y - 0.07) * 100}%`,
      }}
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      + 사진으로 장식 만들기
    </button>
  )
}

interface JewelryStageProps {
  phase: JewelryPhase
  lid: 'open' | 'close' | null
  anchor: { x: number; y: number }
}

/**
 * The lid layer, in fractions of the scene.
 * Four transparent frames share one canvas, so the feet stay put while the lid rises.
 */
export function JewelryStage({ phase, lid, anchor }: JewelryStageProps) {
  const frames = useJewelryFrames()
  const progress = useLidProgress(phase, lid)
  const showGlow = phase !== 'closed' && phase !== 'returning' && Boolean(frames)
  const blend = frames ? frameBlend(frames.length, progress) : null
  const current = frames && blend ? frames[blend.index] : null
  const upcoming = frames && blend ? frames[blend.next] : null

  return (
    <div
      className="jewelry-stage"
      data-jewelry-phase={phase}
      style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
    >
      {showGlow ? (
        <div className="jewelry-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {current ? (
        <img className="jewelry-frame" src={current} alt="" draggable={false} />
      ) : frames === null ? (
        <p className="jewelry-missing">Jewelry box frames needed</p>
      ) : null}
      {upcoming && upcoming !== current ? (
        <img
          className="jewelry-frame is-next"
          src={upcoming}
          alt=""
          draggable={false}
          style={{ opacity: blend?.mix ?? 0 }}
        />
      ) : null}
    </div>
  )
}

function useJewelryFrames(): string[] | null | undefined {
  const [frames, setFrames] = useState<string[] | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const files = [
      JEWELRY_BOX_FRAME_FILES.closed,
      ...JEWELRY_BOX_FRAME_FILES.opening,
      JEWELRY_BOX_FRAME_FILES.open,
    ]
    void Promise.all(files.map(probeImage)).then((loaded) => {
      if (cancelled) return
      const closed = loaded[0]
      const open = loaded[loaded.length - 1]
      if (!closed || !open) {
        setFrames(null)
        return
      }
      const opening = loaded.slice(1, -1).filter((src): src is string => src !== null)
      setFrames([closed, ...opening, open])
    })
    return () => {
      cancelled = true
    }
  }, [])

  return frames
}

function probeImage(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(src)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function useLidProgress(phase: JewelryPhase, lid: 'open' | 'close' | null): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!lid) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced ? 0 : lid === 'open' ? LID_OPEN_MS : LID_CLOSE_MS
    const from = lid === 'open' ? 0 : 1
    const to = lid === 'open' ? 1 : 0
    let frame = 0
    let started = 0
    const tick = (now: number) => {
      if (duration === 0) {
        setProgress(to)
        return
      }
      if (started === 0) started = now
      const amount = Math.min(1, (now - started) / duration)
      const eased = amount * amount * (3 - 2 * amount)
      setProgress(from + (to - from) * eased)
      if (amount < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [lid])

  return lid ? progress : openAmount(phase)
}

function openAmount(phase: JewelryPhase): number {
  if (phase === 'open' || phase === 'designing' || phase === 'completing') return 1
  return 0
}
