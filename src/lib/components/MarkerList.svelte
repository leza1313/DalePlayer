<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { appState } from '../state/app.svelte'
  import { playing, position, seek, togglePlay } from '../state/player.svelte'

  const dispatch = createEventDispatcher<{ openMixer: void }>()

  $: concert = $appState.concert
  $: markers = concert?.manifest?.markers ?? []
  $: currentPosition = $position
  $: isPlaying = $playing
  $: activeIndex = markers.reduce((active, marker, index) =>
    marker.time <= currentPosition ? index : active, 0)

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  async function playMarker(time: number) {
    await seek(time)
    if (!$playing) togglePlay()
  }
</script>

<section class="rehearsal-view">
  <header class="rehearsal-header">
    <div class="rehearsal-header-inner">
      <div>
        <p class="eyebrow">Ensayo</p>
        <h1>{$appState.concert?.manifest?.title ?? 'Setlist'}</h1>
      </div>
      <button class="mixer-button" on:click={() => dispatch('openMixer')}>Mezclador</button>
    </div>
  </header>

  {#if markers.length > 0}
    <div class="setlist" aria-label="Setlist">
      {#each markers as marker, index}
        <button
          class="song-row"
          class:current={index === activeIndex}
          on:click={() => playMarker(marker.time)}
        >
          <span class="song-index">{String(index + 1).padStart(2, '0')}</span>
          <span class="song-copy">
            <span class="song-name">{marker.name}</span>
            <span class="song-time">{formatTime(marker.time)}</span>
          </span>
          {#if index === activeIndex && isPlaying}
            <span class="playing-indicator" aria-label="Reproduciendo">●</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty-setlist">
      <strong>Sin canciones marcadas</strong>
      <span>Usa el mezclador para preparar tu escucha.</span>
    </div>
  {/if}
</section>

<style>
  .rehearsal-view {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 16px 26px;
    background: radial-gradient(circle at 15% 0%, rgba(184, 134, 36, 0.08), transparent 34%);
  }

  .rehearsal-header {
    position: sticky;
    top: 0;
    z-index: 2;
    margin: 0 -16px 22px;
    padding: 22px 16px 12px;
    background: var(--bg-primary);
    border-bottom: 1px solid rgba(48, 55, 62, 0.8);
  }

  .rehearsal-header-inner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    max-width: 720px;
    margin: 0 auto;
  }

  .eyebrow {
    color: #c39a43;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  h1 {
    color: var(--text-primary);
    font-size: clamp(1.35rem, 5vw, 2rem);
    line-height: 1.1;
  }

  .mixer-button {
    min-height: 42px;
    padding: 0 14px;
    border: 1px solid rgba(184, 134, 36, 0.65);
    border-radius: 8px;
    background: var(--accent-soft);
    color: #e2d4ad;
    font-size: 0.78rem;
    font-weight: 700;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .mixer-button:active { background: var(--accent); border-color: var(--accent-hover); color: #171717; }

  .setlist { max-width: 720px; margin: 0 auto; }

  .song-row {
    width: 100%;
    min-height: 70px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    margin-bottom: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: linear-gradient(105deg, var(--bg-surface), #1a2026);
    color: var(--text-primary);
    text-align: left;
  }

  .song-row.current {
    border-color: rgba(184, 134, 36, 0.68);
    background: linear-gradient(90deg, var(--accent-soft), var(--bg-surface));
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .song-index {
    width: 28px;
    color: var(--text-secondary);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }

  .song-copy {
    min-width: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
  }

  .song-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; letter-spacing: 0.01em; }
  .song-time { color: var(--text-secondary); font-size: 0.78rem; }
  .playing-indicator { color: var(--accent); font-size: 1.1rem; }

  .empty-setlist {
    display: grid;
    gap: 8px;
    max-width: 720px;
    margin: 48px auto;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-setlist strong { color: var(--text-primary); }
</style>
