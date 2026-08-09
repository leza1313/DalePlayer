<script lang="ts">
  import { trackCount } from '../state/player.svelte'
  import ChannelStrip from './ChannelStrip.svelte'
  import MasterStrip from './MasterStrip.svelte'

  $: totalTracks = $trackCount
</script>

{#if totalTracks > 0}
  <div class="mixer">
    <div class="channels-scroll">
      {#each { length: totalTracks } as _, i (i)}
        <ChannelStrip index={i} />
      {/each}
    </div>
    <MasterStrip />
  </div>
{/if}

<style>
  .mixer {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .channels-scroll {
    flex: 1;
    display: flex;
    overflow-x: auto;
    gap: 4px;
    padding: 8px;
  }
</style>
