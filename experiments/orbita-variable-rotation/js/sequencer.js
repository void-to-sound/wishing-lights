// The disc angle grows clockwise, in radians. Zero puts C4 on the sensor.
// A marker sounds when its angle crosses a multiple of one full turn.
// Each speed step lasts a quarter turn of that angle, then the pattern repeats.

export const NOTES = ['C4', 'E4', 'G4', 'B4', 'D5', 'A4']

const TWO_PI = Math.PI * 2
export const QUARTER_TURN = Math.PI / 2
const MARKER_SPACING = TWO_PI / NOTES.length

export function formatMultiplier(value) {
  const rounded = Math.round(value * 100) / 100
  return `${rounded}×`
}

export function parsePattern(text) {
  const parts = String(text)
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return { error: 'Enter at least one speed.' }
  }
  if (parts.length > 8) {
    return { error: 'Use eight steps or fewer.' }
  }

  const values = []
  for (const part of parts) {
    const value = Number(part)
    if (!Number.isFinite(value) || value <= 0 || value > 8) {
      return { error: 'Use positive numbers up to 8, separated by commas.' }
    }
    values.push(value)
  }

  return { values }
}

// How many full turns a marker has completed. Quarter units stay small, and the
// tiny bias catches a crossing that lands on the sample but falls an ulp short.
function revolutionsOf(quarters, into, home) {
  const whole = Math.floor(quarters / 4)
  const phase = (quarters % 4) + (into + home) / QUARTER_TURN
  return whole + Math.floor((phase + 1e-9) / 4)
}

function collectCrossings(fromQuarters, fromInto, toQuarters, toInto, events) {
  for (let index = 0; index < NOTES.length; index += 1) {
    const home = index * MARKER_SPACING
    const start = revolutionsOf(fromQuarters, fromInto, home)
    const end = revolutionsOf(toQuarters, toInto, home)
    for (let revolution = start; revolution < end; revolution += 1) {
      events.push({
        index,
        note: NOTES[index],
        angle: (revolution + 1) * TWO_PI - home,
      })
    }
  }
}

export function createSequencer() {
  // Quarters are counted as integers so a turn boundary cannot get stuck
  // on a floating-point remainder. `into` is how far the current quarter has turned.
  let quarters = 0
  let into = 0
  let pattern = [2, 1, 3, 1]
  let baseRpm = 10
  let mode = 'variable'
  let playing = false

  function step(dt) {
    if (!playing || !(dt > 0)) return []

    const events = []
    let remaining = dt
    const baseVelocity = (baseRpm * TWO_PI) / 60
    let guard = 0

    while (remaining > 1e-8 && guard < 1000) {
      guard += 1
      const multiplier = mode === 'constant' ? 1 : pattern[quarters % pattern.length]
      const velocity = baseVelocity * multiplier
      if (!(velocity > 0)) break

      const room = QUARTER_TURN - into
      const delta = Math.min(velocity * remaining, room)
      // Step onto the boundary before float error can skip or repeat it.
      if (delta >= room - 1e-7) {
        collectCrossings(quarters, into, quarters + 1, 0, events)
        quarters += 1
        into = 0
        remaining -= room / velocity
        continue
      }

      collectCrossings(quarters, into, quarters, into + delta, events)
      into += delta
      remaining -= delta / velocity
    }

    events.sort((left, right) => left.angle - right.angle || left.index - right.index)
    return events
  }

  function getState() {
    const segmentIndex = quarters % pattern.length
    const rotation = (quarters % 4) * QUARTER_TURN + into
    const cycleQuarters = pattern.length
    const cycleProgress = ((quarters % cycleQuarters) * QUARTER_TURN + into) / (cycleQuarters * QUARTER_TURN)

    return {
      angle: quarters * QUARTER_TURN + into,
      rotation,
      multiplier: mode === 'constant' ? 1 : pattern[segmentIndex],
      segmentIndex,
      segmentProgress: into / QUARTER_TURN,
      cycleProgress,
      pattern: pattern.slice(),
      mode,
      playing,
      baseRpm,
    }
  }

  return {
    step,
    getState,
    isPlaying: () => playing,
    setPlaying(value) {
      playing = Boolean(value)
    },
    setBaseRpm(rpm) {
      if (!Number.isFinite(rpm)) return
      baseRpm = Math.min(60, Math.max(1, rpm))
    },
    setPattern(values) {
      if (!Array.isArray(values) || values.length === 0) return
      pattern = values.slice()
    },
    setMode(next) {
      if (next === 'constant' || next === 'variable') mode = next
    },
    reset() {
      quarters = 0
      into = 0
    },
  }
}
