export interface TrackDef {
  name: string
  channels: number[]
  defaultPan?: number // -1..1, only used when creating a mix for the first time
  defaultVolume?: number // linear gain, only used when creating a mix for the first time
}

export interface Marker {
  time: number
  name: string
}

export interface ConcertManifest {
  title: string
  tracks: TrackDef[]
  markers: Marker[]
}

export interface MixState {
  volume: number   // linear gain: 0 = -∞ dB, 1 = 0 dB, 3.16 = +10 dB
  pan: number      // -1..1, default 0
  mute: boolean    // default false
  solo: boolean    // default false
}

export interface ConcertState {
  manifest: ConcertManifest | null
  tracks: MixState[]
  masterVolume: number
}

export type AppPhase = 'locked' | 'loading' | 'ready'
