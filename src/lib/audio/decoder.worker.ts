import { OpusStreamDecoder } from './decoder'
import { createAudioSource, type AudioSourceDescriptor } from './source'

let decoder: OpusStreamDecoder | null = null
let processing = false

interface ChunkResult {
  channelData: Float32Array[]
  startTime: number
  sampleRate: number
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data
  const reqId: number = msg.reqId

  if (processing && msg.type !== 'free') {
    self.postMessage({ type: 'error', reqId, message: 'Worker busy, dropping request' })
    return
  }

  processing = true

  try {
    if (msg.type === 'init') {
      decoder = new OpusStreamDecoder()
      const source = msg.source as AudioSourceDescriptor
      await decoder.init(createAudioSource(source), (processedBytes, totalBytes) => {
        self.postMessage({ type: 'progress', reqId, processedBytes, totalBytes })
      })
      self.postMessage({ type: 'ready', reqId, duration: decoder.duration, channels: decoder.channels })
    }
    else if (msg.type === 'seek') {
      if (!decoder) return postError(reqId, 'Not initialized')
      const chunk = await decoder.decodeAhead(msg.position, msg.aheadSeconds)
      postChunk(reqId, chunk)
    }
    else if (msg.type === 'decodeAhead') {
      if (!decoder) return postError(reqId, 'Not initialized')
      const chunk = await decoder.decodeMore(msg.aheadSeconds)
      postChunk(reqId, chunk)
    }
    else if (msg.type === 'free') {
      decoder?.destroy()
      decoder = null
      self.postMessage({ type: 'freed', reqId })
    }
  } catch (e: any) {
    postError(reqId, e.message || String(e))
  } finally {
    processing = false
  }
}

function postChunk(reqId: number, chunk: ChunkResult | null) {
  if (!chunk) {
    self.postMessage({ type: 'chunk', reqId, empty: true })
    return
  }
  const buffers = chunk.channelData.map(c => c.buffer as ArrayBuffer)
  self.postMessage({
    type: 'chunk',
    reqId,
    startTime: chunk.startTime,
    sampleRate: chunk.sampleRate,
    channelData: chunk.channelData,
    empty: false
  }, { transfer: buffers })
}

function postError(reqId: number, message: string) {
  self.postMessage({ type: 'error', reqId, message })
}
