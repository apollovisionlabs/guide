import { describe, expect, it } from 'vitest'
import { initialTourState, tourReducer } from '../src/tourMachine'

describe('tourReducer', () => {
  it('démarre un tour à la première étape', () => {
    const state = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 0, status: 'running' })
  })

  it('démarre à une étape donnée', () => {
    const state = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 3 })
    expect(state.stepIndex).toBe(3)
  })

  it('avance d une étape', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    const state = tourReducer(started, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 1, status: 'running' })
  })

  it('termine le tour après la dernière étape', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 2 })
    const state = tourReducer(started, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 2, status: 'completed' })
  })

  it('recule sans passer sous zéro', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    expect(tourReducer(started, { type: 'PREVIOUS' }).stepIndex).toBe(0)
  })

  it('met en pause puis reprend', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    expect(paused.status).toBe('paused')
    expect(tourReducer(paused, { type: 'RESUME' }).status).toBe('running')
  })

  it('ne reprend pas un tour terminé', () => {
    const completed = { tourId: 'a', stepIndex: 2, status: 'completed' as const }
    expect(tourReducer(completed, { type: 'RESUME' })).toBe(completed)
  })

  it('arrête et revient à l état initial', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    expect(tourReducer(started, { type: 'STOP' })).toEqual(initialTourState)
  })

  it('ignore une action de progression quand aucun tour ne tourne', () => {
    expect(tourReducer(initialTourState, { type: 'NEXT', stepCount: 3 })).toBe(initialTourState)
  })

  it('avancer depuis un tour en pause reprend le tour', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    const state = tourReducer(paused, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 1, status: 'running' })
  })

  it('reculer depuis un tour en pause reprend le tour', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    const state = tourReducer(paused, { type: 'PREVIOUS' })
    expect(state).toEqual({ tourId: 'a', stepIndex: 0, status: 'running' })
  })
})
