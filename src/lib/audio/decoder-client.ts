import type { AudioSourceDescriptor } from './source'

interface Chunk {
  channelData: Float32Array[]
  startTime: number
  sampleRate: number
}

interface WorkerResponse {
  type: 'ready' | 'chunk' | 'error' | 'freed' | 'progress'
  reqId: number
  duration?: number
  channels?: number
  channelData?: Float32Array[]
  startTime?: number
  sampleRate?: number
  empty?: boolean
  message?: string
  processedBytes?: number
  totalBytes?: number
}

export type DecodeProgressCallback = (processedBytes: number, totalBytes: number) => void

export class DecoderClient {
  private worker: Worker
  private reqCounter = 0
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private progressCallback: DecodeProgressCallback | null = null

  constructor() {
    this.worker = new Worker(
      new URL('./decoder.worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data
      const pending = this.pending.get(msg.reqId)
      if (!pending) return

      if (msg.type === 'progress') {
        this.progressCallback?.(msg.processedBytes ?? 0, msg.totalBytes ?? 0)
        return
      }

      if (msg.type === 'ready') {
        this.pending.delete(msg.reqId)
        pending.resolve({ duration: msg.duration!, channels: msg.channels! })
      } else if (msg.type === 'chunk') {
        this.pending.delete(msg.reqId)
        if (msg.empty) {
          pending.resolve(null)
        } else {
          pending.resolve({
            channelData: msg.channelData!,
            startTime: msg.startTime!,
            sampleRate: msg.sampleRate!
          } as Chunk)
        }
      } else if (msg.type === 'error') {
        this.pending.delete(msg.reqId)
        pending.reject(new Error(msg.message || 'Worker error'))
      } else if (msg.type === 'freed') {
        this.pending.delete(msg.reqId)
        pending.resolve(undefined)
      }
    }
    this.worker.onerror = (e) => {
      // Reject all pending if worker crashes
      for (const [, p] of this.pending) p.reject(new Error('Worker crashed: ' + e.message))
      this.pending.clear()
    }
  }

  init(source: AudioSourceDescriptor, onProgress?: DecodeProgressCallback): Promise<{ duration: number; channels: number }> {
    const reqId = ++this.reqCounter
    this.progressCallback = onProgress ?? null
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject })
      this.worker.postMessage({ type: 'init', reqId, source })
    })
  }

  decodeSeek(position: number, aheadSeconds: number): Promise<Chunk | null> {
    const reqId = ++this.reqCounter
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject })
      this.worker.postMessage({ type: 'seek', reqId, position, aheadSeconds })
    })
  }

  decodeMore(aheadSeconds: number): Promise<Chunk | null> {
    const reqId = ++this.reqCounter
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject })
      this.worker.postMessage({ type: 'decodeAhead', reqId, aheadSeconds })
    })
  }

  free(): Promise<void> {
    const reqId = ++this.reqCounter
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject })
      this.worker.postMessage({ type: 'free', reqId })
    })
  }

  terminate(): void {
    this.progressCallback = null
    this.worker.terminate()
  }
}
