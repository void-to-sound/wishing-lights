import breathInUrl from '../assets/audio/breath-in.wav'
import breathOutUrl from '../assets/audio/breath-out.wav'
import sighUrl from '../assets/audio/sigh.wav'
import sniffUrl from '../assets/audio/sniff.wav'
import snoreUrl from '../assets/audio/snore.wav'
import stepUrl from '../assets/audio/step.wav'

export type ClipName = 'breathIn' | 'breathOut' | 'snore' | 'sigh' | 'sniff' | 'step'

const SOURCES: Record<ClipName, string> = {
  breathIn: breathInUrl,
  breathOut: breathOutUrl,
  snore: snoreUrl,
  sigh: sighUrl,
  sniff: sniffUrl,
  step: stepUrl,
}

export class RoomAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<ClipName, AudioBuffer>()
  private loading: Promise<void> | null = null
  enabled = false

  async enable(): Promise<void> {
    if (!this.loading) this.loading = this.load()
    await this.loading
    if (!this.context || !this.master) return
    if (this.context.state === 'suspended') await this.context.resume()
    this.enabled = true
    this.master.gain.value = 0.42
  }

  mute(): void {
    this.enabled = false
    if (this.master) this.master.gain.value = 0
  }

  play(name: ClipName, volume: number): void {
    if (!this.enabled || !this.context || !this.master) return
    const buffer = this.buffers.get(name)
    if (!buffer) return
    const source = this.context.createBufferSource()
    source.buffer = buffer
    const gain = this.context.createGain()
    gain.gain.value = volume
    source.connect(gain).connect(this.master)
    source.start()
  }

  private async load(): Promise<void> {
    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = 0
    master.connect(context.destination)
    this.context = context
    this.master = master
    await Promise.all(
      (Object.keys(SOURCES) as ClipName[]).map(async (name) => {
        const response = await fetch(SOURCES[name])
        const encoded = await response.arrayBuffer()
        const buffer = await context.decodeAudioData(encoded)
        this.buffers.set(name, buffer)
      }),
    )
  }
}
