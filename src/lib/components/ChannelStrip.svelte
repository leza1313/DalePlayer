<script lang="ts">
  export let index: number

  import { onDestroy, onMount } from 'svelte'
  import { appState } from '../state/app.svelte'
  import { dbToGain, dbToSlider, formatDb, gainToDb, snapPanValue, snapVolumeSlider, triggerReferenceHaptic } from '../audio/levels'
  import {
    focusTrack, getMixState, getTrackLevel, mixReset, setTrackFocus,
    setTrackMute, setTrackPan, setTrackSolo, setTrackVolume
  } from '../state/player.svelte'
  import { scheduleMixSave } from '../state/mixState'

  $: concert = $appState.concert
  $: track = concert?.manifest?.tracks[index]
  $: name = track?.name ?? `Canal ${index + 1}`
  $: isMono = (track?.channels.length ?? 1) === 1
  $: focused = $focusTrack === index
  $: panText = panSliderValue === 0
    ? 'Centro'
    : `${panSliderValue < 0 ? 'I' : 'D'} ${Math.round(Math.abs(panSliderValue) * 100)}`

  let volume = 1
  let volumeSliderValue = 1
  let pan = 0
  let panSliderValue = 0
  let volumeReferenceLocked = false
  let panReferenceLocked = false
  let muted = false
  let solo = false
  let level = 0
  let expanded = false
  let resetVersion = 0
  let vuInterval: ReturnType<typeof setInterval> | null = null

  $: if ($mixReset !== resetVersion) {
    resetVersion = $mixReset
    volumeReferenceLocked = false
    panReferenceLocked = false
    const state = getMixState()[index]
    if (state) {
      volume = state.volume
      volumeSliderValue = dbToSlider(gainToDb(state.volume))
      pan = state.pan
      panSliderValue = state.pan
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
      panSliderValue = stored.pan
      muted = stored.mute
      solo = stored.solo
    }
    vuInterval = setInterval(() => { level = getTrackLevel(index) }, 70)
  })

  onDestroy(() => {
    if (vuInterval !== null) clearInterval(vuInterval)
  })

  function handleVolumeSlider(value: number) {
    const snapped = snapVolumeSlider(value)
    if (snapped.snapped && !volumeReferenceLocked) triggerReferenceHaptic()
    volumeReferenceLocked = snapped.snapped
    volumeSliderValue = snapped.slider
    volume = snapped.gain
    setTrackVolume(index, volume)
    scheduleMixSave()
  }

  function handleVolumeInput(event: Event) {
    handleVolumeSlider(Number((event.currentTarget as HTMLInputElement).value))
  }

  function handlePan(value: number) {
    const snapped = snapPanValue(value)
    if (snapped.snapped && !panReferenceLocked) triggerReferenceHaptic()
    panReferenceLocked = snapped.snapped
    panSliderValue = snapped.value
    pan = snapped.value
    setTrackPan(index, snapped.value)
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

  function toggleFocus() {
    setTrackFocus(index, !focused)
  }

</script>

<article class="channel-card" class:expanded>
  <button class="card-summary" on:click={() => expanded = !expanded} aria-expanded={expanded}>
    <span class="channel-name">{name}</span>
    <span class="summary-volume">{formatDb(volume)}</span>
    <span class="summary-pan">{isMono ? panText : 'Estéreo'}</span>
    <span class="chevron" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M3 6l5 5 5-5" />
      </svg>
    </span>
  </button>

  <div class="quick-controls">
    <button class="toggle mute" class:active={muted} on:click={toggleMute} aria-pressed={muted}>M <span>Mute</span></button>
    <button class="toggle solo" class:active={solo} on:click={toggleSolo} aria-pressed={solo}>S <span>Solo</span></button>
    <button class="toggle focus" class:active={focused} on:click={toggleFocus} aria-pressed={focused} title="Focus: bajar el resto 8 dB">F <span>Focus</span></button>
    <div class="meter" class:warn={level > 0.7} class:clip={level > 0.9} aria-label="Nivel">
      <div class="meter-fill" style="width: {Math.min(level * 100, 100)}%"></div>
    </div>
  </div>

  {#if expanded}
    <div class="channel-controls">
      <label class="slider-control">
        <span class="control-heading"><strong>Volumen</strong><output>{formatDb(volume)}</output></span>
        <span class="slider-visual">
          <input class="volume-slider" style={`--range-progress: ${volumeSliderValue * 100}%`} type="range" min="0" max="1" step="0.001" value={volumeSliderValue} on:input={handleVolumeInput} aria-label={`Volumen de ${name}`} />
          <span class="reference-marker volume-reference" aria-hidden="true"></span>
        </span>
        <span class="scale"><span>-∞</span><span>0 dB</span><span>+10 dB</span></span>
      </label>

      {#if isMono}
        <label class="slider-control">
          <span class="control-heading"><strong>Paneo</strong><output>{panText}</output></span>
          <span class="slider-visual">
            <input class="pan-slider" type="range" min="-1" max="1" step="0.01" value={panSliderValue} on:input={handlePanInput} aria-label={`Paneo de ${name}`} />
            <span class="reference-marker pan-reference" aria-hidden="true"></span>
          </span>
          <span class="scale"><span>I</span><span>Centro</span><span>D</span></span>
        </label>
      {/if}
    </div>
  {/if}
</article>

<style>
  .channel-card { overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: linear-gradient(135deg, var(--bg-surface), #1a2026); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease; }
  .channel-card.expanded { border-color: rgba(184, 134, 36, 0.62); background: linear-gradient(135deg, var(--bg-surface-raised), var(--bg-surface)); box-shadow: 0 7px 22px rgba(0, 0, 0, 0.22), inset 3px 0 0 var(--accent); }
  .card-summary { width: 100%; min-height: 54px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 10px; padding: 10px 13px 5px; background: none; color: var(--text-primary); text-align: left; }
  .card-summary:active { background: rgba(255, 255, 255, 0.03); }
  .channel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; letter-spacing: 0.01em; }
  .summary-volume, .summary-pan { color: var(--text-secondary); font-size: 0.72rem; font-variant-numeric: tabular-nums; }
  .summary-volume { color: #dfc47f; }
  .chevron { display: inline-flex; align-items: center; justify-content: center; color: var(--accent); transition: color 180ms ease; }
  .chevron svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; transition: transform 180ms ease; }
  .channel-card.expanded .chevron { color: var(--accent-hover); }
  .channel-card.expanded .chevron svg { transform: rotate(180deg); }
  .quick-controls { display: flex; align-items: center; gap: 8px; padding: 3px 13px 12px; }
  .toggle { min-height: 36px; min-width: 58px; border: 1px solid transparent; border-radius: 7px; background: #2b3239; color: var(--text-secondary); font-size: 0.75rem; font-weight: 800; transition: background 150ms ease, border-color 150ms ease, color 150ms ease; }
  .toggle span { margin-left: 3px; font-size: 0.62rem; font-weight: 500; }
  .toggle.active.mute { background: #8c3e42; border-color: #bd4b4b; color: #fff; }
  .toggle.active.solo { background: #b88b2d; border-color: var(--vu-yellow); color: #171717; }
  .toggle.active.focus { background: #4c7b72; border-color: var(--vu-green); color: #fff; }
  .meter { height: 7px; flex: 1; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 7px; background: #11161a; }
  .meter-fill { height: 100%; border-radius: inherit; background: var(--vu-green); transition: width 0.07s; }
  .meter.warn .meter-fill { background: var(--vu-yellow); }
  .meter.clip .meter-fill { background: var(--vu-red); }
  .channel-controls { display: grid; gap: 18px; padding: 15px 14px 18px; border-top: 1px solid rgba(184, 134, 36, 0.2); animation: reveal 180ms ease-out; }
  .slider-control { display: grid; gap: 8px; }
  .control-heading, .scale { display: flex; justify-content: space-between; align-items: center; }
  .control-heading { color: var(--text-secondary); font-size: 0.78rem; letter-spacing: 0.02em; }
  .control-heading strong { color: var(--text-primary); font-weight: 650; }
  output { color: #dfc47f; font-variant-numeric: tabular-nums; }
  .scale { position: relative; color: var(--text-secondary); font-size: 0.65rem; }
  .scale span:nth-child(2) { position: absolute; left: 85.714%; transform: translateX(-50%); }
  .slider-visual { position: relative; display: block; }
  input[type="range"] { position: relative; z-index: 1; width: 100%; height: 28px; }
  .reference-marker { position: absolute; z-index: 2; top: 50%; width: 2px; height: 12px; border-radius: 2px; background: rgba(238, 233, 220, 0.55); pointer-events: none; transform: translate(-50%, -50%); }
  .volume-reference { left: 85.714%; }
  .pan-reference { left: 50%; height: 16px; background: rgba(215, 218, 218, 0.55); }
  .volume-slider { accent-color: var(--fader-fill); }
  .volume-slider::-webkit-slider-runnable-track {
    background: linear-gradient(to right, var(--fader-fill) 0%, var(--fader-fill) var(--range-progress), var(--fader-track) var(--range-progress), var(--fader-track) 100%);
  }
  .volume-slider::-moz-range-track {
    background: linear-gradient(to right, var(--fader-fill) 0%, var(--fader-fill) var(--range-progress), var(--fader-track) var(--range-progress), var(--fader-track) 100%);
  }
  .pan-slider {
    accent-color: var(--pan-fill);
  }
  .pan-slider::-webkit-slider-runnable-track {
    height: 5px;
    background: #41494c;
  }
  .pan-slider::-webkit-slider-thumb {
    width: 4px;
    height: 25px;
    margin-top: -10px;
    border: 0;
    border-radius: 2px;
    background: #d7dada;
    box-shadow: 0 0 0 2px rgba(174, 180, 180, 0.16), 0 1px 5px rgba(0, 0, 0, 0.5);
  }
  .pan-slider::-moz-range-track {
    height: 5px;
    background: #41494c;
  }
  .pan-slider::-moz-range-thumb {
    width: 4px;
    height: 25px;
    border: 0;
    border-radius: 2px;
    background: #d7dada;
    box-shadow: 0 0 0 2px rgba(174, 180, 180, 0.16), 0 1px 5px rgba(0, 0, 0, 0.5);
  }
  @keyframes reveal { from { opacity: 0.65; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 380px) {
    .toggle span { display: none; }
  }
</style>
