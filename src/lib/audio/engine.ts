import { OpusStreamDecoder } from './decoder'

interface Chunk {
  channelData: Float32Array[]
  startTime: number
  sampleRate: number
}

export interface TrackDef {
  name: string
  channels: number[]  // raw channel indices
}

type PositionCallback = (timeSeconds: number) => void
type DurationCallback = (durationSeconds: number) => void

interface MixStrip {
  gain: GainNode
  panner: StereoPannerNode
  muteGate: GainNode
  analyser: AnalyserNode
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private decoder: OpusStreamDecoder | null = null
  private ready = false
  private playing = false
  private playPosition = 0
  private duration = 0
  private scheduledEnd = 0
  private currentSources: AudioBufferSourceNode[] = []
  private masterGain: GainNode | null = null
  private masterAnalyser: AnalyserNode | null = null
  private strips: MixStrip[] = []
  private solo: boolean[] = []
  private muted: boolean[] = []
  private volumes: number[] = []
  private pans: number[] = []
  private trackDefs: TrackDef[] = []
  private trackCount = 0
  private onPositionCallback: PositionCallback | null = null
  private onDurationCallback: DurationCallback | null = null
  private positionInterval: ReturnType<typeof setInterval> | null = null
  private scheduledCount = 0

  onPositionUpdate(cb: PositionCallback) { this.onPositionCallback = cb }
  onDurationUpdate(cb: DurationCallback) { this.onDurationCallback = cb }

  async init(file: ArrayBuffer, tracks?: TrackDef[]): Promise<void> {
    this.decoder = new OpusStreamDecoder()
    await this.decoder.init(file)
    this.duration = this.decoder.duration

    this.trackDefs = tracks ?? []
    this.trackCount = tracks?.length ?? this.decoder.channels

    if (tracks && tracks.length > 0) {
      this.trackCount = tracks.length
    } else {
      // Auto-generate mono tracks for all raw channels
      this.trackCount = this.decoder.channels
      this.trackDefs = []
      for (let ch = 0; ch < this.decoder.channels; ch++) {
        this.trackDefs.push({ name: `Canal ${ch + 1}`, channels: [ch] })
      }
    }

    this.solo = new Array(this.trackCount).fill(false)
    this.muted = new Array(this.trackCount).fill(false)
    this.volumes = new Array(this.trackCount).fill(0.8)
    this.pans = new Array(this.trackCount).fill(0)
    this.ready = true
    this.onDurationCallback?.(this.duration)
  }

  getTrackDefs(): TrackDef[] { return this.trackDefs }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 48000 })
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  async play(from?: number): Promise<void> {
    this.ensureContext()
    if (!this.ready || !this.decoder || !this.ctx) return
    if (from !== undefined) this.playPosition = from
    this.playing = true
    this.scheduledCount = 0
    await this.requestAndSchedule(5)
    this.startPositionUpdates()
  }

  pause(): void {
    this.playing = false
    this.stopSources()
    this.stopPositionUpdates()
  }

  async seek(time: number): Promise<void> {
    const wasPlaying = this.playing
    this.stopSources()
    this.stopPositionUpdates()
    this.playing = false
    this.playPosition = time
    if (wasPlaying) await this.play(time)
  }

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = v
  }

  setTrackVolume(trackIdx: number, v: number): void {
    if (trackIdx < this.strips.length && trackIdx < this.volumes.length) {
      this.volumes[trackIdx] = v
      this.strips[trackIdx].gain.gain.value = v
    }
  }

  setTrackPan(trackIdx: number, pan: number): void {
    if (trackIdx < this.strips.length) {
      this.pans[trackIdx] = pan
      this.strips[trackIdx].panner.pan.value = pan
    }
  }

  setTrackMute(trackIdx: number, mute: boolean): void {
    if (trackIdx < this.muted.length) {
      this.muted[trackIdx] = mute
      this.applyMuteSolo()
    }
  }

  setTrackSolo(trackIdx: number, s: boolean): void {
    if (trackIdx < this.solo.length) {
      this.solo[trackIdx] = s
      this.applyMuteSolo()
    }
  }

  resetMix(): void {
    for (let i = 0; i < this.trackCount; i++) {
      this.volumes[i] = 0.8
      this.pans[i] = 0
      this.muted[i] = false
      this.solo[i] = false
      if (i < this.strips.length) {
        this.strips[i].gain.gain.value = 0.8
        this.strips[i].panner.pan.value = 0
      }
    }
    this.applyMuteSolo()
    if (this.masterGain) this.masterGain.gain.value = 0.8
  }

  getMixState(): { volume: number; pan: number; mute: boolean; solo: boolean }[] {
    const state = []
    for (let i = 0; i < this.trackCount; i++) {
      state.push({
        volume: this.volumes[i] ?? 0.8,
        pan: this.pans[i] ?? 0,
        mute: this.muted[i] ?? false,
        solo: this.solo[i] ?? false,
      })
    }
    return state
  }

  getMasterVolume(): number {
    return this.masterGain?.gain.value ?? 0.8
  }

  getTrackLevel(trackIdx: number): number {
    if (trackIdx >= this.strips.length || !this.strips[trackIdx]) return 0
    const analyser = this.strips[trackIdx].analyser
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs((data[i] - 128) / 128)
      if (v > peak) peak = v
    }
    return peak
  }

  getMasterLevel(): number {
    if (!this.masterAnalyser) return 0
    const data = new Uint8Array(this.masterAnalyser.fftSize)
    this.masterAnalyser.getByteTimeDomainData(data)
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs((data[i] - 128) / 128)
      if (v > peak) peak = v
    }
    return peak
  }

  getTrackCount(): number { return this.trackCount }
  getPosition(): number { return this.playPosition }
  getDuration(): number { return this.duration }
  isPlaying(): boolean { return this.playing }

  private applyMuteSolo(): void {
    if (!this.ctx) return
    const anySolo = this.solo.some(s => s)
    for (let i = 0; i < this.strips.length && i < this.trackCount; i++) {
      this.strips[i].muteGate.gain.value = anySolo ? (this.solo[i] ? 1 : 0) : (this.muted[i] ? 0 : 1)
    }
  }

  private async requestAndSchedule(aheadSeconds: number): Promise<void> {
    if (!this.decoder || !this.ctx) return
    const isSeek = this.scheduledCount === 0
    const chunk = isSeek
      ? await this.decoder.decodeAhead(this.playPosition, aheadSeconds)
      : await this.decoder.decodeMore(aheadSeconds)
    if (chunk) this.scheduleChunk(chunk)
  }

  private scheduleChunk(chunk: Chunk): void {
    if (!this.ctx) return

    if (this.strips.length === 0 || this.scheduledCount === 0) {
      this.rebuildGraph()
    }

    const samplesPerRawCh = chunk.channelData[0].length
    const chunkDuration = samplesPerRawCh / chunk.sampleRate
    const now = this.ctx.currentTime
    const startTime = this.scheduledCount === 0 ? Math.max(now, now + 0.02) : this.scheduledEnd
    const newSources: AudioBufferSourceNode[] = []

    for (let trackIdx = 0; trackIdx < this.trackDefs.length; trackIdx++) {
      const def = this.trackDefs[trackIdx]
      const chs = def.channels

      if (chs.length === 1) {
        // Mono track
        const srcCh = chs[0]
        if (srcCh >= chunk.channelData.length) continue
        const buffer = this.ctx.createBuffer(1, samplesPerRawCh, chunk.sampleRate)
        buffer.copyToChannel(chunk.channelData[srcCh], 0)
        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.connect(this.strips[trackIdx].gain)
        source.start(startTime, 0, chunkDuration)
        newSources.push(source)
      } else if (chs.length >= 2) {
        // Stereo track: merge 2 raw channels into a stereo buffer
        const leftCh = chs[0]
        const rightCh = chs[1]
        if (leftCh >= chunk.channelData.length || rightCh >= chunk.channelData.length) continue
        const samplesL = chunk.channelData[leftCh].length
        const samplesR = chunk.channelData[rightCh].length
        const samples = Math.min(samplesL, samplesR)
        const buffer = this.ctx.createBuffer(2, samples, chunk.sampleRate)
        buffer.copyToChannel(chunk.channelData[leftCh].slice(0, samples), 0)
        buffer.copyToChannel(chunk.channelData[rightCh].slice(0, samples), 1)
        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.connect(this.strips[trackIdx].gain)
        source.start(startTime, 0, samples / chunk.sampleRate)
        newSources.push(source)
      }
    }

    this.currentSources.push(...newSources)
    this.scheduledEnd = startTime + chunkDuration
    this.scheduledCount++
  }

  private rebuildGraph(): void {
    if (!this.ctx) return
    this.strips = []

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.8

    this.masterAnalyser = this.ctx.createAnalyser()
    this.masterAnalyser.fftSize = 256
    this.masterGain.connect(this.masterAnalyser)
    this.masterAnalyser.connect(this.ctx.destination)

    for (let i = 0; i < this.trackCount; i++) {
      const gain = this.ctx.createGain()
      gain.gain.value = this.volumes[i] ?? 0.8

      const panner = this.ctx.createStereoPanner()
      panner.pan.value = this.pans[i] ?? 0

      const muteGate = this.ctx.createGain()
      muteGate.gain.value = 1

      const analyser = this.ctx.createAnalyser()
      analyser.fftSize = 256

      gain.connect(panner)
      panner.connect(muteGate)
      muteGate.connect(analyser)
      analyser.connect(this.masterGain)

      this.strips.push({ gain, panner, muteGate, analyser })
    }
  }

  private stopSources(): void {
    for (const source of this.currentSources) {
      try { source.stop() } catch { /* already stopped */ }
    }
    this.currentSources = []
  }

  private startPositionUpdates(): void {
    this.stopPositionUpdates()
    const startWallTime = performance.now() / 1000
    const startPosition = this.playPosition
    this.positionInterval = setInterval(() => {
      if (!this.playing) return
      const elapsed = (performance.now() / 1000) - startWallTime
      const position = startPosition + elapsed
      if (this.duration > 0 && position >= this.duration - 0.1) {
        this.pause()
        this.playPosition = 0
        this.onPositionCallback?.(0)
        return
      }
      this.playPosition = position
      this.onPositionCallback?.(position)
      if (this.ctx && this.scheduledEnd - this.ctx.currentTime < 4) {
        this.requestAndSchedule(5)
      }
    }, 100)
  }

  private stopPositionUpdates(): void {
    if (this.positionInterval !== null) {
      clearInterval(this.positionInterval)
      this.positionInterval = null
    }
  }

  destroy(): void {
    this.pause()
    this.ctx?.close()
    this.ctx = null
    this.decoder?.destroy()
    this.decoder = null
  }
}
