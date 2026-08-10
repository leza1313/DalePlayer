export interface TrackDef {
  name: string
  channels: number[]
  defaultPan?: number // -1..1, only used when creating a mix for the first time
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
  volume: number   // 0..1, default 0.8
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
