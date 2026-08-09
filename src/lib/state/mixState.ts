import { saveMix } from '../state/persistence'
import { getMixState, getMasterVolume, setTrackVolume, setTrackPan, setTrackMute, setTrackSolo, setMasterVolume, resetMix } from '../state/player.svelte'
import { appState } from '../state/app.svelte'
import { get } from 'svelte/store'

let saveTimeout: ReturnType<typeof setTimeout> | null = null

export function scheduleMixSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    const state = get(appState)
    if (!state.concert) return
    state.concert.tracks = getMixState()
    state.concert.masterVolume = getMasterVolume()
    await saveMix(state.concert)
  }, 500)
}

export function applyMixFromState(): void {
  const state = get(appState)
  if (!state.concert) return
  resetMix()
  state.concert.tracks.forEach((mix, ch) => {
    setTrackVolume(ch, mix.volume)
    setTrackPan(ch, mix.pan)
    setTrackMute(ch, mix.mute)
    setTrackSolo(ch, mix.solo)
  })
  setMasterVolume(state.concert.masterVolume)
}
