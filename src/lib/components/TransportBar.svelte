<script lang="ts">
  import { appState } from '../state/app.svelte'
  import { position, duration, playing, seek } from '../state/player.svelte'

  $: concert = $appState.concert
  $: markers = concert?.manifest?.markers ?? []

  let currentTime = 0
  let dur = 0
  let isPlaying = false

  $: currentTime = $position
  $: dur = $duration
  $: isPlaying = $playing

  import { togglePlay } from '../state/player.svelte'

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function handleSeek(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(ratio * dur)
  }

  function handleSeekKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
    }
  }

  function jumpToMarker(marker: { time: number }) {
    seek(marker.time)
  }
</script>

<div class="transport">
  <button class="transport-btn play" on:click={togglePlay}>
    {isPlaying ? '⏸' : '▶'}
  </button>

  <div
    class="transport-bar"
    role="button"
    tabindex="0"
    on:click={handleSeek}
    on:keydown={handleSeekKey}
  >
    <div class="bar-track">
      <div class="bar-fill" style="width: {(dur ? (currentTime / dur) * 100 : 0)}%"></div>
      {#each markers as marker}
        <button
          class="bar-marker"
          style="left: {(dur ? (marker.time / dur) * 100 : 0)}%"
          title={marker.name}
          on:click|stopPropagation={() => jumpToMarker(marker)}
        ></button>
      {/each}
    </div>
  </div>

  <span class="transport-time">{formatTime(currentTime)}</span>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
  }

  .transport-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .transport-bar {
    flex: 1;
    height: 32px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .bar-track {
    width: 100%;
    height: 8px;
    background: var(--fader-track);
    border-radius: 4px;
    position: relative;
    overflow: visible;
  }

  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.1s;
  }

  .bar-marker {
    position: absolute;
    top: -4px;
    width: 3px;
    height: 16px;
    background: var(--vu-yellow);
    border-radius: 2px;
    transform: translateX(-50%);
    cursor: pointer;
    z-index: 1;
    border: none;
    padding: 0;
  }

  .transport-time {
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex-shrink: 0;
    min-width: 48px;
    text-align: right;
  }
</style>
