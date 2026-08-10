<script lang="ts">
  export let index: number

  import { onDestroy, onMount } from 'svelte'
  import { appState } from '../state/app.svelte'
  import { dbToGain, dbToSlider, formatDb, gainToDb, sliderToDb } from '../audio/levels'
  import {
    getMixState, getTrackLevel, mixReset, setTrackMute, setTrackPan,
    setTrackSolo, setTrackVolume
  } from '../state/player.svelte'
  import { scheduleMixSave } from '../state/mixState'

  $: concert = $appState.concert
  $: track = concert?.manifest?.tracks[index]
  $: name = track?.name ?? `Canal ${index + 1}`
  $: isMono = (track?.channels.length ?? 1) === 1

  let volume = 1
  let volumeSliderValue = 1
  let pan = 0
  let muted = false
  let solo = false
  let level = 0
  let expanded = false
  let resetVersion = 0
  let vuInterval: ReturnType<typeof setInterval> | null = null

  $: if ($mixReset !== resetVersion) {
    resetVersion = $mixReset
    const state = getMixState()[index]
    if (state) {
      volume = state.volume
      volumeSliderValue = dbToSlider(gainToDb(state.volume))
      pan = state.pan
      muted = state.mute
      solo = state.solo
    }
  }

  onMount(() => {
    const stored = $appState.concert?.tracks[index]
    if (stored) {
      volume = stored.volume
      volumeSliderValue = dbToSlider(gainToDb(stored.volume))
      pan = stored.pan
      muted = stored.mute
      solo = stored.solo
    }
    vuInterval = setInterval(() => { level = getTrackLevel(index) }, 70)
  })

  onDestroy(() => {
    if (vuInterval !== null) clearInterval(vuInterval)
  })

  function handleVolumeSlider(value: number) {
    volumeSliderValue = value
    volume = dbToGain(sliderToDb(value))
    setTrackVolume(index, volume)
    scheduleMixSave()
  }

  function handleVolumeInput(event: Event) {
    handleVolumeSlider(Number((event.currentTarget as HTMLInputElement).value))
  }

  function handlePan(value: number) {
    pan = value
    setTrackPan(index, value)
    scheduleMixSave()
  }

  function handlePanInput(event: Event) {
    handlePan(Number((event.currentTarget as HTMLInputElement).value))
  }

  function toggleMute() {
    muted = !muted
    setTrackMute(index, muted)
    scheduleMixSave()
  }

  function toggleSolo() {
    solo = !solo
    setTrackSolo(index, solo)
    scheduleMixSave()
  }

  function panLabel() {
    if (pan === 0) return 'Centro'
    return `${pan < 0 ? 'I' : 'D'} ${Math.round(Math.abs(pan) * 100)}`
  }
</script>

<article class="channel-card" class:expanded>
  <button class="card-summary" on:click={() => expanded = !expanded} aria-expanded={expanded}>
    <span class="channel-name">{name}</span>
    <span class="summary-volume">{formatDb(volume)}</span>
    <span class="summary-pan">{isMono ? panLabel() : 'Estéreo'}</span>
    <span class="chevron">{expanded ? '⌃' : '⌄'}</span>
  </button>

  <div class="quick-controls">
    <button class="toggle mute" class:active={muted} on:click={toggleMute} aria-pressed={muted}>M <span>Mute</span></button>
    <button class="toggle solo" class:active={solo} on:click={toggleSolo} aria-pressed={solo}>S <span>Solo</span></button>
    <div class="meter" class:warn={level > 0.7} class:clip={level > 0.9} aria-label="Nivel">
      <div class="meter-fill" style="width: {Math.min(level * 100, 100)}%"></div>
    </div>
  </div>

  {#if expanded}
    <div class="channel-controls">
      <label class="slider-control">
        <span class="control-heading"><strong>Volumen</strong><output>{formatDb(volume)}</output></span>
        <input type="range" min="0" max="1" step="0.001" bind:value={volumeSliderValue} on:input={handleVolumeInput} aria-label={`Volumen de ${name}`} />
        <span class="scale"><span>-∞</span><span>0 dB</span><span>+10 dB</span></span>
      </label>

      {#if isMono}
        <label class="slider-control">
          <span class="control-heading"><strong>Paneo</strong><output>{panLabel()}</output></span>
          <input type="range" min="-1" max="1" step="0.01" bind:value={pan} on:input={handlePanInput} aria-label={`Paneo de ${name}`} />
          <span class="scale"><span>I</span><span>Centro</span><span>D</span></span>
        </label>
      {/if}
    </div>
  {/if}
</article>

<style>
  .channel-card { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-surface); }
  .channel-card.expanded { border-color: var(--bg-tertiary); }
  .card-summary { width: 100%; min-height: 50px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 9px; padding: 10px 12px 4px; background: none; color: var(--text-primary); text-align: left; }
  .channel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
  .summary-volume, .summary-pan { color: var(--text-secondary); font-size: 0.72rem; font-variant-numeric: tabular-nums; }
  .summary-volume { color: var(--text-primary); }
  .chevron { color: var(--accent); font-size: 1.1rem; }
  .quick-controls { display: flex; align-items: center; gap: 7px; padding: 3px 12px 11px; }
  .toggle { min-height: 36px; min-width: 56px; border-radius: 7px; background: var(--fader-track); color: var(--text-secondary); font-size: 0.75rem; font-weight: 800; }
  .toggle span { margin-left: 3px; font-size: 0.62rem; font-weight: 500; }
  .toggle.active.mute { background: var(--accent); color: #fff; }
  .toggle.active.solo { background: var(--vu-yellow); color: #161616; }
  .meter { height: 7px; flex: 1; overflow: hidden; border-radius: 7px; background: var(--fader-track); }
  .meter-fill { height: 100%; border-radius: inherit; background: var(--vu-green); transition: width 0.07s; }
  .meter.warn .meter-fill { background: var(--vu-yellow); }
  .meter.clip .meter-fill { background: var(--vu-red); }
  .channel-controls { display: grid; gap: 18px; padding: 13px 14px 17px; border-top: 1px solid var(--border); }
  .slider-control { display: grid; gap: 8px; }
  .control-heading, .scale { display: flex; justify-content: space-between; align-items: center; }
  .control-heading { font-size: 0.82rem; }
  output { color: var(--accent); font-variant-numeric: tabular-nums; }
  .scale { color: var(--text-secondary); font-size: 0.65rem; }
  input[type="range"] { width: 100%; height: 28px; }
  @media (max-width: 380px) {
    .toggle span { display: none; }
  }
</style>
