// Mixer — will be implemented in Phase 3 alongside the engine
// Builds per-track: GainNode → StereoPannerNode → GainNode (mute/solo bus) → AnalyserNode → master
// Handles solo logic (if any solo active, only soloed tracks audible)
// Reads MixState[] from concert state and applies in real-time

export class Mixer {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null

  init(ctx: AudioContext): void {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.connect(ctx.destination)
  }

  // Stub — implemented in Phase 3
}
