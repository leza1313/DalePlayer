import { OggOpusDecoder } from 'ogg-opus-decoder'

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
  private fileData: Uint8Array | null = null
  private seekTable: SeekEntry[] = []
  private headPage: { start: number; end: number } | null = null
  private tagsPage: { start: number; end: number } | null = null
  private currentPageIndex = 0
  readonly sampleRate = 48000
  channels = 0
  duration = 0

  async init(buffer: ArrayBuffer): Promise<void> {
    this.fileData = new Uint8Array(buffer)
    this.seekTable = this.buildSeekTable(this.fileData)
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

  private buildSeekTable(data: Uint8Array): SeekEntry[] {
    const pages: SeekEntry[] = []
    let offset = 0
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)

    while (offset < data.length - 27) {
      if (data[offset] !== 0x4F || data[offset + 1] !== 0x67 ||
          data[offset + 2] !== 0x67 || data[offset + 3] !== 0x53) {
        offset++
        continue
      }

      const granulePos = Number(dv.getBigInt64(offset + 6, true))
      const segmentCount = data[offset + 26]

      if (offset + 27 + segmentCount > data.length) break

      let payloadSize = 0
      for (let i = 0; i < segmentCount; i++) {
        payloadSize += data[offset + 27 + i]
      }
      const pageEnd = offset + 27 + segmentCount + payloadSize
      if (pageEnd > data.length) break

      pages.push({
        start: offset,
        end: pageEnd,
        granulePos,
        time: granulePos / 48000
      })

      offset = pageEnd
    }

    return pages
  }

  private getPageData(entry: SeekEntry): Uint8Array {
    return this.fileData!.slice(entry.start, entry.end)
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
    if (!this.decoder || !this.fileData) return null

    // Reset decoder and re-feed headers
    await this.decoder.reset()

    if (this.headPage) {
      await this.decoder.decode(this.fileData.slice(this.headPage.start, this.headPage.end))
    }
    if (this.tagsPage) {
      try { await this.decoder.decode(this.fileData.slice(this.tagsPage.start, this.tagsPage.end)) } catch { /* ok */ }
    }

    const startPageIdx = this.findPageIndex(fromTime)
    const startTime = this.seekTable[startPageIdx].time
    const deadline = startTime + aheadSeconds

    const channelChunks: Float32Array[][] = []
    let totalSamples = 0
    let i = startPageIdx

    while (i < this.seekTable.length && this.seekTable[i].time < deadline) {
      const pageData = this.getPageData(this.seekTable[i])
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
    if (!this.decoder || !this.fileData) return null

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
      const pageData = this.getPageData(this.seekTable[i])
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
