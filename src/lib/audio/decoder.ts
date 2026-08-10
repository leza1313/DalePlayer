import { OggOpusDecoder } from 'ogg-opus-decoder'
import type { AudioSource } from './source'

interface SeekEntry {
  start: number
  end: number
  granulePos: number
  time: number
}

interface DecodedChunk {
  channelData: Float32Array[]
  startTime: number
  sampleRate: number
}

export class OpusStreamDecoder {
  private decoder: OggOpusDecoder | null = null
  private fileData: AudioSource | null = null
  private seekTable: SeekEntry[] = []
  private headPage: { start: number; end: number } | null = null
  private tagsPage: { start: number; end: number } | null = null
  private currentPageIndex = 0
  readonly sampleRate = 48000
  channels = 0
  duration = 0

  async init(source: AudioSource, onProgress?: (processedBytes: number, totalBytes: number) => void): Promise<void> {
    this.fileData = source
    this.seekTable = await this.buildSeekTable(source, onProgress)
    this.duration = this.seekTable[this.seekTable.length - 1]?.time ?? 0

    // Identify head and tags pages (first two pages with granule=0)
    if (this.seekTable.length >= 1) {
      this.headPage = this.seekTable[0]
    }
    if (this.seekTable.length >= 2 && this.seekTable[1].granulePos === 0) {
      this.tagsPage = this.seekTable[1]
    }

    this.decoder = new OggOpusDecoder()
    await this.decoder.ready
  }

  private async buildSeekTable(
    source: AudioSource,
    onProgress?: (processedBytes: number, totalBytes: number) => void
  ): Promise<SeekEntry[]> {
    const pages: SeekEntry[] = []
    const blockSize = 4 * 1024 * 1024
    let sourceOffset = 0
    let pending = new Uint8Array(0)
    let pendingOffset = 0
    let lastProgress = -1

    while (sourceOffset < source.size) {
      const length = Math.min(blockSize, source.size - sourceOffset)
      const block = await source.read(sourceOffset, length)
      sourceOffset += block.length

      const data = new Uint8Array(pending.length + block.length)
      data.set(pending)
      data.set(block, pending.length)
      const dataOffset = pending.length > 0 ? pendingOffset : sourceOffset - block.length
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
      let cursor = 0

      while (cursor < data.length) {
        let pageStart = cursor
        while (pageStart + 4 <= data.length &&
          (data[pageStart] !== 0x4F || data[pageStart + 1] !== 0x67 ||
           data[pageStart + 2] !== 0x67 || data[pageStart + 3] !== 0x53)) {
          pageStart++
        }

        if (pageStart + 27 > data.length) {
          cursor = pageStart
          break
        }

        const segmentCount = data[pageStart + 26]
        if (pageStart + 27 + segmentCount > data.length) {
          cursor = pageStart
          break
        }

        let payloadSize = 0
        for (let i = 0; i < segmentCount; i++) {
          payloadSize += data[pageStart + 27 + i]
        }
        const pageEnd = pageStart + 27 + segmentCount + payloadSize
        if (pageEnd > data.length) {
          cursor = pageStart
          break
        }

        const granulePos = Number(dv.getBigInt64(pageStart + 6, true))
        pages.push({
          start: dataOffset + pageStart,
          end: dataOffset + pageEnd,
          granulePos,
          time: granulePos / 48000
        })
        cursor = pageEnd
      }

      pending = data.slice(cursor)
      pendingOffset = dataOffset + cursor
      const progressStep = Math.max(1, Math.floor(source.size / 100))
      if (sourceOffset === source.size || sourceOffset - lastProgress >= progressStep) {
        onProgress?.(sourceOffset, source.size)
        lastProgress = sourceOffset
      }
    }

    return pages
  }

  private getPageData(entry: { start: number; end: number }): Promise<Uint8Array> {
    return this.fileData!.read(entry.start, entry.end - entry.start)
  }

  private findPageIndex(time: number): number {
    let lo = 0
    let hi = this.seekTable.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.seekTable[mid].time < time) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    while (lo > 0 && this.seekTable[lo].time > time) lo--
    return lo
  }

  async decodeAhead(fromTime: number, aheadSeconds: number): Promise<DecodedChunk | null> {
    if (!this.decoder || !this.fileData || this.seekTable.length === 0) return null

    // Reset decoder and re-feed headers
    await this.decoder.reset()

    if (this.headPage) {
      await this.decoder.decode(await this.getPageData(this.headPage))
    }
    if (this.tagsPage) {
      try { await this.decoder.decode(await this.getPageData(this.tagsPage)) } catch { /* ok */ }
    }

    const startPageIdx = this.findPageIndex(fromTime)
    const startTime = this.seekTable[startPageIdx].time
    const deadline = startTime + aheadSeconds

    const channelChunks: Float32Array[][] = []
    let totalSamples = 0
    let i = startPageIdx

    while (i < this.seekTable.length && this.seekTable[i].time < deadline) {
      const pageData = await this.getPageData(this.seekTable[i])
      try {
        const result = await this.decoder.decode(pageData)
        if (result.samplesDecoded > 0 && result.channelData) {
          this.channels = result.channelData.length
          channelChunks.push(result.channelData as Float32Array[])
          totalSamples += result.samplesDecoded
        }
      } catch {
        // skip decoding errors for individual pages
      }
      i++
    }

    this.currentPageIndex = i

    if (channelChunks.length === 0) return null

    // Merge chunks into contiguous Float32Arrays per channel
    const channels = channelChunks[0].length
    const merged: Float32Array[] = []
    for (let ch = 0; ch < channels; ch++) {
      const buf = new Float32Array(totalSamples)
      let writeIdx = 0
      for (const chunk of channelChunks) {
        const src = chunk[ch]
        if (src) {
          buf.set(src, writeIdx)
          writeIdx += src.length
        }
      }
      merged.push(buf.slice(0, writeIdx))
    }

    return { channelData: merged, startTime, sampleRate: this.sampleRate }
  }

  async decodeMore(aheadSeconds: number): Promise<DecodedChunk | null> {
    if (!this.decoder || !this.fileData || this.seekTable.length === 0) return null

    if (this.currentPageIndex === 0) {
      return this.decodeAhead(0, aheadSeconds)
    }

    // Continue decoding from where we left off (no reset needed)
    const startTime = this.seekTable[this.currentPageIndex].time
    const deadline = startTime + aheadSeconds

    const channelChunks: Float32Array[][] = []
    let totalSamples = 0
    let i = this.currentPageIndex

    while (i < this.seekTable.length && this.seekTable[i].time < deadline) {
      const pageData = await this.getPageData(this.seekTable[i])
      try {
        const result = await this.decoder.decode(pageData)
        if (result.samplesDecoded > 0 && result.channelData) {
          channelChunks.push(result.channelData as Float32Array[])
          totalSamples += result.samplesDecoded
        }
      } catch { /* skip */ }
      i++
    }

    this.currentPageIndex = i

    if (channelChunks.length === 0) return null

    const channels = channelChunks[0].length
    const merged: Float32Array[] = []
    for (let ch = 0; ch < channels; ch++) {
      const buf = new Float32Array(totalSamples)
      let writeIdx = 0
      for (const chunk of channelChunks) {
        const src = chunk[ch]
        if (src) {
          buf.set(src, writeIdx)
          writeIdx += src.length
        }
      }
      merged.push(buf.slice(0, writeIdx))
    }

    return { channelData: merged, startTime, sampleRate: this.sampleRate }
  }

  destroy(): void {
    this.decoder?.free()
    this.decoder = null
    this.fileData = null
    this.seekTable = []
  }
}
