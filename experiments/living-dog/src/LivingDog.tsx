import { useEffect, useRef, useState, type PointerEvent } from 'react'
import room from '../assets/room.jpg'
import { RoomAudio, type ClipName } from './audio.ts'
import { STATE_CAPTION, type DogState, type Pose } from './behavior.ts'
import { Dog } from './Dog.tsx'
import { useDogLife } from './useDogLife.ts'

const STATE_BUTTONS: { state: DogState; label: string }[] = [
  { state: 'sleeping', label: 'Sleep' },
  { state: 'waking_up', label: 'Wake' },
  { state: 'curious', label: 'Look' },
  { state: 'sniffing', label: 'Sniff' },
  { state: 'returning_to_sleep', label: 'Settle' },
]

const CUE_VOLUME: Record<'sigh' | 'sniff', { clip: ClipName; volume: number }> = {
  sigh: { clip: 'sigh', volume: 0.28 },
  sniff: { clip: 'sniff', volume: 0.24 },
}

export function LivingDog() {
  const { frame, glance, dream, twitchId, snoreId, pokeNote, poke, force, pulseSnore } = useDogLife()
  const audio = useRef(new RoomAudio())
  const dogRef = useRef<HTMLButtonElement>(null)
  const [soundOn, setSoundOn] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [step, setStep] = useState(false)
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [canHover] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
  )
  const lastPointer = useRef<{ x: number; y: number; at: number } | null>(null)

  const displayPose: Pose = frame.walk
    ? reduceMotion
      ? 'walkA'
      : step
        ? 'walkB'
        : 'walkA'
    : glance
      ? 'turn'
      : dream
        ? 'yawn'
        : frame.pose

  useEffect(() => {
    if (!frame.walk || reduceMotion) return
    const id = window.setInterval(() => setStep((value) => !value), 460)
    return () => window.clearInterval(id)
  }, [frame.serial, frame.walk, reduceMotion])

  useEffect(() => {
    const cue = frame.sound
    if (!cue || !soundOn) return
    const spec = CUE_VOLUME[cue]
    audio.current.play(spec.clip, spec.volume)
  }, [frame.serial, frame.sound, soundOn])

  useEffect(() => {
    if (!frame.walk || !soundOn) return
    let count = 0
    const id = window.setInterval(() => {
      count += 1
      if (count % 2 === 0) audio.current.play('step', 0.14)
    }, 460)
    return () => window.clearInterval(id)
  }, [frame.serial, frame.walk, soundOn])

  useEffect(() => {
    if (!soundOn || frame.state !== 'sleeping') return
    let dead = false
    let timer = 0
    const arm = (delay: number) => {
      timer = window.setTimeout(() => {
        if (dead) return
        const roll = Math.random()
        if (roll < 0.07) {
          audio.current.play('snore', 0.32)
          pulseSnore()
          arm(4000 + Math.random() * 3000)
        } else if (roll < 0.58) {
          audio.current.play(roll < 0.32 ? 'breathIn' : 'breathOut', 0.16)
          arm(7000 + Math.random() * 5000)
        } else {
          arm(5000 + Math.random() * 4000)
        }
      }, delay)
    }
    arm(1200 + Math.random() * 1600)
    return () => {
      dead = true
      window.clearTimeout(timer)
    }
  }, [soundOn, frame.serial, frame.state, pulseSnore])

  async function toggleSound() {
    if (soundOn) {
      audio.current.mute()
      setSoundOn(false)
      return
    }
    await audio.current.enable()
    setSoundOn(true)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!canHover) return
    const dog = dogRef.current
    if (!dog) return
    const now = performance.now()
    const previous = lastPointer.current
    lastPointer.current = { x: event.clientX, y: event.clientY, at: now }
    if (!previous || now - previous.at < 900) return
    const moved = Math.hypot(event.clientX - previous.x, event.clientY - previous.y)
    if (moved < 12) return
    const rect = dog.getBoundingClientRect()
    const near =
      event.clientX > rect.left - 90 &&
      event.clientX < rect.right + 90 &&
      event.clientY > rect.top - 70 &&
      event.clientY < rect.bottom + 50
    if (near) poke('hover')
  }

  return (
    <div className="app">
      <div
        className="stage"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('.hit')) return
          poke('room')
        }}
        onPointerMove={onPointerMove}
      >
        <img className="room" src={room} alt="A quiet winter living room with a wool rug and a lit fireplace." />
        <Dog
          frame={frame}
          pose={displayPose}
          breath={frame.breath && !frame.walk}
          twitchId={twitchId}
          snoreId={snoreId}
          onActivate={() => poke('click')}
          dogRef={dogRef}
        />
        <div className="fire" />
        <div className="warmth" />
        <div className="vignette" />
      </div>

      <button type="button" className="sound" aria-pressed={soundOn} onClick={() => void toggleSound()}>
        {soundOn ? 'Sound on' : 'Sound off'}
      </button>

      <aside className="debug">
        <button type="button" className="debug-toggle" onClick={() => setPanelOpen((open) => !open)}>
          {panelOpen ? 'Hide' : 'Behaviors'}
        </button>
        {panelOpen ? (
          <div className="debug-panel">
            <p className="debug-state">
              {labelFor(frame.state)}
              <span>{pokeNote}</span>
            </p>
            <div className="debug-actions">
              {STATE_BUTTONS.map((item) => (
                <button key={item.state} type="button" onClick={() => force(item.state)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <p className="sr-only" aria-live="polite">
        {STATE_CAPTION[frame.state]}
      </p>
    </div>
  )
}

function labelFor(state: DogState): string {
  switch (state) {
    case 'sleeping':
      return 'Sleeping'
    case 'waking_up':
      return 'Waking up'
    case 'curious':
      return 'Looking'
    case 'sniffing':
      return 'Sniffing'
    case 'returning_to_sleep':
      return 'Settling'
  }
}
