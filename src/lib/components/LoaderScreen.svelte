<script lang="ts">
  import type { ConcertManifest } from '../types'
  import { loadAudio, loadConcert, isStored, getStoredAudio, getStoredManifest } from '../state/persistence'
  import { initPlayer, getTrackCount } from '../state/player.svelte'
  import { applyMixFromState } from '../state/mixState'
  import { appState } from '../state/app.svelte'
  import type { TrackDef } from '../audio/engine'

  let hasStored = false
  let loading = false
  let error = ''

  async function checkStored() { hasStored = await isStored() }
  checkStored()

  async function fetchManifest(): Promise<ConcertManifest | null> {
    try {
      const resp = await fetch(import.meta.env.BASE_URL + 'concert.json')
      if (resp.ok) return await resp.json()
    } catch { /* sin manifest o sin conexion */ }
    return null
  }

  async function pickAudioFile() {
    const file = await pickFile('.opus,.ogg')
    if (!file) return
    loading = true
    error = ''
    try {
      const buffer = await file.arrayBuffer()
      const manifest = await fetchManifest()
      const trackDefs: TrackDef[] | undefined = manifest?.tracks
      await initPlayer(buffer, trackDefs)
      await loadAudio(buffer)
      await loadConcert(file, manifest, getTrackCount())
      applyMixFromState()
      appState.setPhase('ready')
    } catch (e: any) {
      error = e.message || 'Error al cargar el archivo'
    } finally {
      loading = false
    }
  }

  async function handleLoadStored() {
    loading = true
    error = ''
    try {
      const buffer = await getStoredAudio()
      if (!buffer) throw new Error('No hay audio guardado')
      const storedManifest = await getStoredManifest()
      await initPlayer(buffer, storedManifest?.tracks)
      await loadConcert(null, null, getTrackCount())
      applyMixFromState()
      appState.setPhase('ready')
    } catch (e: any) {
      error = e.message || 'Error al cargar datos guardados'
    } finally {
      loading = false
    }
  }

  function pickFile(accept: string): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.oncancel = () => resolve(null)
      input.click()
    })
  }
</script>

<div class="loader">
  <div class="loader-card">
    <h2>Cargar concierto</h2>
    {#if loading}
      <p class="loader-status">Cargando...</p>
    {:else}
      <p class="loader-desc">Selecciona el archivo .opus multicanal del concierto</p>
      <button class="loader-btn" on:click={pickAudioFile}>Seleccionar archivo</button>
      {#if hasStored}
        <button class="loader-btn secondary" on:click={handleLoadStored}>Abrir concierto anterior</button>
      {/if}
    {/if}
    {#if error}<p class="loader-error">{error}</p>{/if}
  </div>
</div>

<style>
  .loader { height: 100%; display: flex; align-items: center; justify-content: center; }
  .loader-card { text-align: center; padding: 2rem; }
  .loader-card h2 { margin-bottom: 0.5rem; }
  .loader-desc { color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem; }
  .loader-btn { display: block; width: 100%; max-width: 280px; margin: 0 auto 0.75rem; padding: 0.75rem 1.5rem; border-radius: var(--radius); background: var(--accent); color: white; font-size: 1rem; font-weight: 600; }
  .loader-btn.secondary { background: var(--bg-tertiary); }
  .loader-status { color: var(--text-secondary); }
  .loader-error { color: var(--accent); margin-top: 1rem; }
</style>
