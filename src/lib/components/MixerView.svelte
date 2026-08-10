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
  .mixer-view { flex: 1; min-height: 0; overflow-y: auto; padding: 17px 12px 26px; background: radial-gradient(circle at 80% 0%, rgba(184, 134, 36, 0.07), transparent 34%); }
  .mixer-header { max-width: 720px; margin: 0 auto 18px; display: flex; align-items: center; gap: 15px; }
  .back-button { min-height: 42px; padding: 0 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-surface); color: #d4b968; font-size: 0.78rem; font-weight: 700; }
  .back-button:active { background: var(--accent-soft); border-color: var(--accent); }
  .eyebrow { color: #c39a43; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 3px; }
  h1 { color: var(--text-primary); font-size: 1.4rem; letter-spacing: -0.02em; }
  .channels-list { max-width: 720px; margin: 0 auto; display: grid; gap: 8px; }
</style>
