import { openDB, type IDBPDatabase } from 'idb'
import type { ConcertManifest, ConcertState, MixState } from '../types'
import { appState } from './app.svelte'

const DB_NAME = 'dalePlayer'
const DB_VERSION = 2
const STORE_NAME = 'concerts'
const AUDIO_META_KEY = 'audio:meta'
const AUDIO_CHUNK_PREFIX = 'audio:chunk:'
const AUDIO_CHUNK_SIZE = 16 * 1024 * 1024

export interface AudioProgress {
  processedBytes: number
  totalBytes: number
}

export type AudioProgressCallback = (progress: AudioProgress) => void

interface AudioMetadata {
  version: 2
  size: number
  chunkSize: number
  chunkCount: number
  type: string
  prefix: string
}

function dbPromise(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function isStored(): Promise<boolean> {
  const db = await dbPromise()
  const metadata = await db.get(STORE_NAME, AUDIO_META_KEY) as AudioMetadata | undefined
  if (!metadata || metadata.version !== 2 || metadata.chunkCount <= 0) return false
  const keys = await db.getAllKeys(STORE_NAME)
  const keySet = new Set(keys.map(key => String(key)))
  for (let index = 0; index < metadata.chunkCount; index++) {
    if (!keySet.has(`${metadata.prefix}${index}`)) return false
  }
  return true
}

function defaultMixState(defaultPan = 0, defaultVolume = 1): MixState {
  const pan = Number.isFinite(defaultPan) ? Math.max(-1, Math.min(1, defaultPan)) : 0
  const volume = Number.isFinite(defaultVolume) ? Math.max(0, Math.min(3.1623, defaultVolume)) : 1
  return { volume, pan, mute: false, solo: false }
}

function buildConcertState(manifest: ConcertManifest | null, trackCount: number): ConcertState {
  const trackDefs = manifest?.tracks ?? []
  const totalTracks = trackDefs.length > 0 ? trackDefs.length : trackCount
  const mixTracks: MixState[] = []
  for (let i = 0; i < totalTracks; i++) {
    mixTracks.push(defaultMixState(trackDefs[i]?.defaultPan, trackDefs[i]?.defaultVolume))
  }
  return { manifest, tracks: mixTracks, masterVolume: 1 }
}

async function deleteAudioKeys(db: IDBPDatabase, prefix?: string): Promise<void> {
  const keys = await db.getAllKeys(STORE_NAME)
  for (const key of keys) {
    const keyString = String(key)
    const isMetadata = keyString === AUDIO_META_KEY
    const isChunk = keyString.startsWith(AUDIO_CHUNK_PREFIX) && (!prefix || keyString.startsWith(prefix))
    if ((!prefix && isMetadata) || isChunk) {
      await db.delete(STORE_NAME, key)
    }
  }
}

function makeGeneration(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function loadAudio(blob: Blob, onProgress?: AudioProgressCallback): Promise<void> {
  if (blob.size === 0) throw new Error('El archivo de audio esta vacio')
  const db = await dbPromise()
  const prefix = `${AUDIO_CHUNK_PREFIX}${makeGeneration()}:`
  const chunkCount = Math.ceil(blob.size / AUDIO_CHUNK_SIZE)

  try {
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false)
    const estimate = await navigator.storage?.estimate?.()
    const available = estimate?.quota !== undefined && estimate.usage !== undefined
      ? estimate.quota - estimate.usage
      : null
    if (available !== null && available < blob.size && await isStored()) {
      await deleteAudioKeys(db)
    }
    if (available !== null && available < blob.size) await db.delete(STORE_NAME, 'audio')

    for (let index = 0; index < chunkCount; index++) {
      const start = index * AUDIO_CHUNK_SIZE
      const chunk = blob.slice(start, Math.min(start + AUDIO_CHUNK_SIZE, blob.size))
      await db.put(STORE_NAME, chunk, `${prefix}${index}`)
      onProgress?.({
        processedBytes: Math.min(start + chunk.size, blob.size),
        totalBytes: blob.size
      })
    }

    const metadata: AudioMetadata = {
      version: 2,
      size: blob.size,
      chunkSize: AUDIO_CHUNK_SIZE,
      chunkCount,
      type: blob.type || 'audio/ogg; codecs=opus',
      prefix
    }
    const previous = await db.get(STORE_NAME, AUDIO_META_KEY) as AudioMetadata | undefined
    await db.put(STORE_NAME, metadata, AUDIO_META_KEY)
    if (previous?.prefix && previous.prefix !== prefix) await deleteAudioKeys(db, previous.prefix)
    await db.delete(STORE_NAME, 'audio')
  } catch (error) {
    await deleteAudioKeys(db, prefix).catch(() => undefined)
    throw error
  }
}

export async function getStoredAudio(onProgress?: AudioProgressCallback): Promise<Blob | null> {
  const db = await dbPromise()
  try {
    const metadata = await db.get(STORE_NAME, AUDIO_META_KEY) as AudioMetadata | undefined
    if (metadata?.version === 2) {
      const parts: Blob[] = []
      for (let index = 0; index < metadata.chunkCount; index++) {
        const chunk = await db.get(STORE_NAME, `${metadata.prefix}${index}`) as Blob | undefined
        if (!(chunk instanceof Blob)) throw new Error('Falta un bloque del audio guardado')
        parts.push(chunk)
        onProgress?.({
          processedBytes: Math.min((index + 1) * metadata.chunkSize, metadata.size),
          totalBytes: metadata.size
        })
      }
      return new Blob(parts, { type: metadata.type })
    }

    const legacy = await db.get(STORE_NAME, 'audio') as ArrayBuffer | Blob | undefined
    if (legacy instanceof Blob) return legacy
    if (legacy instanceof ArrayBuffer) return new Blob([legacy], { type: 'audio/ogg; codecs=opus' })
    return null
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
  manifest: ConcertManifest | null,
  trackCount: number
): Promise<void> {
  const db = await dbPromise()

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
    const storedMix = await db.get(STORE_NAME, 'mix-v2')
    if (storedMix?.tracks && storedMix.tracks.length > 0) {
      concert = storedMix as ConcertState
      concert.manifest = resolvedManifest ?? concert.manifest ?? null
      // Ajustar la mezcla guardada al número de pistas actual
      if (concert.tracks.length < expectedTracks) {
        while (concert.tracks.length < expectedTracks) {
          const trackIndex = concert.tracks.length
          const track = resolvedManifest?.tracks?.[trackIndex]
          concert.tracks.push(defaultMixState(track?.defaultPan, track?.defaultVolume))
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
  await db.put(STORE_NAME, concert, 'mix-v2')
}
