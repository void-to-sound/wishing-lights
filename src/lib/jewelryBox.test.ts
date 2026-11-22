import { describe, expect, it } from 'vitest'
import {
  JEWELRY_BOX_INITIAL,
  frameBlend,
  jewelryBoxFramesReady,
  jewelryTransition,
  type JewelryState,
} from './jewelryBox.ts'

function visit(phase: JewelryState['phase'], extra: Partial<JewelryState> = {}): JewelryState {
  return { phase, travel: null, lid: null, ...extra }
}

describe('jewelry box visit', () => {
  it('walks from the closed box to the designer and back home', () => {
    let state = JEWELRY_BOX_INITIAL
    state = jewelryTransition(state, 'activate')
    expect(state).toEqual(visit('opening', { travel: 'forward' }))
    state = jewelryTransition(state, 'arrived')
    expect(state.lid).toBe('open')
    state = jewelryTransition(state, 'opened')
    expect(state.phase).toBe('open')
    state = jewelryTransition(state, 'photo')
    expect(state.phase).toBe('designing')
    state = jewelryTransition(state, 'finish')
    expect(state.phase).toBe('completing')
    state = jewelryTransition(state, 'sealed')
    expect(state.lid).toBe('close')
    state = jewelryTransition(state, 'closed')
    expect(state).toEqual(visit('returning', { travel: 'back' }))
    state = jewelryTransition(state, 'returned')
    expect(state).toEqual(JEWELRY_BOX_INITIAL)
  })

  it('ignores a second click and a finish before a photo is chosen', () => {
    const opening = jewelryTransition(JEWELRY_BOX_INITIAL, 'activate')
    expect(jewelryTransition(opening, 'activate')).toEqual(opening)
    const open = jewelryTransition(jewelryTransition(opening, 'arrived'), 'opened')
    expect(jewelryTransition(open, 'finish')).toEqual(open)
    expect(jewelryTransition(open, 'cancel').phase).toBe('closing')
  })

  it('ships the matched lid frames', () => {
    expect(jewelryBoxFramesReady()).toBe(true)
  })

  it('crossfades from the closed frame to the open frame', () => {
    expect(frameBlend(4, 0)).toEqual({ index: 0, next: 1, mix: 0 })
    expect(frameBlend(4, 1)).toEqual({ index: 2, next: 3, mix: 1 })
    expect(frameBlend(1, 0.4)).toEqual({ index: 0, next: 0, mix: 0 })
  })
})
