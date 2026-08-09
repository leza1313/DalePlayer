<script lang="ts">
  export let index: number

  import { appState } from '../state/app.svelte'
  import {
    setTrackVolume, setTrackPan, setTrackMute, setTrackSolo,
    getTrackLevel
  } from '../state/player.svelte'
  import { onDestroy, onMount } from 'svelte'
  import { scheduleMixSave } from '../state/mixState'

  $: concert = $appState.concert
  $: track = concert?.manifest?.tracks[index]
  $: name = track?.name ?? `Canal ${index + 1}`
  $: isStereo = (track?.channels.length ?? 0) === 2

  let volume = 0.8
  let pan = 0
  let muted = false
  let solo = false
  let level = 0

  let vuInterval: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    // Restore stored mix values
    const concert = $appState.concert
    if (concert?.tracks[index]) {
      volume = concert.tracks[index].volume
      pan = concert.tracks[index].pan
      muted = concert.tracks[index].mute
      solo = concert.tracks[index].solo
    }
  })

  onDestroy(() => {
    if (vuInterval !== null) clearInterval(vuInterval)
  })

  // Poll VU meter
  vuInterval = setInterval(() => {
    level = getTrackLevel(index)
  }, 50)

  function handleVolume(v: number) {
    volume = v
    setTrackVolume(index, v)
    scheduleMixSave()
  }

  function handlePan(v: number) {
    pan = v
    setTrackPan(index, v)
    scheduleMixSave()
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
</script>

<div class="strip" class:stereo={isStereo}>
  <div class="strip-header">
    <span class="strip-name" title={name}>{name}</span>
  </div>

  <div class="strip-fader">
    <div class="fader-wrap">
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={volume}
        on:input={(e) => handleVolume(+e.currentTarget.value)}
      />
    </div>
  </div>

  <div class="strip-pan">
    <input
      type="range"
      min="-1"
      max="1"
      step="0.01"
      bind:value={pan}
      on:input={(e) => handlePan(+e.currentTarget.value)}
    />
  </div>

  <div class="strip-buttons">
    <button class="btn-mute" class:active={muted} on:click={toggleMute}>M</button>
    <button class="btn-solo" class:active={solo} on:click={toggleSolo}>S</button>
  </div>

  <div class="vu-meter" class:vuwarn={level > 0.7} class:vuclip={level > 0.9}>
    <div class="vu-fill" style="height: {Math.min(level * 100, 100)}%"></div>
  </div>
</div>

<style>
  .strip {
    width: 72px;
    min-width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg-surface);
    border-radius: var(--radius);
    padding: 6px 4px;
    gap: 4px;
  }

  .strip-header {
    width: 100%;
    text-align: center;
    overflow: hidden;
  }

  .strip-name {
    font-size: 0.7rem;
    white-space: nowrap;
    color: var(--text-secondary);
  }

  .strip-fader {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 0;
    overflow: visible;
  }

  .fader-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .fader-wrap input[type="range"] {
    transform: rotate(-90deg);
    width: 140px;
    height: 6px;
  }

  .strip-pan input[type="range"] {
    width: 100%;
    height: 4px;
  }

  .strip-pan {
    width: 100%;
    padding: 0 4px;
  }

  .strip-buttons {
    display: flex;
    gap: 4px;
  }

  .btn-mute,
  .btn-solo {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    background: var(--fader-track);
    color: var(--text-secondary);
  }

  .btn-mute.active {
    background: var(--accent);
    color: white;
  }

  .btn-solo.active {
    background: #e9b143;
    color: #000;
  }

  .vu-meter {
    width: 8px;
    height: 40px;
    background: var(--fader-track);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .vu-fill {
    width: 100%;
    background: var(--vu-green);
    border-radius: 4px;
    transition: height 0.05s;
  }

  .vu-meter.vuwarn .vu-fill {
    background: var(--vu-yellow);
  }

  .vu-meter.vuclip .vu-fill {
    background: var(--vu-red);
  }

  .stereo .strip-name {
    color: var(--accent);
  }
</style>
