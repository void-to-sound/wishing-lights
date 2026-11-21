import { useEffect, useRef, useState } from 'react'
import type { CameraComposition } from '../lib/cameraSequence.ts'

interface CameraExperimentProps {
  editShot: number
  editEnd: 'start' | 'end'
  composition: CameraComposition
  duration: number
  dirty: boolean
  playing: boolean
  playingSequence: boolean
  loop: boolean
  status: string
  limit: string | null
  plate: { name: string; width: number; height: number } | null
  plateError: string | null
  onEditShot: (index: number) => void
  onEditEnd: (end: 'start' | 'end') => void
  onDuration: (duration: number) => void
  onSave: () => void
  onRevert: () => void
  onResetDefault: () => void
  onPreview: () => void
  onPlay: () => void
  onLoop: (loop: boolean) => void
  onPlateFile: (file: File) => void
  onPlateRemove: () => void
}

/**
 * Developer controls for framing. The picture itself is the editor.
 * Numbers here are a reading of the current frame, not fields to type into.
 */
export function CameraExperiment({
  editShot,
  editEnd,
  composition,
  duration,
  dirty,
  playing,
  playingSequence,
  loop,
  status,
  limit,
  plate,
  plateError,
  onEditShot,
  onEditEnd,
  onDuration,
  onSave,
  onRevert,
  onResetDefault,
  onPreview,
  onPlay,
  onLoop,
  onPlateFile,
  onPlateRemove,
}: CameraExperimentProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="camera-experiment" role="group" aria-label="Camera experiment">
      <p className="camera-status" aria-live="polite">
        {status}
        {dirty ? ' · Unsaved' : ''}
      </p>
      <div className="camera-actions">
        <button
          type="button"
          aria-label="Edit Shot 01"
          aria-pressed={editShot === 0}
          onClick={() => onEditShot(0)}
        >
          Shot 01
        </button>
        <button
          type="button"
          aria-label="Edit Shot 02"
          aria-pressed={editShot === 1}
          onClick={() => onEditShot(1)}
        >
          Shot 02
        </button>
        <button
          type="button"
          aria-label="Edit start"
          aria-pressed={editEnd === 'start'}
          onClick={() => onEditEnd('start')}
        >
          Start
        </button>
        <button
          type="button"
          aria-label="Edit end"
          aria-pressed={editEnd === 'end'}
          onClick={() => onEditEnd('end')}
        >
          End
        </button>
      </div>
      <dl className="camera-readout">
        <dt>X</dt>
        <dd>{format(composition.focusX)}</dd>
        <dt>Y</dt>
        <dd>{format(composition.focusY)}</dd>
        <dt>Width</dt>
        <dd>{format(composition.viewWidth)}</dd>
      </dl>
      <NumberField label="Duration ms" value={duration} min={100} max={8000} step={50} onCommit={onDuration} />
      {limit ? <p className="camera-note">{limit}</p> : null}
      {editShot === 1 ? (
        <div className="camera-plate">
          <p className="camera-note">
            {plate
              ? `${plate.name} · ${plate.width}×${plate.height}`
              : 'Low-resolution placeholder. This is still the wide room photograph.'}
          </p>
          {plateError ? <p className="camera-note">{plateError}</p> : null}
          <div className="camera-actions">
            <button type="button" onClick={() => fileRef.current?.click()}>
              {plate ? 'Replace image' : 'Choose image'}
            </button>
            {plate ? (
              <button type="button" onClick={onPlateRemove}>
                Remove image
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            className="camera-file"
            type="file"
            accept="image/*"
            aria-label="Close-up image"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onPlateFile(file)
            }}
          />
        </div>
      ) : null}
      <div className="camera-actions">
        <button type="button" aria-label="Save Framing" disabled={!dirty} onClick={onSave}>
          Save
        </button>
        <button type="button" aria-label="Revert Unsaved Changes" disabled={!dirty} onClick={onRevert}>
          Revert
        </button>
        <button type="button" aria-label="Reset to Default" onClick={onResetDefault}>
          Default
        </button>
      </div>
      <div className="camera-actions">
        <button type="button" aria-label="Preview Shot" aria-pressed={playing && !playingSequence} onClick={onPreview}>
          Preview
        </button>
        <button type="button" aria-label="Play Full Sequence" aria-pressed={playing && playingSequence} onClick={onPlay}>
          Play
        </button>
        <label className="camera-loop">
          <input type="checkbox" checked={loop} onChange={(event) => onLoop(event.target.checked)} />
          Loop
        </label>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(() => String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  function commit(next: string) {
    if (!/^\d+$/.test(next)) return
    const parsed = Number(next)
    if (!Number.isFinite(parsed)) return
    onCommit(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <label className="camera-duration">
      {label}
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          commit(text)
          setText(String(value))
        }}
        onChange={(event) => {
          setText(event.target.value)
          commit(event.target.value)
        }}
      />
    </label>
  )
}

function format(value: number): string {
  return value.toFixed(3)
}
