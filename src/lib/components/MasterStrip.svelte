<script lang="ts">
  import { setMasterVolume, getMasterLevel, resetMix } from '../state/player.svelte'
  import { scheduleMixSave } from '../state/mixState'
  import { appState } from '../state/app.svelte'
  import { onDestroy, onMount } from 'svelte'

  let masterVolume = 0.8
  let level = 0
  let vuInterval: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    const concert = $appState.concert
    if (concert) {
      masterVolume = concert.masterVolume ?? 0.8
    }
  })

  onDestroy(() => {
    if (vuInterval !== null) clearInterval(vuInterval)
  })

  vuInterval = setInterval(() => {
    level = getMasterLevel()
  }, 50)

  function handleVolume(v: number) {
    masterVolume = v
    setMasterVolume(v)
    scheduleMixSave()
  }

  function handleReset() {
    resetMix()
    masterVolume = 0.8
    scheduleMixSave()
  }
</script>

<div class="strip master">
  <div class="strip-header">
    <span class="strip-name">Master</span>
  </div>

  <div class="strip-fader">
    <div class="fader-wrap">
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={masterVolume}
        on:input={(e) => handleVolume(+e.currentTarget.value)}
      />
    </div>
  </div>

  <div class="master-vu">
    <div class="vu-meter large" class:vuwarn={level > 0.7} class:vuclip={level > 0.9}>
      <div class="vu-fill" style="height: {Math.min(level * 100, 100)}%"></div>
    </div>
  </div>

  <button class="btn-reset" on:click={handleReset} title="Restablecer mezcla">
    ↺
  </button>
</div>

<style>
  .strip {
    width: 72px;
    min-width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg-surface);
    border-radius: var(--radius);
    padding: 6px 4px;
    gap: 4px;
    margin-left: 8px;
    border-left: 2px solid var(--accent);
  }

  .strip-header {
    width: 100%;
    text-align: center;
  }

  .strip-name {
    font-size: 0.7rem;
    color: var(--accent);
    font-weight: 700;
  }

  .strip-fader {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 0;
    overflow: visible;
  }

  .fader-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .fader-wrap input[type="range"] {
    transform: rotate(-90deg);
    width: 150px;
    height: 6px;
  }

  .master-vu {
    padding: 4px 0;
  }

  .vu-meter {
    width: 8px;
    height: 60px;
    background: var(--fader-track);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .vu-meter.large {
    width: 12px;
    height: 80px;
  }

  .vu-fill {
    width: 100%;
    background: var(--vu-green);
    border-radius: 4px;
    transition: height 0.05s ease;
  }

  .vu-meter.vuwarn .vu-fill {
    background: var(--vu-yellow);
  }

  .vu-meter.vuclip .vu-fill {
    background: var(--vu-red);
  }

  .btn-reset {
    margin-top: 8px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--fader-track);
    color: var(--text-secondary);
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-reset:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
</style>
