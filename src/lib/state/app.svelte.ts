import { writable, type Writable } from 'svelte/store'
import type { AppPhase, ConcertState } from '../types'

export interface AppState {
  phase: AppPhase
  concert: ConcertState | null
}

const defaultState: AppState = {
  phase: 'locked',
  concert: null
}

function createAppState() {
  const { subscribe, set, update }: Writable<AppState> = writable(defaultState)

  return {
    subscribe,
    setPhase: (phase: AppPhase) => update(s => ({ ...s, phase })),
    setConcert: (concert: ConcertState) => update(s => ({ ...s, concert, phase: 'ready' })),
    reset: () => set(defaultState)
  }
}

export const appState = createAppState()
