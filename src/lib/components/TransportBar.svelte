<script lang="ts">
  import { onMount } from 'svelte'
  import { appState } from '../state/app.svelte'
  import { dbToGain, dbToSlider, formatDb, gainToDb, sliderToDb } from '../audio/levels'
  import { duration, masterVolume as masterVolumeState, playing, position, seek, setMasterVolume, togglePlay } from '../state/player.svelte'
  import { scheduleMixSave } from '../state/mixState'

  $: markers = $appState.concert?.manifest?.markers ?? []
  $: currentTime = $position
  $: dur = $duration
  $: isPlaying = $playing
  $: currentSong = markers.reduce((active, marker) => marker.time <= currentTime ? marker : active, markers[0])
  let masterVolume = 1
  $: masterVolume = $masterVolumeState

  onMount(() => {
    masterVolume = $appState.concert?.masterVolume ?? 1
  })

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function handleSeek(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * dur)
  }

  function handleSeekKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
    }
  }

  function handleMaster(value: number) {
    masterVolume = dbToGain(sliderToDb(value))
    setMasterVolume(masterVolume)
    scheduleMixSave()
  }
</script>

<footer class="transport">
  <button class="transport-btn play" aria-label={isPlaying ? 'Pausar' : 'Reproducir'} on:click={togglePlay}>
    {isPlaying ? '❚❚' : '▶'}
  </button>

  <div class="transport-main">
    <div class="transport-song">{currentSong?.name ?? 'Sin canción seleccionada'}</div>
    <div class="transport-progress" role="button" tabindex="0" aria-label="Posición de reproducción" on:click={handleSeek} on:keydown={handleSeekKey}>
      <div class="bar-track">
        <div class="bar-fill" style="width: {(dur ? (currentTime / dur) * 100 : 0)}%"></div>
        {#each markers as marker}
          <span class="bar-marker" style="left: {(dur ? (marker.time / dur) * 100 : 0)}%"></span>
        {/each}
      </div>
    </div>
    <div class="transport-time">{formatTime(currentTime)} / {formatTime(dur)}</div>
  </div>

  <label class="master-control">
    <span>Master</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={dbToSlider(gainToDb(masterVolume))}
      on:input={(e) => handleMaster(+e.currentTarget.value)}
      aria-label="Volumen master"
    />
    <strong>{formatDb(masterVolume)}</strong>
  </label>
</footer>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px max(10px, env(safe-area-inset-bottom));
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .transport-btn {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .transport-main { min-width: 0; flex: 1; }
  .transport-song { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78rem; font-weight: 700; }
  .transport-progress { height: 22px; display: flex; align-items: center; cursor: pointer; }
  .bar-track { position: relative; width: 100%; height: 6px; border-radius: 6px; background: var(--fader-track); }
  .bar-fill { height: 100%; border-radius: inherit; background: var(--accent); }
  .bar-marker { position: absolute; top: -2px; width: 2px; height: 10px; border-radius: 2px; background: var(--vu-yellow); }
  .transport-time { color: var(--text-secondary); font-size: 0.68rem; font-variant-numeric: tabular-nums; }

  .master-control { width: 96px; display: grid; gap: 3px; flex-shrink: 0; color: var(--text-secondary); font-size: 0.68rem; }
  .master-control strong { color: var(--text-primary); font-size: 0.7rem; font-weight: 600; }
  .master-control input { width: 100%; }

  @media (max-width: 380px) {
    .master-control { width: 78px; }
    .transport { gap: 7px; padding-left: 8px; padding-right: 8px; }
  }
</style>
