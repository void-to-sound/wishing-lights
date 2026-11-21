import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BED_X,
  type Beat,
  type DogState,
  type Frame,
  buildBeats,
  nextState,
  reactionBeats,
} from './behavior.ts'

export type PokeKind = 'click' | 'hover' | 'room'
export type PokeResult = 'ignored' | 'twitch' | 'noticed' | 'glance'

function finalX(beat: Beat): number {
  return beat.xTo ?? beat.x
}

export function useDogLife() {
  const [frame, setFrame] = useState<Frame>({
    state: 'sleeping',
    pose: 'sleep',
    x: BED_X,
    flip: 1,
    ms: 60000,
    breath: true,
    walk: false,
    serial: 0,
  })
  const [glance, setGlance] = useState(false)
  const [dream, setDream] = useState(false)
  const [twitchId, setTwitchId] = useState(0)
  const [snoreId, setSnoreId] = useState(0)
  const [pokeNote, setPokeNote] = useState('Asleep')

  const gen = useRef(0)
  const timers = useRef<number[]>([])
  const xRef = useRef(BED_X)
  const stateRef = useRef<DogState>('sleeping')
  const sleepStarted = useRef<number | null>(null)
  const cooldown = useRef(0)
  const twitchAt = useRef(0)
  const serialRef = useRef(0)
  const walkingRef = useRef(false)
  const runRef = useRef<(state: DogState) => void>(() => {})

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
  }

  const play = useCallback((beats: Beat[], done: () => void) => {
    const token = ++gen.current
    clearTimers()
    let index = 0
    const step = () => {
      if (token !== gen.current) return
      if (index >= beats.length) {
        done()
        return
      }
      const beat = beats[index]
      index += 1
      serialRef.current += 1
      stateRef.current = beat.state
      xRef.current = finalX(beat)
      walkingRef.current = beat.walk
      if (beat.state === 'sleeping' && beat.pose === 'sleep') {
        sleepStarted.current = Date.now()
      }
      setGlance(false)
      setDream(false)
      setFrame({ ...beat, serial: serialRef.current })
      const id = window.setTimeout(step, beat.ms)
      timers.current.push(id)
    }
    step()
  }, [])

  const run = useCallback(
    (state: DogState) => {
      const beats = buildBeats(state, Math.random, xRef.current)
      const last = beats[beats.length - 1].state
      play(beats, () => runRef.current(nextState(last, Math.random)))
    },
    [play],
  )

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => {
    run('sleeping')
    return () => {
      gen.current += 1
      clearTimers()
    }
  }, [run])

  useEffect(() => {
    if (frame.state !== 'sleeping' || frame.pose !== 'sleep') return
    let dead = false
    let timer = 0
    const arm = () => {
      timer = window.setTimeout(() => {
        if (dead) return
        const roll = Math.random()
        if (roll < 0.55) setTwitchId((value) => value + 1)
        else if (roll < 0.82) {
          setDream(true)
          window.setTimeout(() => {
            if (!dead) setDream(false)
          }, 1500)
        }
        arm()
      }, 14000 + Math.random() * 18000)
    }
    arm()
    return () => {
      dead = true
      window.clearTimeout(timer)
    }
  }, [frame.serial, frame.state, frame.pose])

  const note = (text: string) => {
    setPokeNote(text)
  }

  const poke = useCallback(
    (kind: PokeKind): PokeResult => {
      const now = Date.now()
      if (now < cooldown.current) {
        note('Ignored')
        return 'ignored'
      }
      const state = stateRef.current
      const roll = Math.random()

      if (kind !== 'click') {
        const chance = kind === 'hover' ? 0.22 : 0.16
        if (roll > chance) {
          note('Ignored')
          return 'ignored'
        }
        if (state === 'sleeping') {
          const started = sleepStarted.current
          if (started === null || now - started < 14000) {
            note('Ignored')
            return 'ignored'
          }
          cooldown.current = now + 9000
          const beats = reactionBeats(Math.random)
          const last = beats[beats.length - 1].state
          play(beats, () => runRef.current(nextState(last, Math.random)))
          note('Noticed')
          return 'noticed'
        }
        if (state === 'curious' || state === 'sniffing' || state === 'waking_up') {
          if (walkingRef.current) {
            note('Ignored')
            return 'ignored'
          }
          cooldown.current = now + 7000
          setGlance(true)
          window.setTimeout(() => setGlance(false), 1500)
          note('Glanced')
          return 'glance'
        }
        note('Ignored')
        return 'ignored'
      }

      if (roll > 0.5) {
        note('Ignored')
        return 'ignored'
      }
      if (state === 'sleeping') {
        const started = sleepStarted.current
        const slept = started === null ? 0 : now - started
        if (slept < 8000 || roll < 0.22) {
          if (now - twitchAt.current < 1400) {
            note('Ignored')
            return 'ignored'
          }
          twitchAt.current = now
          setTwitchId((value) => value + 1)
          note('Ear twitch')
          return 'twitch'
        }
        cooldown.current = now + 8000
        const beats = reactionBeats(Math.random)
        const last = beats[beats.length - 1].state
        play(beats, () => runRef.current(nextState(last, Math.random)))
        note('Noticed')
        return 'noticed'
      }
      if (state === 'returning_to_sleep' || walkingRef.current) {
        note('Ignored')
        return 'ignored'
      }
      cooldown.current = now + 6000
      setGlance(true)
      window.setTimeout(() => setGlance(false), 1400)
      note('Glanced')
      return 'glance'
    },
    [play],
  )

  const force = useCallback(
    (state: DogState) => {
      note(state === 'sleeping' ? 'Asleep' : 'Directed')
      runRef.current(state)
    },
    [],
  )

  const pulseSnore = useCallback(() => {
    setSnoreId((value) => value + 1)
  }, [])

  return {
    frame,
    glance,
    dream,
    twitchId,
    snoreId,
    pokeNote,
    poke,
    force,
    pulseSnore,
  }
}
