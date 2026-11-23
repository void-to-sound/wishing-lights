import { useEffect, useState, type PointerEvent } from 'react'
import {
  DEFAULT_LOFI_ID,
  LOFI_TRACKS,
  VISIBLE_ASMR,
  type AudioSource,
} from '../audio/config.ts'
import {
  activateExclusive,
  getChannel,
  type AudioChannel,
  type ChannelSnapshot,
} from '../audio/player.ts'

/**
 * Temporary playback controls for the winter room.
 * ASMR sits on the mantel photograph. Lo-fi stays fixed on the screen.
 */
const MANTEL_ANCHOR = { x: 0.647, y: 0.56 }

function useChannel(source: AudioSource): [ChannelSnapshot, AudioChannel] {
  const channel = getChannel(source)
  const [, refresh] = useState(0)

  useEffect(
    () =>
      channel.subscribe(() => {
        refresh((version) => version + 1)
      }),
    [channel],
  )

  return [channel.snapshot(), channel]
}

function stopSceneGesture(event: PointerEvent<HTMLDivElement>): void {
  event.stopPropagation()
}

export function MantelAudioControls({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      className={hidden ? 'audio-controls audio-mantel is-hidden' : 'audio-controls audio-mantel'}
      style={{ left: `${MANTEL_ANCHOR.x * 100}%`, top: `${MANTEL_ANCHOR.y * 100}%` }}
      role="group"
      aria-label="Fireplace sounds"
      onPointerDown={stopSceneGesture}
    >
      {VISIBLE_ASMR.map((source) => (
        <AsmrButton key={source.id} source={source} />
      ))}
    </div>
  )
}

function AsmrButton({ source }: { source: AudioSource }) {
  const [snapshot, channel] = useChannel(source)

  function toggle() {
    if (channel.wantsAudio) {
      channel.pause()
      return
    }
    void channel.play()
  }

  return (
    <>
      <button
        type="button"
        className="audio-button"
        aria-pressed={snapshot.wantsAudio}
        title={snapshot.message ?? undefined}
        onClick={toggle}
      >
        {source.label} {snapshot.wantsAudio ? 'On' : 'Off'}
      </button>
      {snapshot.message ? (
        <p className="audio-problem" role="status">
          {snapshot.message}
        </p>
      ) : null}
    </>
  )
}

export function LofiAudioControls() {
  const [trackId, setTrackId] = useState(DEFAULT_LOFI_ID)
  const source = LOFI_TRACKS.find((track) => track.id === trackId) ?? LOFI_TRACKS[0]
  const [snapshot, channel] = useChannel(source)

  function toggle() {
    if (channel.wantsAudio) {
      channel.pause()
      return
    }
    void activateExclusive(source, LOFI_TRACKS)
  }

  function chooseTrack(nextId: string) {
    const next = LOFI_TRACKS.find((track) => track.id === nextId)
    if (!next || next.id === source.id) return
    const playing = channel.wantsAudio
    setTrackId(next.id)
    if (playing) void activateExclusive(next, LOFI_TRACKS)
  }

  return (
    <div
      className="audio-controls audio-lofi"
      role="group"
      aria-label="Lo-fi music"
      onPointerDown={stopSceneGesture}
    >
      <button
        type="button"
        className="audio-button"
        aria-pressed={snapshot.wantsAudio}
        title={snapshot.message ?? undefined}
        onClick={toggle}
      >
        Lo-fi {snapshot.wantsAudio ? 'Pause' : 'Play'}
      </button>
      {import.meta.env.DEV ? (
        <label className="audio-track">
          <span className="visually-hidden">Lo-fi track</span>
          <select value={source.id} onChange={(event) => chooseTrack(event.target.value)}>
            {LOFI_TRACKS.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {snapshot.message ? (
        <p className="audio-problem" role="status">
          {snapshot.message}
        </p>
      ) : null}
    </div>
  )
}
