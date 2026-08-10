import { writable } from 'svelte/store'
import { AudioEngine, type TrackDef } from '../audio/engine'
import type { AudioSourceDescriptor } from '../audio/source'

let engine: AudioEngine | null = null

export const position = writable(0)
export const duration = writable(0)
export const playing = writable(false)
export const trackCount = writable(0)
export const ready = writable(false)
export const mixReset = writable(0)
export const masterVolume = writable(1)
export const focusTrack = writable(-1)

function createEngine(): AudioEngine {
  engine = new AudioEngine()
  engine.onPositionUpdate((t) => position.set(t))
  engine.onDurationUpdate((d) => duration.set(d))
  engine.onPlayingUpdate((isPlaying) => playing.set(isPlaying))
  return engine
}

export async function initPlayer(
  source: AudioSourceDescriptor,
  tracks?: TrackDef[],
  onProgress?: (processedBytes: number, totalBytes: number) => void
): Promise<AudioEngine> {
  engine?.destroy()
  const eng = createEngine()
  try {
    await eng.init(source, tracks, onProgress)
  } catch (error) {
    eng.destroy()
    if (engine === eng) engine = null
    throw error
  }
  trackCount.set(eng.getTrackCount())
  focusTrack.set(-1)
  ready.set(true)
  return eng
}

export function togglePlay() {
  if (!engine) return
  if (engine.isPlaying()) {
    engine.pause()
    playing.set(false)
  } else {
    engine.play(engine.getPosition())
    playing.set(true)
  }
}

export async function seek(time: number) {
  if (!engine) return
  await engine.seek(time)
  position.set(time)
  playing.set(engine.isPlaying())
}

export function setMasterVolume(v: number) {
  engine?.setMasterVolume(v)
  masterVolume.set(v)
}
export function setTrackVolume(ch: number, v: number) { engine?.setTrackVolume(ch, v) }
export function setTrackPan(ch: number, pan: number) { engine?.setTrackPan(ch, pan) }
export function setTrackMute(ch: number, mute: boolean) { engine?.setTrackMute(ch, mute) }
export function setTrackSolo(ch: number, solo: boolean) { engine?.setTrackSolo(ch, solo) }
export function setTrackFocus(ch: number, focus: boolean) {
  engine?.setTrackFocus(ch, focus)
  focusTrack.set(engine?.getFocusTrack() ?? -1)
}
export function resetMix() {
  engine?.resetMix()
  masterVolume.set(1)
  focusTrack.set(-1)
  mixReset.update(value => value + 1)
}

export function getTrackLevel(ch: number): number { return engine?.getTrackLevel(ch) ?? 0 }
export function getMasterLevel(): number { return engine?.getMasterLevel() ?? 0 }
export function getTrackCount(): number { return engine?.getTrackCount() ?? 0 }
export function getMasterVolume(): number { return engine?.getMasterVolume() ?? 1 }
export function getMixState() { return engine?.getMixState() ?? [] }
export function getTrackDefs(): TrackDef[] { return engine?.getTrackDefs() ?? [] }
