<script lang="ts">
  import { appState } from './lib/state/app.svelte'
  import GateScreen from './lib/components/GateScreen.svelte'
  import LoaderScreen from './lib/components/LoaderScreen.svelte'
  import MixerView from './lib/components/MixerView.svelte'
  import TransportBar from './lib/components/TransportBar.svelte'
  import MarkerList from './lib/components/MarkerList.svelte'

  const state = appState
  $: phase = $state.phase
</script>

<main class="app">
  {#if phase === 'locked'}
    <GateScreen />
  {:else if phase === 'loading'}
    <LoaderScreen />
  {:else if phase === 'ready'}
    <div class="mixer-layout">
      <MixerView />
      <TransportBar />
    </div>
    <MarkerList />
  {/if}
</main>

<style>
  .app {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .mixer-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
