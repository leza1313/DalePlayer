<script lang="ts">
  import { unlock } from '../state/auth'
  import { isUnlocked } from '../state/auth'
  import { appState } from '../state/app.svelte'
  import { onMount } from 'svelte'

  let password = ''
  let error = ''

  onMount(() => {
    if (isUnlocked()) {
      appState.setPhase('loading')
    }
  })

  function handleSubmit() {
    if (!password.trim()) return
    if (unlock(password.trim())) {
      appState.setPhase('loading')
      error = ''
    } else {
      error = 'Contraseña incorrecta'
      password = ''
    }
  }
</script>

<div class="gate">
  <div class="gate-card">
    <h1 class="gate-title">DalePlayer</h1>
    <p class="gate-subtitle">Mezclador multipista</p>
    <form on:submit|preventDefault={handleSubmit} class="gate-form">
      <input
        type="password"
        bind:value={password}
        placeholder="Contraseña"
        class="gate-input"
        autocomplete="off"
        enterkeyhint="done"
      />
      {#if error}
        <p class="gate-error">{error}</p>
      {/if}
      <button type="submit" class="gate-btn">Entrar</button>
    </form>
  </div>
</div>

<style>
  .gate {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
  }

  .gate-card {
    text-align: center;
    padding: 2rem;
  }

  .gate-title {
    font-size: 2.5rem;
    color: var(--accent);
    margin-bottom: 0.25rem;
  }

  .gate-subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin-bottom: 2rem;
  }

  .gate-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .gate-input {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    width: 240px;
    text-align: center;
    outline: none;
  }

  .gate-input:focus {
    border-color: var(--accent);
  }

  .gate-btn {
    padding: 0.75rem 2rem;
    border-radius: var(--radius);
    background: var(--accent);
    color: white;
    font-size: 1rem;
    font-weight: 600;
  }

  .gate-btn:hover {
    background: var(--accent-hover);
  }

  .gate-error {
    color: var(--accent);
    font-size: 0.875rem;
  }
</style>
