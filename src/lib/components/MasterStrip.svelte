<script lang="ts">
  import { onMount } from 'svelte'
  import { appState } from '../state/app.svelte'
  import { dbToSlider, formatDb, gainToDb, snapVolumeSlider, triggerReferenceHaptic } from '../audio/levels'
  import { getMasterLevel, masterVolume as masterVolumeState, resetMix, setMasterVolume } from '../state/player.svelte'
  import { scheduleMixSave } from '../state/mixState'

  let masterVolume = 1
  $: masterSliderValue = dbToSlider(gainToDb(masterVolume))
  let volumeReferenceLocked = false
  $: masterVolume = $masterVolumeState
  let level = 0
  let confirmReset = false
  let vuInterval: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    setMasterVolume($appState.concert?.masterVolume ?? 1)
    vuInterval = setInterval(() => { level = getMasterLevel() }, 70)
    return () => { if (vuInterval !== null) clearInterval(vuInterval) }
  })

  function handleVolume(value: number) {
    const snapped = snapVolumeSlider(value)
    if (snapped.snapped && !volumeReferenceLocked) triggerReferenceHaptic()
    volumeReferenceLocked = snapped.snapped
    setMasterVolume(snapped.gain)
    scheduleMixSave()
  }

  function handleReset() {
    if (!confirmReset) {
      confirmReset = true
      return
    }
    resetMix()
    volumeReferenceLocked = false
    confirmReset = false
    scheduleMixSave()
  }
</script>

<article class="master-card">
  <div class="master-heading">
    <div><span class="eyebrow">Salida</span><strong>Master</strong></div>
    <output>{formatDb(masterVolume)}</output>
  </div>
  <span class="slider-visual">
    <input class="master-slider" style={`--range-progress: ${masterSliderValue * 100}%`} type="range" min="0" max="1" step="0.001" value={masterSliderValue} on:input={(e) => handleVolume(+e.currentTarget.value)} aria-label="Volumen master" />
    <span class="reference-marker" aria-hidden="true"></span>
  </span>
  <div class="scale"><span>-∞</span><span>0 dB</span><span>+10 dB</span></div>
  <div class="master-footer">
    <div class="meter" class:warn={level > 0.7} class:clip={level > 0.9}><div class="meter-fill" style="width: {Math.min(level * 100, 100)}%"></div></div>
    <button class="reset-button" class:confirm={confirmReset} on:click={handleReset}>
      {confirmReset ? 'Confirmar reset' : 'Restablecer mezcla'}
    </button>
  </div>
</article>

<style>
  .master-card { padding: 16px 14px; border: 1px solid rgba(184, 134, 36, 0.68); border-radius: 12px; background: linear-gradient(135deg, #282b2b, var(--bg-surface)); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), inset 3px 0 0 var(--accent); }
  .master-heading, .scale, .master-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .master-heading strong { display: block; font-size: 1rem; letter-spacing: 0.02em; }
  .eyebrow { display: block; color: #c39a43; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  output { color: #dfc47f; font-size: 0.8rem; }
  .slider-visual { position: relative; display: block; margin: 10px 0 2px; }
  input[type="range"] { position: relative; z-index: 1; width: 100%; height: 32px; }
  .reference-marker { position: absolute; z-index: 0; top: 50%; left: 85.714%; width: 2px; height: 13px; border-radius: 2px; background: rgba(238, 233, 220, 0.55); pointer-events: none; transform: translate(-50%, -50%); }
  .master-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, var(--fader-fill) 0%, var(--fader-fill) var(--range-progress), var(--fader-track) var(--range-progress), var(--fader-track) 100%); }
  .master-slider::-moz-range-track { background: linear-gradient(to right, var(--fader-fill) 0%, var(--fader-fill) var(--range-progress), var(--fader-track) var(--range-progress), var(--fader-track) 100%); }
  .scale { position: relative; color: var(--text-secondary); font-size: 0.65rem; }
  .scale span:nth-child(2) { position: absolute; left: 85.714%; transform: translateX(-50%); }
  .master-footer { margin-top: 13px; }
  .meter { height: 8px; flex: 1; overflow: hidden; border-radius: 8px; background: var(--fader-track); }
  .meter-fill { height: 100%; border-radius: inherit; background: var(--vu-green); }
  .meter.warn .meter-fill { background: var(--vu-yellow); }
  .meter.clip .meter-fill { background: var(--vu-red); }
  .reset-button { min-height: 38px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 7px; background: #2b3239; color: var(--text-secondary); font-size: 0.7rem; transition: background 150ms ease, border-color 150ms ease; }
  .reset-button:active { background: var(--accent-soft); }
  .reset-button.confirm { background: #8c3e42; border-color: var(--vu-red); color: white; font-weight: 700; }
</style>
