import { describe, expect, it } from 'vitest'
import { initialTourState, tourReducer } from '../src/tourMachine'

describe('tourReducer', () => {
  it('starts a tour on the first step', () => {
    const state = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 0, status: 'running' })
  })

  it('starts on a given step', () => {
    const state = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 3 })
    expect(state.stepIndex).toBe(3)
  })

  it('moves forward one step', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    const state = tourReducer(started, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 1, status: 'running' })
  })

  it('completes the tour after the last step', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 2 })
    const state = tourReducer(started, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 2, status: 'completed' })
  })

  it('moves back without going below zero', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    expect(tourReducer(started, { type: 'PREVIOUS' }).stepIndex).toBe(0)
  })

  it('pauses then resumes', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    expect(paused.status).toBe('paused')
    expect(tourReducer(paused, { type: 'RESUME' }).status).toBe('running')
  })

  it('does not resume a completed tour', () => {
    const completed = { tourId: 'a', stepIndex: 2, status: 'completed' as const }
    expect(tourReducer(completed, { type: 'RESUME' })).toBe(completed)
  })

  it('stops and returns to the initial state', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    expect(tourReducer(started, { type: 'STOP' })).toEqual(initialTourState)
  })

  it('ignores a progress action when no tour is running', () => {
    expect(tourReducer(initialTourState, { type: 'NEXT', stepCount: 3 })).toBe(initialTourState)
  })

  it('moving forward from a paused tour resumes it', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 0 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    const state = tourReducer(paused, { type: 'NEXT', stepCount: 3 })
    expect(state).toEqual({ tourId: 'a', stepIndex: 1, status: 'running' })
  })

  it('moving back from a paused tour resumes it', () => {
    const started = tourReducer(initialTourState, { type: 'START', tourId: 'a', stepIndex: 1 })
    const paused = tourReducer(started, { type: 'PAUSE' })
    const state = tourReducer(paused, { type: 'PREVIOUS' })
    expect(state).toEqual({ tourId: 'a', stepIndex: 0, status: 'running' })
  })
})
