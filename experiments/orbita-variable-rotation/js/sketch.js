import p5 from 'p5'
import { NOTES, formatMultiplier } from './sequencer.js'

const MARKER_COLORS = [
  [159, 212, 255],
  [201, 182, 255],
  [255, 193, 217],
  [255, 224, 168],
  [183, 240, 200],
  [154, 239, 232],
]

function pointOnCircle(cx, cy, radius, clockwiseFromTop) {
  const angle = clockwiseFromTop - Math.PI / 2
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]
}

function measure(p) {
  const panel = document.querySelector('.panel')
  const rect = panel?.getBoundingClientRect()
  const narrow = window.matchMedia('(max-width: 860px)').matches
  let x0 = 0
  let y0 = 0
  let x1 = p.width
  let y1 = p.height

  if (rect && rect.width > 0 && rect.height > 0) {
    if (narrow) y1 = Math.min(y1, rect.top)
    else x0 = Math.max(x0, rect.right)
  }

  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const half = Math.max(56, Math.min(x1 - x0, y1 - y0) * 0.5 - 12)
  const orbit = half * 0.76

  return {
    cx,
    cy,
    orbit,
    disc: orbit * 0.96,
    ring: orbit + Math.max(20, orbit * 0.16),
  }
}

function drawBackground(p, cx, cy) {
  p.background(6, 9, 18)
  const context = p.drawingContext
  const glow = context.createRadialGradient(
    cx,
    cy,
    20,
    cx,
    cy,
    Math.max(p.width, p.height) * 0.62,
  )
  glow.addColorStop(0, 'rgba(28, 44, 78, 0.9)')
  glow.addColorStop(0.42, 'rgba(10, 16, 32, 0.25)')
  glow.addColorStop(1, 'rgba(6, 9, 18, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, p.width, p.height)
}

function drawDisc(p, layout, rotation, flashes) {
  const { cx, cy, orbit, disc } = layout
  const context = p.drawingContext
  const body = context.createRadialGradient(
    cx,
    cy - disc * 0.2,
    disc * 0.08,
    cx,
    cy,
    disc,
  )
  body.addColorStop(0, 'rgba(36, 52, 88, 0.96)')
  body.addColorStop(0.58, 'rgba(12, 18, 34, 0.94)')
  body.addColorStop(1, 'rgba(7, 11, 22, 0.88)')
  context.beginPath()
  context.arc(cx, cy, disc, 0, Math.PI * 2)
  context.fillStyle = body
  context.fill()

  p.push()
  p.translate(cx, cy)
  p.rotate(rotation)
  p.noFill()
  p.strokeCap(p.ROUND)

  const spacing = (Math.PI * 2) / NOTES.length
  p.strokeWeight(Math.max(7, disc * 0.035))
  for (let index = 0; index < NOTES.length; index += 1) {
    const [red, green, blue] = MARKER_COLORS[index]
    p.stroke(red, green, blue, 26 + flashes[index] * 50)
    const center = index * spacing - Math.PI / 2
    const half = spacing * 0.28
    p.arc(0, 0, disc * 1.22, disc * 1.22, center - half, center + half)
  }

  p.stroke(230, 238, 255, 22)
  p.strokeWeight(1.4)
  p.arc(0, 0, disc * 1.45, disc * 1.45, -0.2, 1.05)

  p.strokeWeight(1)
  for (let tick = 0; tick < 72; tick += 1) {
    const major = tick % 6 === 0
    const angle = tick * ((Math.PI * 2) / 72)
    p.push()
    p.rotate(angle)
    p.stroke(196, 214, 238, major ? 48 : 20)
    const inner = disc * (major ? 0.78 : 0.84)
    p.line(0, -inner, 0, -disc * 0.9)
    p.pop()
  }
  p.pop()

  p.noFill()
  p.stroke(206, 220, 240, 36)
  p.strokeWeight(1)
  p.circle(cx, cy, orbit * 2)
  p.circle(cx, cy, disc * 0.46)
}

function drawSchedule(p, layout, state) {
  const { cx, cy, ring } = layout
  p.noFill()
  p.strokeCap(p.ROUND)

  if (state.mode !== 'variable') {
    p.stroke(190, 208, 230, 40)
    p.strokeWeight(1)
    p.circle(cx, cy, ring * 2)
    return
  }

  const steps = state.pattern.length
  const span = (Math.PI * 2) / steps
  const gap = Math.min(0.08, span * 0.12)

  for (let index = 0; index < steps; index += 1) {
    const start = -Math.PI / 2 + index * span + gap / 2
    const sweep = span - gap
    const active = index === state.segmentIndex
    p.stroke(186, 206, 232, active ? 50 : 28)
    p.strokeWeight(1.25)
    p.arc(cx, cy, ring * 2, ring * 2, start, start + sweep)

    if (!active || state.segmentProgress <= 0) continue
    p.stroke(226, 236, 252, 180)
    p.strokeWeight(2)
    p.arc(cx, cy, ring * 2, ring * 2, start, start + sweep * state.segmentProgress)
  }
}

function drawCrystal(p, color, flash) {
  const [red, green, blue] = color
  p.blendMode(p.ADD)
  p.noStroke()
  p.fill(red, green, blue, 18 + flash * 60)
  p.circle(0, 0, 28 + flash * 26)
  p.blendMode(p.BLEND)

  p.stroke(red, green, blue, 90 + flash * 90)
  p.strokeWeight(1)
  p.fill(red, green, blue, 160 + flash * 70)
  p.beginShape()
  p.vertex(0, -12 - flash * 3)
  p.vertex(4.2, 0)
  p.vertex(0, 14)
  p.vertex(-4.2, 0)
  p.endShape(p.CLOSE)

  p.noStroke()
  p.fill(255, 255, 255, 80 + flash * 110)
  p.circle(0, -2, 2.4)
}

function drawMarkers(p, layout, rotation, flashes) {
  const { cx, cy, orbit } = layout
  const spacing = (Math.PI * 2) / NOTES.length
  p.textAlign(p.CENTER, p.CENTER)
  p.textFont('Palatino, "Iowan Old Style", Georgia, serif')
  p.textSize(Math.max(11, orbit * 0.055))

  for (let index = 0; index < NOTES.length; index += 1) {
    const clockwise = rotation + index * spacing
    const [x, y] = pointOnCircle(cx, cy, orbit, clockwise)
    const color = MARKER_COLORS[index] ?? [230, 236, 245]
    const [red, green, blue] = color

    const inset = Math.min(26, Math.max(14, orbit * 0.12))
    p.push()
    p.translate(x, y)
    p.rotate(clockwise)
    drawCrystal(p, color, flashes[index])
    p.translate(0, inset)
    p.rotate(-clockwise)
    p.fill(red, green, blue, 210)
    p.noStroke()
    p.text(NOTES[index], 0, 0)
    p.pop()
  }
}

function drawPlayhead(p, layout, flash) {
  const { cx, cy, orbit, ring } = layout
  const reach = (ring - orbit) * 0.55
  const [x, y] = pointOnCircle(cx, cy, orbit + reach, 0)
  p.push()
  p.translate(x, y)

  p.blendMode(p.ADD)
  p.noStroke()
  p.fill(210, 228, 255, 22 + flash * 80)
  p.circle(0, 6, 16 + flash * 14)
  p.blendMode(p.BLEND)

  p.stroke(236, 242, 255, 210)
  p.strokeWeight(1.25)
  p.strokeCap(p.ROUND)
  p.noFill()
  p.line(0, 5, 0, reach * 0.72)
  p.line(-10, -8, 0, 2)
  p.line(10, -8, 0, 2)
  p.line(-10, -8, -10, -16)
  p.line(10, -8, 10, -16)
  p.line(-10, -16, 10, -16)

  p.noStroke()
  p.fill(255, 250, 242, 235)
  p.circle(0, 4, 4.5 + flash * 2.5)
  p.pop()
}

function drawRipples(p, layout, ripples) {
  const { cx, cy, orbit } = layout
  p.noFill()
  for (const ripple of ripples) {
    const life = 1.15
    const t = ripple.age / life
    if (t >= 1) continue
    const [red, green, blue] = ripple.color
    const radius = orbit * (0.35 + t * 0.85)
    const alpha = (1 - t) * (1 - t) * 70
    p.stroke(red, green, blue, alpha)
    p.strokeWeight(1.5)
    p.circle(cx, cy, radius * 2)
  }
}

function drawReadout(p, layout, state, note, noteColor) {
  const { cx, cy, orbit } = layout
  p.noStroke()
  p.textAlign(p.CENTER, p.CENTER)
  p.textFont('Palatino, "Iowan Old Style", Georgia, serif')

  p.fill(232, 238, 248)
  p.textSize(Math.min(56, Math.max(26, orbit * 0.2)))
  p.text(formatMultiplier(state.multiplier), cx, cy - orbit * 0.04)

  p.textSize(Math.max(12, orbit * 0.055))
  if (noteColor) {
    p.fill(noteColor[0], noteColor[1], noteColor[2], 230)
  } else {
    p.fill(160, 176, 200, 160)
  }
  if (note !== '—') p.text(note, cx, cy + orbit * 0.1)

  if (!state.playing) {
    p.fill(150, 168, 194, 150)
    p.textSize(Math.max(10, orbit * 0.04))
    p.text('paused', cx, cy + orbit * 0.2)
  }
}

export function createSketch(parent, { sequencer, onTrigger, onFrame }) {
  const flashes = new Array(NOTES.length).fill(0)
  const ripples = []
  let playheadFlash = 0
  let currentNote = '—'
  let currentColor = null

  const api = {
    resetVisuals() {
      flashes.fill(0)
      ripples.length = 0
      playheadFlash = 0
      currentNote = '—'
      currentColor = null
    },
  }

  new p5((p) => {
    p.setup = () => {
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight)
      canvas.parent(parent)
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
    }

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight)
    }

    p.draw = () => {
      const raw = p.deltaTime / 1000
      const dt = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.05) : 0
      const events = sequencer.step(dt)

      for (const event of events) {
        flashes[event.index] = 1
        playheadFlash = 1
        currentNote = event.note
        currentColor = MARKER_COLORS[event.index] ?? null
        ripples.push({
          age: 0,
          color: MARKER_COLORS[event.index] ?? [220, 230, 245],
        })
        onTrigger(event)
      }

      if (ripples.length > 8) ripples.splice(0, ripples.length - 8)

      const fade = Math.exp(-dt * 2.8)
      for (let index = 0; index < flashes.length; index += 1) flashes[index] *= fade
      playheadFlash *= Math.exp(-dt * 5)
      for (const ripple of ripples) ripple.age += dt
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        if (ripples[index].age > 1.15) ripples.splice(index, 1)
      }

      const state = sequencer.getState()
      const layout = measure(p)
      drawBackground(p, layout.cx, layout.cy)
      drawDisc(p, layout, state.rotation, flashes)
      drawSchedule(p, layout, state)
      drawRipples(p, layout, ripples)
      drawMarkers(p, layout, state.rotation, flashes)
      drawPlayhead(p, layout, playheadFlash)
      drawReadout(p, layout, state, currentNote, currentColor)
      onFrame(state, currentNote)
    }
  }, parent)

  return api
}
