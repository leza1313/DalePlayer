<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { trackCount } from '../state/player.svelte'
  import ChannelStrip from './ChannelStrip.svelte'
  import MasterStrip from './MasterStrip.svelte'

  const dispatch = createEventDispatcher<{ closeMixer: void }>()
  $: totalTracks = $trackCount
</script>

<section class="mixer-view">
  <header class="mixer-header">
    <button class="back-button" on:click={() => dispatch('closeMixer')}>‹ Setlist</button>
    <div>
      <p class="eyebrow">Preparar mezcla</p>
      <h1>Mezclador</h1>
    </div>
  </header>

  {#if totalTracks > 0}
    <div class="channels-list">
      {#each { length: totalTracks } as _, i (i)}
        <ChannelStrip index={i} />
      {/each}
      <MasterStrip />
    </div>
  {/if}
</section>

<style>
  .mixer-view { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 12px 24px; }
  .mixer-header { max-width: 720px; margin: 0 auto 16px; display: flex; align-items: center; gap: 14px; }
  .back-button { min-height: 44px; padding: 0 4px; background: none; color: var(--accent); font-weight: 700; }
  .eyebrow { color: var(--accent); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 3px; }
  h1 { font-size: 1.35rem; }
  .channels-list { max-width: 720px; margin: 0 auto; display: grid; gap: 8px; }
</style>
