import { writable, type Writable } from 'svelte/store'
import type { AppPhase, ConcertState } from '../types'

export interface AppState {
  phase: AppPhase
  concert: ConcertState | null
  notice: string | null
}

const defaultState: AppState = {
  phase: 'locked',
  concert: null,
  notice: null
}

function createAppState() {
  const { subscribe, set, update }: Writable<AppState> = writable(defaultState)

  return {
    subscribe,
    setPhase: (phase: AppPhase) => update(s => ({ ...s, phase })),
    setConcert: (concert: ConcertState) => update(s => ({ ...s, concert, phase: 'ready' })),
    setNotice: (notice: string | null) => update(s => ({ ...s, notice })),
    reset: () => set(defaultState)
  }
}

export const appState = createAppState()
