<script lang="ts">
  import { appState } from '../state/app.svelte'
  import { seek } from '../state/player.svelte'

  $: concert = $appState.concert
  $: markers = concert?.manifest?.markers ?? []

  let expanded = false

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function jumpTo(marker: { time: number }) {
    seek(marker.time)
  }
</script>

{#if markers.length > 0}
  <div class="marker-list" class:expanded>
    <button class="marker-toggle" on:click={() => expanded = !expanded}>
      Canciones ({markers.length})
      <span class="toggle-arrow">{expanded ? '▼' : '▲'}</span>
    </button>
    {#if expanded}
      <div class="marker-items">
        {#each markers as marker}
          <button
            class="marker-item"
            on:click={() => jumpTo(marker)}
          >
            <span class="marker-name">{marker.name}</span>
            <span class="marker-time">{formatTime(marker.time)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .marker-list {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    max-height: 32px;
    overflow: hidden;
    transition: max-height 0.2s;
  }

  .marker-list.expanded {
    max-height: 50vh;
    overflow-y: auto;
  }

  .marker-toggle {
    width: 100%;
    padding: 6px 12px;
    background: none;
    color: var(--text-secondary);
    font-size: 0.8rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .toggle-arrow {
    font-size: 0.65rem;
  }

  .marker-items {
    padding: 0 4px 4px;
  }

  .marker-item {
    width: 100%;
    padding: 8px 12px;
    background: none;
    color: var(--text-primary);
    font-size: 0.85rem;
    text-align: left;
    display: flex;
    justify-content: space-between;
    border-radius: 4px;
  }

  .marker-item:hover {
    background: var(--fader-track);
  }

  .marker-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .marker-time {
    color: var(--text-secondary);
    margin-left: 8px;
    flex-shrink: 0;
  }
</style>
