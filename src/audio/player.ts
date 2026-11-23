import { FADE_MS, type AudioSource } from './config.ts'

export type PlayResult = 'started' | 'cancelled' | 'failed'

export interface ChannelSnapshot {
  wantsAudio: boolean
  message: string | null
}

interface Playable {
  src: string
  loop: boolean
  volume: number
  paused: boolean
  preload: string
  play(): Promise<void>
  pause(): void
  load(): void
  removeAttribute(qualifiedName: string): void
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

interface AudioClock {
  now(): number
  request(callback: (now: number) => void): number
  cancel(handle: number): void
}

const browserClock: AudioClock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

function browserAudio(): Playable {
  return new Audio()
}

/**
 * One looping file, one HTMLAudioElement.
 * A second play or pause reuses that element instead of stacking sounds.
 */
export class AudioChannel {
  readonly id: string
  private readonly source: AudioSource
  private readonly clock: AudioClock
  private readonly audio: Playable
  private readonly onError: () => void
  private readonly listeners = new Set<() => void>()
  private intent: 'playing' | 'paused' = 'paused'
  private requestId = 0
  private fadeToken = 0
  private frame = 0
  private message: string | null = null
  private disposed = false

  constructor(
    source: AudioSource,
    clock: AudioClock = browserClock,
    create: () => Playable = browserAudio,
  ) {
    this.id = source.id
    this.source = source
    this.clock = clock
    this.audio = create()
    this.audio.preload = 'none'
    this.audio.loop = source.loop
    this.audio.volume = 0
    this.onError = () => {
      this.fail('This sound could not be played.')
    }
    this.audio.addEventListener('error', this.onError)
    this.audio.src = source.src
  }

  get wantsAudio(): boolean {
    return this.intent === 'playing'
  }

  get closed(): boolean {
    return this.disposed
  }

  snapshot(): ChannelSnapshot {
    return { wantsAudio: this.wantsAudio, message: this.message }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  play(): Promise<PlayResult> {
    if (this.disposed) return Promise.resolve('failed')
    const requestId = ++this.requestId
    this.intent = 'playing'
    this.message = null
    this.emit()

    const starting = this.audio.paused
    if (starting) this.audio.volume = 0

    const started = starting ? this.audio.play() : Promise.resolve()
    return started.then(
      () => {
        if (this.disposed || requestId !== this.requestId || this.intent !== 'playing') {
          if (!this.audio.paused && this.intent !== 'playing') {
            this.audio.pause()
            this.audio.volume = 0
          }
          return 'cancelled'
        }
        this.fadeTo(this.source.volume)
        return 'started'
      },
      (error: unknown) => {
        if (requestId !== this.requestId) return 'cancelled'
        const blocked = error instanceof DOMException && error.name === 'NotAllowedError'
        this.fail(blocked ? 'Playback was blocked. Try again.' : 'This sound could not be played.')
        return 'failed'
      },
    )
  }

  /** Fade out, then pause. Pass false to stop immediately while switching tracks. */
  pause(fade = true): void {
    if (this.disposed) return
    this.requestId += 1
    this.intent = 'paused'
    this.message = null
    if (!fade || this.audio.paused) {
      this.fadeToken += 1
      this.clock.cancel(this.frame)
      this.audio.pause()
      this.audio.volume = 0
      this.emit()
      return
    }
    this.emit()
    this.fadeTo(0, () => {
      if (this.intent !== 'paused' || this.disposed) return
      this.audio.pause()
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.intent = 'paused'
    this.requestId += 1
    this.fadeToken += 1
    this.clock.cancel(this.frame)
    this.audio.pause()
    this.audio.removeEventListener('error', this.onError)
    this.audio.removeAttribute('src')
    this.audio.load()
    this.listeners.clear()
  }

  private fadeTo(target: number, done?: () => void): void {
    const token = ++this.fadeToken
    const from = this.audio.volume
    const clampedTarget = clamp01(target)
    if (Math.abs(from - clampedTarget) < 0.001) {
      this.audio.volume = clampedTarget
      done?.()
      return
    }
    const start = this.clock.now()
    const step = (now: number) => {
      if (token !== this.fadeToken || this.disposed) return
      const t = FADE_MS <= 0 ? 1 : Math.min(1, Math.max(0, now - start) / FADE_MS)
      const eased = t * t * (3 - 2 * t)
      this.audio.volume = clamp01(from + (clampedTarget - from) * eased)
      if (t < 1) {
        this.frame = this.clock.request(step)
        return
      }
      this.audio.volume = clampedTarget
      done?.()
    }
    this.clock.cancel(this.frame)
    this.frame = this.clock.request(step)
  }

  private fail(message: string): void {
    if (this.disposed) return
    this.requestId += 1
    this.intent = 'paused'
    this.fadeToken += 1
    this.clock.cancel(this.frame)
    this.audio.pause()
    this.audio.volume = 0
    this.message = message
    this.emit()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

const channels = new Map<string, AudioChannel>()

export function getChannel(source: AudioSource): AudioChannel {
  const existing = channels.get(source.id)
  if (existing && !existing.closed) return existing
  const created = new AudioChannel(source)
  channels.set(source.id, created)
  return created
}

/** Stops every other source in the group, then plays this one. */
export function activateExclusive(
  source: AudioSource,
  group: readonly AudioSource[],
): Promise<PlayResult> {
  for (const other of group) {
    if (other.id === source.id) continue
    const channel = channels.get(other.id)
    if (channel && !channel.closed && channel.wantsAudio) channel.pause(false)
  }
  return getChannel(source).play()
}

export function releaseAllChannels(): void {
  for (const channel of channels.values()) channel.dispose()
  channels.clear()
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    releaseAllChannels()
  })
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    releaseAllChannels()
  })
}
