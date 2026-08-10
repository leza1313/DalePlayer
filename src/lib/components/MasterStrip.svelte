<script lang="ts">
  import { onMount } from 'svelte'
  import { appState } from '../state/app.svelte'
  import { dbToGain, dbToSlider, formatDb, gainToDb, sliderToDb } from '../audio/levels'
  import { getMasterLevel, masterVolume as masterVolumeState, resetMix, setMasterVolume } from '../state/player.svelte'
  import { scheduleMixSave } from '../state/mixState'

  let masterVolume = 1
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
    setMasterVolume(dbToGain(sliderToDb(value)))
    scheduleMixSave()
  }

  function handleReset() {
    if (!confirmReset) {
      confirmReset = true
      return
    }
    resetMix()
    confirmReset = false
    scheduleMixSave()
  }
</script>

<article class="master-card">
  <div class="master-heading">
    <div><span class="eyebrow">Salida</span><strong>Master</strong></div>
    <output>{formatDb(masterVolume)}</output>
  </div>
  <input type="range" min="0" max="1" step="0.001" value={dbToSlider(gainToDb(masterVolume))} on:input={(e) => handleVolume(+e.currentTarget.value)} aria-label="Volumen master" />
  <div class="scale"><span>-∞</span><span>0 dB</span><span>+10 dB</span></div>
  <div class="master-footer">
    <div class="meter" class:warn={level > 0.7} class:clip={level > 0.9}><div class="meter-fill" style="width: {Math.min(level * 100, 100)}%"></div></div>
    <button class="reset-button" class:confirm={confirmReset} on:click={handleReset}>
      {confirmReset ? 'Confirmar reset' : 'Restablecer mezcla'}
    </button>
  </div>
</article>

<style>
  .master-card { padding: 15px 14px; border: 1px solid var(--accent); border-radius: 12px; background: var(--bg-surface); }
  .master-heading, .scale, .master-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .master-heading strong { display: block; font-size: 1rem; }
  .eyebrow { display: block; color: var(--accent); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  output { color: var(--accent); font-size: 0.8rem; }
  input[type="range"] { width: 100%; height: 32px; margin: 10px 0 2px; }
  .scale { color: var(--text-secondary); font-size: 0.65rem; }
  .master-footer { margin-top: 13px; }
  .meter { height: 8px; flex: 1; overflow: hidden; border-radius: 8px; background: var(--fader-track); }
  .meter-fill { height: 100%; border-radius: inherit; background: var(--vu-green); }
  .meter.warn .meter-fill { background: var(--vu-yellow); }
  .meter.clip .meter-fill { background: var(--vu-red); }
  .reset-button { min-height: 38px; padding: 0 10px; border-radius: 7px; background: var(--fader-track); color: var(--text-secondary); font-size: 0.7rem; }
  .reset-button.confirm { background: var(--accent); color: white; font-weight: 700; }
</style>
