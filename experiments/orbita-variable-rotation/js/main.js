import { createSequencer, formatMultiplier, parsePattern } from './sequencer.js'
import { ensureAudio, playNote, releaseAll } from './audio.js'
import { createSketch } from './sketch.js'

const sequencer = createSequencer()
const playButton = document.querySelector('#play')
const resetButton = document.querySelector('#reset')
const constantButton = document.querySelector('#mode-constant')
const variableButton = document.querySelector('#mode-variable')
const rpmInput = document.querySelector('#rpm')
const rpmLabel = document.querySelector('#rpm-label')
const rpmHint = document.querySelector('#rpm-hint')
const patternInput = document.querySelector('#pattern')
const patternError = document.querySelector('#pattern-error')
const multiplierOutput = document.querySelector('#multiplier')
const noteOutput = document.querySelector('#note')
const schedule = document.querySelector('#schedule')
const track = document.querySelector('#track')
const trackFill = document.querySelector('#track-fill')
const modeCaption = document.querySelector('#mode-caption')
const status = document.querySelector('#status')

let arming = false
let shownPattern = ''

const sketch = createSketch(document.querySelector('#canvas'), {
  sequencer,
  onTrigger(event) {
    playNote(event.note)
  },
  onFrame(state, note) {
    render(state, note)
  },
})

function seconds(value) {
  return `${value.toFixed(2)}s`
}

function renderSpeed(rpm) {
  rpmLabel.textContent = `${Number(rpm).toString()} RPM`
  const quarter = 15 / rpm
  const noteGap = 10 / rpm
  rpmHint.textContent = `1× covers a quarter-turn in ${seconds(quarter)}. Constant mode spaces notes ${seconds(noteGap)} apart.`
}

function render(state, note) {
  playButton.textContent = state.playing ? 'Pause' : 'Play'
  playButton.setAttribute('aria-pressed', state.playing ? 'true' : 'false')
  multiplierOutput.textContent = formatMultiplier(state.multiplier)
  noteOutput.textContent = note

  const variable = state.mode === 'variable'
  schedule.classList.toggle('is-idle', !variable)
  constantButton.setAttribute('aria-pressed', variable ? 'false' : 'true')
  variableButton.setAttribute('aria-pressed', variable ? 'true' : 'false')
  modeCaption.textContent = variable
    ? 'Each step lasts one quarter-turn, then the pattern repeats.'
    : 'The disc holds a steady 1×. The pattern waits.'

  const patternKey = state.pattern.join(',')
  if (shownPattern !== patternKey) {
    shownPattern = patternKey
    schedule.replaceChildren()
    state.pattern.forEach((value, index) => {
      const chip = document.createElement('span')
      chip.className = 'chip'
      chip.dataset.index = String(index)
      chip.textContent = formatMultiplier(value)
      schedule.append(chip)
    })
  }

  const chips = schedule.querySelectorAll('.chip')
  chips.forEach((chip, index) => {
    const active = variable && index === state.segmentIndex
    chip.classList.toggle('is-active', active)
  })

  track.hidden = !variable
  trackFill.style.width = `${state.segmentProgress * 100}%`
}

async function togglePlay() {
  if (arming) return
  if (sequencer.isPlaying()) {
    sequencer.setPlaying(false)
    status.textContent = ''
    return
  }

  arming = true
  playButton.disabled = true
  playButton.textContent = 'Starting…'
  status.textContent = ''
  try {
    await ensureAudio()
    sequencer.setPlaying(true)
  } catch (error) {
    status.textContent = 'The browser blocked audio. Press Play again.'
    console.error(error)
  } finally {
    arming = false
    playButton.disabled = false
    playButton.textContent = sequencer.isPlaying() ? 'Pause' : 'Play'
  }
}

function applyPattern(text) {
  const parsed = parsePattern(text)
  if (parsed.error) {
    patternError.textContent = parsed.error
    return
  }
  patternError.textContent = ''
  sequencer.setPattern(parsed.values)
}

playButton.addEventListener('click', () => {
  void togglePlay()
})

resetButton.addEventListener('click', () => {
  sequencer.reset()
  sketch.resetVisuals()
  releaseAll()
  status.textContent = ''
})

constantButton.addEventListener('click', () => {
  sequencer.setMode('constant')
})

variableButton.addEventListener('click', () => {
  sequencer.setMode('variable')
})

rpmInput.addEventListener('input', () => {
  const rpm = Number(rpmInput.value)
  sequencer.setBaseRpm(rpm)
  renderSpeed(rpm)
})

patternInput.addEventListener('input', () => {
  applyPattern(patternInput.value)
})

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
  event.preventDefault()
  void togglePlay()
})

renderSpeed(Number(rpmInput.value))
applyPattern(patternInput.value)
render(sequencer.getState(), '—')
