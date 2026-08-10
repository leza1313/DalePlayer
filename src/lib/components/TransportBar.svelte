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
  $: currentSongIndex = markers.reduce((active, marker, index) => marker.time <= currentTime ? index : active, -1)
  $: currentSong = currentSongIndex >= 0 ? markers[currentSongIndex] : undefined
  $: songStart = currentSong?.time ?? 0
  $: songEnd = currentSongIndex >= 0
    ? (markers[currentSongIndex + 1]?.time ?? dur)
    : dur
  $: songDuration = Math.max(0, songEnd - songStart)
  $: songPosition = Math.max(0, Math.min(songDuration, currentTime - songStart))
  $: songProgress = songDuration > 0 ? (songPosition / songDuration) * 100 : 0
  let masterVolume = 1
  $: masterVolume = $masterVolumeState
  $: masterSliderValue = dbToSlider(gainToDb(masterVolume))
  let showSongs = false

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
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(songStart + ratio * songDuration)
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

  async function selectSong(index: number) {
    const marker = markers[index]
    if (!marker) return
    await seek(marker.time)
    if (!$playing) togglePlay()
    showSongs = false
  }

  function goPrevious() {
    if (currentSongIndex > 0) {
      selectSong(currentSongIndex - 1)
    } else if (markers[0]) {
      selectSong(0)
    }
  }

  function goNext() {
    if (currentSongIndex >= 0 && currentSongIndex < markers.length - 1) {
      selectSong(currentSongIndex + 1)
    }
  }
</script>

<footer class="transport">
  <button class="song-nav" on:click={goPrevious} disabled={markers.length === 0} aria-label="Canción anterior">
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3L5 8l5 5" /></svg>
  </button>
  <button class="transport-btn play" aria-label={isPlaying ? 'Pausar' : 'Reproducir'} on:click={togglePlay}>
    {isPlaying ? '❚❚' : '▶'}
  </button>

  <div class="transport-main">
    <button class="transport-song" on:click={() => showSongs = true} disabled={markers.length === 0}>
      <span>{currentSong?.name ?? 'Sin canción seleccionada'}</span>
      {#if markers.length > 0}
        <span class="song-picker-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v8M6 10h8" />
          </svg>
        </span>
      {/if}
    </button>
    <div class="transport-progress" role="button" tabindex="0" aria-label="Posición de reproducción" on:click={handleSeek} on:keydown={handleSeekKey}>
      <div class="bar-track">
        <div class="bar-fill" style="width: {songProgress}%"></div>
      </div>
    </div>
    <div class="transport-time">{formatTime(songPosition)} / {formatTime(songDuration)}</div>
  </div>

  <button class="song-nav" on:click={goNext} disabled={markers.length === 0 || currentSongIndex >= markers.length - 1} aria-label="Siguiente canción">
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3l5 5-5 5" /></svg>
  </button>

  <label class="master-control">
    <span>Master</span>
    <input
      class="master-slider"
      style={`--range-progress: ${masterSliderValue * 100}%`}
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={masterSliderValue}
      on:input={(e) => handleMaster(+e.currentTarget.value)}
      aria-label="Volumen master"
    />
    <strong>{formatDb(masterVolume)}</strong>
  </label>
</footer>

{#if showSongs}
  <div class="song-sheet-layer">
    <button class="sheet-backdrop" aria-label="Cerrar canciones" on:click={() => showSongs = false}></button>
    <section class="song-sheet" aria-label="Seleccionar canción">
      <div class="sheet-header">
        <div><span class="sheet-eyebrow">Navegación</span><h2>Canciones</h2></div>
        <button class="sheet-close" aria-label="Cerrar" on:click={() => showSongs = false}>×</button>
      </div>
      <div class="sheet-list">
        {#each markers as marker, index}
          <button class="sheet-song" class:current={index === currentSongIndex} on:click={() => selectSong(index)}>
            <span class="sheet-index">{String(index + 1).padStart(2, '0')}</span>
            <span class="sheet-name">{marker.name}</span>
            <span class="sheet-time">{formatTime(marker.time)}</span>
          </button>
        {/each}
      </div>
    </section>
  </div>
{/if}

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 12px max(10px, env(safe-area-inset-bottom));
    background: rgba(23, 27, 33, 0.97);
    border-top: 1px solid var(--border);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
    flex-shrink: 0;
  }

  .transport-btn {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 3px 10px rgba(184, 134, 36, 0.25);
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .song-nav { min-width: 38px; height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; border: 1px solid var(--border); border-radius: 7px; background: #252c32; color: #c3c7c5; }
  .song-nav svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
  .song-nav:active:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); color: #ead8a5; }
  .song-nav:disabled { cursor: default; opacity: 0.35; }

  .transport-main { min-width: 0; flex: 1; }
  .transport-song { width: 100%; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; overflow: hidden; background: none; color: #e2d4ad; font-size: 0.78rem; font-weight: 700; text-align: left; }
  .transport-song span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .song-picker-icon { display: inline-flex; align-items: center; justify-content: center; width: 21px; height: 21px; flex-shrink: 0; color: var(--accent-hover); }
  .song-picker-icon svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.6; transition: transform 180ms ease, color 180ms ease; }
  .transport-song:active .song-picker-icon svg { transform: scale(0.9); color: #ead8a5; }
  .transport-progress { height: 22px; display: flex; align-items: center; cursor: pointer; }
  .bar-track { position: relative; width: 100%; height: 6px; border-radius: 6px; background: var(--fader-track); }
  .bar-fill { height: 100%; border-radius: inherit; background: var(--accent); box-shadow: 0 0 7px rgba(184, 134, 36, 0.35); }
  .transport-time { color: var(--text-secondary); font-size: 0.68rem; font-variant-numeric: tabular-nums; }

  .master-control { width: 96px; display: grid; gap: 3px; flex-shrink: 0; color: var(--text-secondary); font-size: 0.68rem; }
  .master-control span { color: #c39a43; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .master-control strong { color: var(--text-primary); font-size: 0.7rem; font-weight: 600; }
  .master-control input { width: 100%; }
  .master-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, var(--fader-fill) 0%, var(--fader-fill) var(--range-progress), var(--fader-track) var(--range-progress), var(--fader-track) 100%); }
  .master-slider::-moz-range-track { background: linear-gradient(to right, var(--fader-fill) 0%, var(--fader-fill) var(--range-progress), var(--fader-track) var(--range-progress), var(--fader-track) 100%); }

  @media (max-width: 380px) {
    .master-control { width: 78px; }
    .song-nav { min-width: 34px; padding: 0 3px; }
    .transport { gap: 7px; padding-left: 8px; padding-right: 8px; }
  }

  .song-sheet-layer { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; }
  .sheet-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; background: rgba(4, 6, 8, 0.62); }
  .song-sheet { position: relative; width: 100%; max-height: min(76vh, 620px); overflow: hidden; padding: 18px 14px max(14px, env(safe-area-inset-bottom)); border-top: 1px solid rgba(184, 134, 36, 0.55); border-radius: 16px 16px 0 0; background: #1b2025; box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.35); animation: sheet-in 180ms ease-out; }
  .sheet-header { display: flex; align-items: center; justify-content: space-between; max-width: 720px; margin: 0 auto 12px; }
  .sheet-eyebrow { color: #c39a43; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  h2 { margin-top: 3px; font-size: 1.2rem; }
  .sheet-close { width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 50%; background: #252c32; color: var(--text-secondary); font-size: 1.3rem; line-height: 1; }
  .sheet-list { max-width: 720px; max-height: calc(min(76vh, 620px) - 90px); overflow-y: auto; margin: 0 auto; }
  .sheet-song { width: 100%; min-height: 52px; display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: transparent; color: var(--text-primary); text-align: left; }
  .sheet-song.current { border-radius: 7px; background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
  .sheet-index, .sheet-time { color: var(--text-secondary); font-size: 0.72rem; font-variant-numeric: tabular-nums; }
  .sheet-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; }
  @keyframes sheet-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
</style>
