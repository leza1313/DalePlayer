import { DecoderClient } from './decoder-client'
import type { AudioSourceDescriptor } from './source'

interface Chunk {
  channelData: Float32Array[]
  startTime: number
  sampleRate: number
}

export interface TrackDef {
  name: string
  channels: number[]  // raw channel indices
  defaultPan?: number
}

type PositionCallback = (timeSeconds: number) => void
type DurationCallback = (durationSeconds: number) => void
type PlayingCallback = (playing: boolean) => void
type DecodeProgressCallback = (processedBytes: number, totalBytes: number) => void

interface MixStrip {
  gain: GainNode
  focusGain: GainNode
  panner: StereoPannerNode | null
  muteGate: GainNode
  analyser: AnalyserNode
}

export interface MeterLevel {
  level: number
  peak: number
}

const METER_FLOOR_DB = -48
const METER_ATTACK_SECONDS = 0.07
const METER_RELEASE_SECONDS = 0.25

export class AudioEngine {
  private ctx: AudioContext | null = null
  private client: DecoderClient | null = null
  private ready = false
  private playing = false
  private playPosition = 0
  private duration = 0
  private scheduledEnd = 0
  private currentSources = new Set<AudioBufferSourceNode>()
  private masterGain: GainNode | null = null
  private masterAnalyser: AnalyserNode | null = null
  private strips: MixStrip[] = []
  private solo: boolean[] = []
  private muted: boolean[] = []
  private volumes: number[] = []
  private pans: number[] = []
  private focusTrack = -1
  private trackDefs: TrackDef[] = []
  private trackCount = 0
  private trackMeterLevels: number[] = []
  private trackMeterPeaks: number[] = []
  private masterMeterLevel = 0
  private masterMeterPeak = 0
  private onPositionCallback: PositionCallback | null = null
  private onDurationCallback: DurationCallback | null = null
  private onPlayingCallback: PlayingCallback | null = null
  private positionInterval: ReturnType<typeof setInterval> | null = null
  private scheduledCount = 0
  private decodeInFlight = false

  onPositionUpdate(cb: PositionCallback) { this.onPositionCallback = cb }
  onDurationUpdate(cb: DurationCallback) { this.onDurationCallback = cb }
  onPlayingUpdate(cb: PlayingCallback) { this.onPlayingCallback = cb }

  async init(source: AudioSourceDescriptor, tracks?: TrackDef[], onProgress?: DecodeProgressCallback): Promise<void> {
    this.client = new DecoderClient()
    const info = await this.client.init(source, onProgress)
    this.duration = info.duration

    this.trackDefs = tracks ?? []
    this.trackCount = tracks?.length ?? info.channels

    if (tracks && tracks.length > 0) {
      this.trackCount = tracks.length
    } else {
      // Auto-generate mono tracks for all raw channels
      this.trackCount = info.channels
      this.trackDefs = []
      for (let ch = 0; ch < info.channels; ch++) {
        this.trackDefs.push({ name: `Canal ${ch + 1}`, channels: [ch] })
      }
    }

    this.solo = new Array(this.trackCount).fill(false)
    this.muted = new Array(this.trackCount).fill(false)
    this.volumes = new Array(this.trackCount).fill(1)
    this.pans = new Array(this.trackCount).fill(0)
    this.trackMeterLevels = new Array(this.trackCount).fill(0)
    this.trackMeterPeaks = new Array(this.trackCount).fill(0)
    this.masterMeterLevel = 0
    this.masterMeterPeak = 0
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
    if (!this.ready || !this.client || !this.ctx) return
    if (from !== undefined) this.playPosition = from
    this.playing = true
    this.onPlayingCallback?.(true)
    this.scheduledCount = 0
    await this.requestAndSchedule(5)
    this.startPositionUpdates()
  }

  pause(): void {
    this.playing = false
    this.onPlayingCallback?.(false)
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
    if (trackIdx < this.volumes.length) {
      this.volumes[trackIdx] = v
      if (trackIdx < this.strips.length) {
        this.strips[trackIdx].gain.gain.value = v
      }
    }
  }

  setTrackPan(trackIdx: number, pan: number): void {
    if (trackIdx < this.pans.length) {
      this.pans[trackIdx] = pan
      if (trackIdx < this.strips.length && this.strips[trackIdx].panner) {
        this.strips[trackIdx].panner.pan.value = pan
      }
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

  setTrackFocus(trackIdx: number, focus: boolean): void {
    if (focus && trackIdx >= 0 && trackIdx < this.trackCount) {
      this.focusTrack = trackIdx
    } else if (!focus && this.focusTrack === trackIdx) {
      this.focusTrack = -1
    }
    this.applyFocus()
  }

  resetMix(): void {
    for (let i = 0; i < this.trackCount; i++) {
      this.volumes[i] = 1
      this.pans[i] = 0
      this.muted[i] = false
      this.solo[i] = false
      if (i < this.strips.length) {
        this.strips[i].gain.gain.value = 1
        this.strips[i].panner?.pan.setValueAtTime(0, this.ctx?.currentTime ?? 0)
      }
    }
    this.focusTrack = -1
    this.applyMuteSolo()
    if (this.masterGain) this.masterGain.gain.value = 1
  }

  getMixState(): { volume: number; pan: number; mute: boolean; solo: boolean }[] {
    const state = []
    for (let i = 0; i < this.trackCount; i++) {
      state.push({
        volume: this.volumes[i] ?? 1,
        pan: this.pans[i] ?? 0,
        mute: this.muted[i] ?? false,
        solo: this.solo[i] ?? false,
      })
    }
    return state
  }

  getMasterVolume(): number {
    return this.masterGain?.gain.value ?? 1
  }

  getFocusTrack(): number { return this.focusTrack }

  getTrackMeter(trackIdx: number): MeterLevel {
    if (trackIdx >= this.strips.length || !this.strips[trackIdx]) return { level: 0, peak: 0 }
    const meter = this.readMeter(this.strips[trackIdx].analyser)
    this.trackMeterLevels[trackIdx] = this.smoothMeter(this.trackMeterLevels[trackIdx] ?? 0, meter.level)
    this.trackMeterPeaks[trackIdx] = this.smoothMeter(this.trackMeterPeaks[trackIdx] ?? 0, meter.peak)
    return { level: this.trackMeterLevels[trackIdx], peak: this.trackMeterPeaks[trackIdx] }
  }

  getTrackLevel(trackIdx: number): number { return this.getTrackMeter(trackIdx).level }

  getMasterMeter(): MeterLevel {
    if (!this.masterAnalyser) return { level: 0, peak: 0 }
    const meter = this.readMeter(this.masterAnalyser)
    this.masterMeterLevel = this.smoothMeter(this.masterMeterLevel, meter.level)
    this.masterMeterPeak = this.smoothMeter(this.masterMeterPeak, meter.peak)
    return { level: this.masterMeterLevel, peak: this.masterMeterPeak }
  }

  getMasterLevel(): number { return this.getMasterMeter().level }

  private readMeter(analyser: AnalyserNode): MeterLevel {
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    let sumSquares = 0
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const value = (data[i] - 128) / 128
      const magnitude = Math.abs(value)
      sumSquares += value * value
      if (magnitude > peak) peak = magnitude
    }
    const rms = Math.sqrt(sumSquares / data.length)
    return { level: this.dbToMeter(rms), peak: this.dbToMeter(peak) }
  }

  private dbToMeter(amplitude: number): number {
    if (amplitude <= 0) return 0
    const db = 20 * Math.log10(amplitude)
    return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB))
  }

  private smoothMeter(current: number, target: number): number {
    const timeConstant = target > current ? METER_ATTACK_SECONDS : METER_RELEASE_SECONDS
    const amount = 1 - Math.exp(-0.07 / timeConstant)
    return current + (target - current) * amount
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

  private applyFocus(): void {
    const focusGain = Math.pow(10, -18 / 20)
    for (let i = 0; i < this.strips.length && i < this.trackCount; i++) {
      this.strips[i].focusGain.gain.value = this.focusTrack >= 0 && i !== this.focusTrack ? focusGain : 1
    }
  }

  private async requestAndSchedule(aheadSeconds: number): Promise<void> {
    if (!this.client || !this.ctx || this.decodeInFlight) return
    this.decodeInFlight = true
    try {
      const isSeek = this.scheduledCount === 0
      const chunk = isSeek
        ? await this.client.decodeSeek(this.playPosition, aheadSeconds)
        : await this.client.decodeMore(aheadSeconds)
      if (!this.playing) return
      if (chunk) this.scheduleChunk(chunk)
    } catch {
      if (this.playing) {
        this.playing = false
        this.onPlayingCallback?.(false)
        this.stopPositionUpdates()
      }
    } finally {
      this.decodeInFlight = false
    }
  }

  private scheduleChunk(chunk: Chunk): void {
    if (!this.ctx || !this.playing) return

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
        buffer.copyToChannel(new Float32Array(chunk.channelData[srcCh]), 0)
        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.connect(this.strips[trackIdx].gain)
        source.onended = () => this.currentSources.delete(source)
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
        source.onended = () => this.currentSources.delete(source)
        source.start(startTime, 0, samples / chunk.sampleRate)
        newSources.push(source)
      }
    }

    for (const source of newSources) this.currentSources.add(source)
    this.scheduledEnd = startTime + chunkDuration
    this.scheduledCount++
  }

  private rebuildGraph(): void {
    if (!this.ctx) return
    this.strips = []
    this.trackMeterLevels = new Array(this.trackCount).fill(0)
    this.trackMeterPeaks = new Array(this.trackCount).fill(0)
    this.masterMeterLevel = 0
    this.masterMeterPeak = 0

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1

    this.masterAnalyser = this.ctx.createAnalyser()
    this.masterAnalyser.fftSize = 1024
    this.masterGain.connect(this.masterAnalyser)
    this.masterAnalyser.connect(this.ctx.destination)

    for (let i = 0; i < this.trackCount; i++) {
      const gain = this.ctx.createGain()
      gain.gain.value = this.volumes[i] ?? 1

      const focusGain = this.ctx.createGain()
      focusGain.gain.value = 1

      const isMono = this.trackDefs[i]?.channels.length === 1
      const panner = isMono ? this.ctx.createStereoPanner() : null
      if (panner) panner.pan.value = this.pans[i] ?? 0

      const muteGate = this.ctx.createGain()
      muteGate.gain.value = 1

      const analyser = this.ctx.createAnalyser()
      analyser.fftSize = 1024

      if (panner) {
        gain.connect(focusGain)
        focusGain.connect(panner)
        panner.connect(muteGate)
      } else {
        gain.connect(focusGain)
        focusGain.connect(muteGate)
      }
      muteGate.connect(analyser)
      analyser.connect(this.masterGain)

      this.strips.push({ gain, focusGain, panner, muteGate, analyser })
    }
    this.applyMuteSolo()
    this.applyFocus()
  }

  private stopSources(): void {
    for (const source of this.currentSources) {
      try { source.stop() } catch { /* already stopped */ }
    }
    this.currentSources.clear()
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
    this.ready = false
    this.decodeInFlight = false
    this.ctx?.close()
    this.ctx = null
    this.client?.terminate()
    this.client = null
  }
}
