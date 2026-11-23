import { afterEach, describe, expect, it, vi } from 'vitest'
import { FADE_MS, type AudioSource } from './config.ts'
import { activateExclusive, AudioChannel, getChannel, releaseAllChannels, type PlayResult } from './player.ts'

class ManualClock {
  time = 0
  private nextId = 0
  private frames = new Map<number, (now: number) => void>()

  now(): number {
    return this.time
  }

  request(callback: (now: number) => void): number {
    this.nextId += 1
    this.frames.set(this.nextId, callback)
    return this.nextId
  }

  cancel(handle: number): void {
    this.frames.delete(handle)
  }

  advance(ms: number): void {
    const end = this.time + ms
    let guard = 0
    while (this.frames.size > 0 && this.time < end && guard < 200) {
      guard += 1
      this.time += Math.min(16, end - this.time)
      const batch = [...this.frames.values()]
      this.frames.clear()
      for (const callback of batch) callback(this.time)
    }
    this.time = end
  }
}

class FakeAudio {
  src = ''
  loop = false
  paused = true
  preload = ''
  playCalls = 0
  pauseCalls = 0
  loadCalls = 0
  failPlay = false
  removedSrc = false
  private volumeValue = 1
  readonly volumes: number[] = []
  private errorListener: (() => void) | null = null

  get volume(): number {
    return this.volumeValue
  }

  set volume(value: number) {
    this.volumeValue = value
    this.volumes.push(value)
  }

  play(): Promise<void> {
    this.playCalls += 1
    if (this.failPlay) {
      this.paused = true
      return Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    }
    this.paused = false
    return Promise.resolve()
  }

  pause(): void {
    this.pauseCalls += 1
    this.paused = true
  }

  load(): void {
    this.loadCalls += 1
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.removedSrc = true
  }

  addEventListener(_type: string, listener: () => void): void {
    this.errorListener = listener
  }

  removeEventListener(): void {
    this.errorListener = null
  }

  emitError(): void {
    this.errorListener?.()
  }
}

function source(id: string, volume = 0.8): AudioSource {
  return { id, label: id, src: `/audio/${id}.wav`, loop: true, volume, visible: true }
}

function channelFor(clock: ManualClock, audio = new FakeAudio(), item = source('asmr-1')) {
  return { audio, channel: new AudioChannel(item, clock, () => audio) }
}

afterEach(() => {
  releaseAllChannels()
  vi.unstubAllGlobals()
})

describe('AudioChannel', () => {
  it('does not play when the channel is created', () => {
    const clock = new ManualClock()
    const { audio, channel } = channelFor(clock)
    expect(audio.playCalls).toBe(0)
    expect(audio.paused).toBe(true)
    expect(audio.loop).toBe(true)
    expect(audio.volume).toBe(0)
    expect(channel.wantsAudio).toBe(false)
  })

  it('fades in to the configured volume and fades out before pausing', async () => {
    const clock = new ManualClock()
    const { audio, channel } = channelFor(clock)
    await channel.play()
    expect(audio.paused).toBe(false)
    expect(audio.volume).toBe(0)

    clock.advance(FADE_MS / 2)
    expect(audio.volume).toBeGreaterThan(0.3 * 0.8)
    expect(audio.volume).toBeLessThan(0.7 * 0.8)

    clock.advance(FADE_MS)
    expect(audio.volume).toBeCloseTo(0.8, 2)
    expect(audio.volumes.every((value) => value >= 0 && value <= 1)).toBe(true)

    const rising = audio.volumes.filter((_value, index, all) => index === 0 || all[index - 1] !== _value)
    const fadeIn = rising.slice(rising.lastIndexOf(0))
    for (let index = 1; index < fadeIn.length; index += 1) {
      expect(fadeIn[index]).toBeGreaterThanOrEqual(fadeIn[index - 1] ?? 0)
    }

    channel.pause()
    const peak = audio.volume
    clock.advance(FADE_MS / 2)
    expect(audio.paused).toBe(false)
    expect(audio.volume).toBeLessThan(peak)
    expect(audio.volume).toBeGreaterThan(0)
    clock.advance(FADE_MS)
    expect(audio.paused).toBe(true)
    expect(audio.volume).toBe(0)
  })

  it('reverses a fade-out without dropping the volume to zero', async () => {
    const clock = new ManualClock()
    const { audio, channel } = channelFor(clock)
    await channel.play()
    clock.advance(FADE_MS)
    channel.pause()
    clock.advance(FADE_MS / 2)
    const mid = audio.volume
    const pausesBeforeResume = audio.pauseCalls
    await channel.play()
    expect(audio.volume).toBeCloseTo(mid, 2)
    expect(audio.paused).toBe(false)
    clock.advance(FADE_MS)
    expect(audio.volume).toBeCloseTo(0.8, 2)
    expect(audio.paused).toBe(false)
    expect(audio.pauseCalls).toBe(pausesBeforeResume)
  })

  it('keeps one element through rapid play and pause', async () => {
    const clock = new ManualClock()
    const audio = new FakeAudio()
    let created = 0
    const channel = new AudioChannel(source('asmr-1'), clock, () => {
      created += 1
      return audio
    })
    const first = channel.play()
    channel.pause()
    const second = channel.play()
    channel.pause()
    const third = channel.play()
    const results = await Promise.all([first, second, third])
    expect(created).toBe(1)
    expect(audio.playCalls).toBeGreaterThan(0)
    expect(results.every((result: PlayResult) => result !== 'failed')).toBe(true)
    expect(channel.wantsAudio).toBe(true)
    clock.advance(FADE_MS)
    expect(audio.paused).toBe(false)
    expect(audio.volume).toBeCloseTo(0.8, 2)
  })

  it('stays paused when the browser blocks playback', async () => {
    const clock = new ManualClock()
    const audio = new FakeAudio()
    audio.failPlay = true
    const channel = new AudioChannel(source('asmr-1'), clock, () => audio)
    const heard: ChannelSnapshot[] = []
    channel.subscribe(() => heard.push(channel.snapshot()))
    const result = await channel.play()
    expect(result).toBe('failed')
    expect(channel.wantsAudio).toBe(false)
    expect(audio.paused).toBe(true)
    expect(audio.volume).toBe(0)
    expect(channel.snapshot().message).toMatch(/blocked/i)
    expect(heard.at(-1)?.wantsAudio).toBe(false)
  })

  it('stops playback when the file errors', async () => {
    const clock = new ManualClock()
    const audio = new FakeAudio()
    const channel = new AudioChannel(source('asmr-1'), clock, () => audio)
    await channel.play()
    audio.emitError()
    expect(channel.wantsAudio).toBe(false)
    expect(audio.paused).toBe(true)
    expect(channel.snapshot().message).toMatch(/could not be played/i)
  })
})

describe('channel registry', () => {
  function stubBrowserAudio(create: () => FakeAudio) {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal(
      'Audio',
      class {
        constructor() {
          return create()
        }
      },
    )
  }

  it('reuses one channel per source id', () => {
    const made: FakeAudio[] = []
    stubBrowserAudio(() => {
      const audio = new FakeAudio()
      made.push(audio)
      return audio
    })
    const item = source('asmr-2')
    const first = getChannel(item)
    const second = getChannel(item)
    expect(first).toBe(second)
    expect(made).toHaveLength(1)
    first.dispose()
    const third = getChannel(item)
    expect(third).not.toBe(first)
    expect(made).toHaveLength(2)
  })

  it('plays ASMR sources together and keeps a single lo-fi track', async () => {
    stubBrowserAudio(() => new FakeAudio())
    const asmrA = source('asmr-1')
    const asmrB = source('asmr-2')
    const lofiA = source('lofi-1', 0.6)
    const lofiB = source('lofi-2', 0.6)
    await getChannel(asmrA).play()
    await getChannel(asmrB).play()
    expect(getChannel(asmrA).wantsAudio).toBe(true)
    expect(getChannel(asmrB).wantsAudio).toBe(true)

    await activateExclusive(lofiA, [lofiA, lofiB])
    expect(getChannel(lofiA).wantsAudio).toBe(true)
    expect(getChannel(asmrA).wantsAudio).toBe(true)
    expect(getChannel(asmrB).wantsAudio).toBe(true)

    await activateExclusive(lofiB, [lofiA, lofiB])
    expect(getChannel(lofiA).wantsAudio).toBe(false)
    expect(getChannel(lofiB).wantsAudio).toBe(true)
    expect(getChannel(asmrA).wantsAudio).toBe(true)
  })
})
