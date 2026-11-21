import * as Tone from 'tone'

let synth = null
let ready = false

export async function ensureAudio() {
  await Tone.start()
  if (ready) return

  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      partials: [1, 0.16, 0.05, 0.014],
    },
    envelope: {
      attack: 0.07,
      attackCurve: 'sine',
      decay: 1.15,
      decayCurve: 'exponential',
      sustain: 0.05,
      release: 1.65,
      releaseCurve: 'exponential',
    },
  })
  synth.maxPolyphony = 12
  synth.volume.value = -12

  const filter = new Tone.Filter({
    type: 'lowpass',
    frequency: 2200,
    rolloff: -12,
    Q: 0.35,
  })
  const reverb = new Tone.Reverb({
    decay: 1.65,
    preDelay: 0.012,
    wet: 0.22,
  })
  const limiter = new Tone.Limiter(-3)

  synth.connect(filter)
  filter.connect(reverb)
  reverb.connect(limiter)
  limiter.toDestination()

  await reverb.ready
  ready = true
}

export function playNote(note) {
  if (!ready || !synth) return
  synth.triggerAttackRelease(note, 1.05, Tone.now() + 0.01)
}

export function releaseAll() {
  if (!ready || !synth) return
  synth.releaseAll()
}
