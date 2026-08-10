<script lang="ts">
  import { appState } from './lib/state/app.svelte'
  import GateScreen from './lib/components/GateScreen.svelte'
  import LoaderScreen from './lib/components/LoaderScreen.svelte'
  import MixerView from './lib/components/MixerView.svelte'
  import TransportBar from './lib/components/TransportBar.svelte'
  import MarkerList from './lib/components/MarkerList.svelte'

  const state = appState
  $: phase = $state.phase
  $: notice = $state.notice
  let view: 'rehearsal' | 'mixer' = 'rehearsal'
</script>

<main class="app">
  {#if phase === 'locked'}
    <GateScreen />
  {:else if phase === 'loading'}
    <LoaderScreen />
  {:else if phase === 'ready'}
    <div class="mixer-layout">
      {#if view === 'rehearsal'}
        <MarkerList on:openMixer={() => view = 'mixer'} />
      {:else}
        <MixerView on:closeMixer={() => view = 'rehearsal'} />
      {/if}
      <TransportBar />
    </div>
  {/if}
  {#if notice}
    <div class="app-notice" role="status">{notice}</div>
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

  .app-notice {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    max-width: min(90vw, 560px);
    padding: 0.7rem 1rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--bg-secondary);
    color: var(--text-primary);
    text-align: center;
    z-index: 10;
  }

  @media (max-width: 600px) {
    .mixer-layout {
      min-height: 0;
    }
  }
</style>
