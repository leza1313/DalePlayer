import { openDB, type IDBPDatabase } from 'idb'
import type { ConcertManifest, ConcertState, MixState } from '../types'
import { appState } from './app.svelte'

const DB_NAME = 'dalePlayer'
const DB_VERSION = 1
const STORE_NAME = 'concerts'

function dbPromise(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME)
    }
  })
}

export async function isStored(): Promise<boolean> {
  const db = await dbPromise()
  const keys = await db.getAllKeys(STORE_NAME)
  return keys.length > 0
}

function defaultMixState(): MixState {
  return { volume: 0.8, pan: 0, mute: false, solo: false }
}

function buildConcertState(manifest: ConcertManifest | null, trackCount: number): ConcertState {
  const trackDefs = manifest?.tracks ?? []
  const totalTracks = trackDefs.length > 0 ? trackDefs.length : trackCount
  const mixTracks: MixState[] = []
  for (let i = 0; i < totalTracks; i++) {
    mixTracks.push(defaultMixState())
  }
  return { manifest, tracks: mixTracks, masterVolume: 0.8 }
}

export async function loadAudio(buffer: ArrayBuffer): Promise<void> {
  const db = await dbPromise()
  await db.put(STORE_NAME, buffer, 'audio')
}

export async function getStoredAudio(): Promise<ArrayBuffer | null> {
  const db = await dbPromise()
  try {
    return await db.get(STORE_NAME, 'audio')
  } catch {
    return null
  }
}

export async function getStoredManifest(): Promise<ConcertManifest | null> {
  const db = await dbPromise()
  try {
    return (await db.get(STORE_NAME, 'manifest')) ?? null
  } catch {
    return null
  }
}

export async function loadConcert(
  file: File | null,
  manifest: ConcertManifest | null,
  trackCount: number
): Promise<void> {
  const db = await dbPromise()

  if (file) {
    const buffer = await file.arrayBuffer()
    await db.put(STORE_NAME, buffer, 'audio')
  }

  if (manifest) {
    await db.put(STORE_NAME, manifest, 'manifest')
  }

  let resolvedManifest = manifest
  if (!resolvedManifest) {
    try { resolvedManifest = await db.get(STORE_NAME, 'manifest') } catch { /* not stored */ }
  }

  const expectedTracks = resolvedManifest?.tracks?.length || trackCount

  let concert: ConcertState
  try {
    const storedMix = await db.get(STORE_NAME, 'mix')
    if (storedMix?.tracks && storedMix.tracks.length > 0) {
      concert = storedMix as ConcertState
      concert.manifest = resolvedManifest ?? concert.manifest ?? null
      // Ajustar la mezcla guardada al número de pistas actual
      if (concert.tracks.length < expectedTracks) {
        while (concert.tracks.length < expectedTracks) {
          concert.tracks.push(defaultMixState())
        }
      } else if (concert.tracks.length > expectedTracks) {
        concert.tracks = concert.tracks.slice(0, expectedTracks)
      }
    } else {
      concert = buildConcertState(resolvedManifest, trackCount)
    }
  } catch {
    concert = buildConcertState(resolvedManifest, trackCount)
  }

  appState.setConcert(concert)
}

export async function saveMix(concert: ConcertState): Promise<void> {
  const db = await dbPromise()
  await db.put(STORE_NAME, concert, 'mix')
}
