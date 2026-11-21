export type DogState =
  | 'sleeping'
  | 'waking_up'
  | 'curious'
  | 'sniffing'
  | 'returning_to_sleep'

export type Pose =
  | 'sleep'
  | 'yawn'
  | 'wake'
  | 'curious'
  | 'rest'
  | 'turn'
  | 'stand'
  | 'sniff'
  | 'walkA'
  | 'walkB'

export type SoundCue = 'sigh' | 'sniff'

/**
 * Native facing of each pose, before CSS mirroring:
 * sleep, yawn, stand face left.
 * sniff, walkA, walkB face right.
 * wake, curious, rest, turn face the camera.
 * flip -1 mirrors the image.
 */
export interface Beat {
  state: DogState
  pose: Pose
  x: number
  xTo?: number
  flip: 1 | -1
  ms: number
  breath: boolean
  walk: boolean
  sound?: SoundCue
}

export interface Frame extends Beat {
  serial: number
}

export const BED_X = 37
export const FAR_X = 53

export const STATE_CAPTION: Record<DogState, string> = {
  sleeping: 'The dog is asleep on the rug.',
  waking_up: 'The dog is waking up.',
  curious: 'The dog is looking around.',
  sniffing: 'The dog is sniffing the rug.',
  returning_to_sleep: 'The dog is settling back down to sleep.',
}

const SPHINX = new Set<Pose>(['wake', 'curious', 'rest'])

export function fadeBetween(from: Pose, to: Pose): number {
  const walking = (pose: Pose) => pose === 'walkA' || pose === 'walkB'
  if (walking(from) && walking(to)) return 70
  if ((from === 'sleep' && to === 'yawn') || (from === 'yawn' && to === 'sleep')) return 460
  if (SPHINX.has(from) && SPHINX.has(to)) return 380
  // Dissimilar silhouettes ghost if they linger, so the change is a short cut.
  return 140
}

export function placement(x: number): { bottom: number; depth: number } {
  const span = FAR_X - BED_X
  const t = Math.min(1, Math.max(0, (x - BED_X) / span))
  return {
    bottom: 16 + t * 11,
    depth: 1 - t * 0.15,
  }
}

function sleepDuration(rng: () => number): number {
  // About 36–100s, biased toward the long end. This is what keeps the dog asleep most of the time.
  return 36000 + Math.pow(rng(), 0.75) * 64000
}

function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

function atBed(
  state: DogState,
  pose: Pose,
  ms: number,
  extra: Partial<Pick<Beat, 'breath' | 'sound' | 'flip'>> = {},
): Beat {
  return {
    state,
    pose,
    x: BED_X,
    flip: extra.flip ?? 1,
    ms,
    breath: extra.breath ?? false,
    walk: false,
    sound: extra.sound,
  }
}

function walk(state: DogState, from: number, to: number, ms: number, flip: 1 | -1): Beat {
  return {
    state,
    pose: 'walkA',
    x: from,
    xTo: to,
    flip,
    ms,
    breath: false,
    walk: true,
  }
}

function spotX(rng: () => number, minT: number, maxT: number): number {
  const t = between(rng, minT, maxT)
  return BED_X + t * (FAR_X - BED_X)
}

export function buildBeats(state: DogState, rng: () => number, fromX: number): Beat[] {
  switch (state) {
    case 'sleeping':
      return [atBed('sleeping', 'sleep', sleepDuration(rng), { breath: true })]
    case 'waking_up':
      return wakingBeats(rng)
    case 'curious':
      return curiousBeats(rng)
    case 'sniffing':
      return sniffingBeats(rng, fromX)
    case 'returning_to_sleep':
      return returningBeats(rng, fromX)
  }
}

function wakingBeats(rng: () => number): Beat[] {
  const beats: Beat[] = []
  if (rng() < 0.6) {
    beats.push(atBed('waking_up', 'yawn', between(rng, 1200, 1800), { breath: true, sound: 'sigh' }))
  }
  beats.push(atBed('waking_up', 'rest', between(rng, 1400, 2200), { breath: true }))
  beats.push(atBed('waking_up', 'wake', between(rng, 900, 1500)))
  return beats
}

function curiousBeats(rng: () => number): Beat[] {
  const looks = 1 + Math.floor(rng() * 2)
  const beats: Beat[] = []
  for (let index = 0; index < looks; index += 1) {
    const roll = rng()
    const pose: Pose = roll < 0.45 ? 'curious' : roll < 0.75 ? 'wake' : 'rest'
    beats.push(atBed('curious', pose, between(rng, 1200, 2400)))
  }
  if (rng() < 0.55) {
    beats.push(atBed('curious', 'turn', between(rng, 1200, 2000)))
  }
  return beats
}

function sniffingBeats(rng: () => number, fromX: number): Beat[] {
  const start = Math.abs(fromX - BED_X) < 1.5 ? BED_X : fromX
  const first = spotX(rng, 0.38, 0.72)
  const beats: Beat[] = [
    {
      state: 'sniffing',
      pose: 'turn',
      x: start,
      flip: 1,
      ms: between(rng, 600, 1000),
      breath: false,
      walk: false,
    },
    {
      state: 'sniffing',
      pose: 'stand',
      x: start,
      flip: -1,
      ms: between(rng, 500, 900),
      breath: false,
      walk: false,
    },
    walk('sniffing', start, first, between(rng, 1800, 2800) + Math.abs(first - start) * 70, 1),
    {
      state: 'sniffing',
      pose: 'sniff',
      x: first,
      flip: 1,
      ms: between(rng, 2600, 4800),
      breath: false,
      walk: false,
      sound: 'sniff',
    },
  ]
  if (rng() < 0.72) {
    const second = Math.min(FAR_X, first + between(rng, 3.5, 8))
    beats.push(walk('sniffing', first, second, between(rng, 1400, 2400), 1))
    beats.push({
      state: 'sniffing',
      pose: 'sniff',
      x: second,
      flip: 1,
      ms: between(rng, 2200, 4200),
      breath: false,
      walk: false,
      sound: 'sniff',
    })
  }
  return beats
}

function returningBeats(rng: () => number, fromX: number): Beat[] {
  const away = Math.abs(fromX - BED_X) > 1.5
  if (!away) {
    const beats: Beat[] = [atBed('returning_to_sleep', 'rest', between(rng, 1400, 2400), { breath: true })]
    if (rng() < 0.4) {
      beats.push(atBed('returning_to_sleep', 'yawn', between(rng, 1200, 1800), { breath: true, sound: 'sigh' }))
    }
    beats.push(atBed('returning_to_sleep', 'sleep', 900, { breath: true }))
    return beats
  }
  const beats: Beat[] = [
    {
      state: 'returning_to_sleep',
      pose: 'turn',
      x: fromX,
      flip: 1,
      ms: between(rng, 700, 1200),
      breath: false,
      walk: false,
    },
    walk(
      'returning_to_sleep',
      fromX,
      BED_X,
      between(rng, 2000, 3000) + Math.abs(fromX - BED_X) * 80,
      -1,
    ),
    atBed('returning_to_sleep', 'stand', between(rng, 500, 900), { flip: 1 }),
    atBed('returning_to_sleep', 'rest', between(rng, 1100, 1800), { breath: true }),
  ]
  if (rng() < 0.35) {
    beats.push(atBed('returning_to_sleep', 'yawn', 1300, { breath: true, sound: 'sigh' }))
  }
  beats.push(atBed('returning_to_sleep', 'sleep', 800, { breath: true }))
  return beats
}

export function reactionBeats(rng: () => number): Beat[] {
  const beats: Beat[] = [
    atBed('waking_up', 'rest', between(rng, 1600, 2600), {
      breath: true,
      sound: rng() < 0.55 ? 'sigh' : undefined,
    }),
  ]
  if (rng() < 0.3) {
    beats.push(atBed('waking_up', 'yawn', 1400, { breath: true }))
  }
  beats.push(atBed('sleeping', 'sleep', sleepDuration(rng), { breath: true }))
  return beats
}

/** What follows a finished run of beats. Curious sometimes bothers to get up. */
export function nextState(state: DogState, rng: () => number): DogState {
  switch (state) {
    case 'sleeping':
      return 'waking_up'
    case 'waking_up':
      return 'curious'
    case 'curious':
      return rng() < 0.72 ? 'sniffing' : 'returning_to_sleep'
    case 'sniffing':
      return 'returning_to_sleep'
    case 'returning_to_sleep':
      return 'sleeping'
  }
}

const GROUPS: Record<DogState, 'rest' | 'observe' | 'sniff'> = {
  sleeping: 'rest',
  returning_to_sleep: 'rest',
  waking_up: 'observe',
  curious: 'observe',
  sniffing: 'sniff',
}

/** Rough share of time, used while tuning durations. Not called at runtime. */
export function sampleTimeShares(cycles: number, rng: () => number = Math.random): Record<string, number> {
  const totals = { rest: 0, observe: 0, sniff: 0 }
  let x = BED_X
  let state: DogState = 'sleeping'
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const beats = buildBeats(state, rng, x)
    for (const beat of beats) {
      totals[GROUPS[beat.state]] += beat.ms
      x = beat.xTo ?? beat.x
    }
    state = nextState(beats[beats.length - 1].state, rng)
  }
  const sum = totals.rest + totals.observe + totals.sniff
  return {
    rest: totals.rest / sum,
    observe: totals.observe / sum,
    sniff: totals.sniff / sum,
  }
}
