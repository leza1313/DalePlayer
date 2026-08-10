<script lang="ts">
  import type { ConcertManifest } from '../types'
  import { loadAudio, loadConcert, isStored, getStoredAudio, getStoredManifest } from '../state/persistence'
  import { initPlayer, getTrackCount } from '../state/player.svelte'
  import { applyMixFromState } from '../state/mixState'
  import { appState } from '../state/app.svelte'
  import type { TrackDef } from '../audio/engine'
  import type { AudioSourceDescriptor } from '../audio/source'

  let hasStored = false
  let loading = false
  let error = ''
  let progress = 0
  let progressStage = ''
  let loadingMode: 'file' | 'stored' = 'file'

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
    progress = 0
    progressStage = 'Preparando archivo...'
    loadingMode = 'file'
    appState.setNotice(null)
    try {
      const manifest = await fetchManifest()
      const trackDefs: TrackDef[] | undefined = manifest?.tracks
      const source: AudioSourceDescriptor = { kind: 'blob', blob: file }

      try {
        progressStage = 'Guardando archivo...'
        await loadAudio(file, ({ processedBytes, totalBytes }) => {
          reportProgress('saving', processedBytes / totalBytes)
        })
        const storedAudio = await getStoredAudio()
        if (storedAudio) source.blob = storedAudio
      } catch (saveError: any) {
        appState.setNotice(storageErrorMessage(saveError))
      }

      progressStage = 'Analizando audio...'
      await initPlayer(source, trackDefs, (processedBytes, totalBytes) => {
        reportProgress('indexing', totalBytes > 0 ? processedBytes / totalBytes : 0)
      })
      progressStage = 'Preparando reproductor...'
      reportProgress('ready', 1)
      await loadConcert(manifest, getTrackCount())
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
    progress = 0
    progressStage = 'Leyendo audio guardado...'
    loadingMode = 'stored'
    appState.setNotice(null)
    try {
      const storedAudio = await getStoredAudio(({ processedBytes, totalBytes }) => {
        reportProgress('reading', totalBytes > 0 ? processedBytes / totalBytes : 0)
      })
      if (!storedAudio) throw new Error('No hay audio guardado')
      const storedManifest = await getStoredManifest()
      const source: AudioSourceDescriptor = { kind: 'blob', blob: storedAudio }
      progressStage = 'Analizando audio...'
      await initPlayer(source, storedManifest?.tracks, (processedBytes, totalBytes) => {
        reportProgress('indexing', totalBytes > 0 ? processedBytes / totalBytes : 0)
      })
      progressStage = 'Preparando reproductor...'
      reportProgress('ready', 1)
      await loadConcert(null, getTrackCount())
      applyMixFromState()
      appState.setPhase('ready')
    } catch (e: any) {
      error = e.message || 'Error al cargar datos guardados'
    } finally {
      loading = false
    }
  }

  function reportProgress(stage: 'reading' | 'saving' | 'indexing' | 'ready', fraction: number) {
    const clamped = Math.max(0, Math.min(1, fraction))
    const ranges = {
      reading: [0, 0.2],
      saving: [0.05, 0.6],
      indexing: loadingMode === 'stored' ? [0.2, 0.95] : [0.6, 0.95],
      ready: [0.95, 1]
    } as const
    const [start, end] = ranges[stage]
    progress = Math.max(progress, Math.round((start + (end - start) * clamped) * 100))
  }

  function storageErrorMessage(error: any): string {
    if (error?.name === 'QuotaExceededError' || /quota|blob|storage|space/i.test(error?.message ?? '')) {
      return 'El audio se reproducira durante esta sesion, pero no se pudo guardar por falta de espacio.'
    }
    return 'El audio se reproducira durante esta sesion, pero no se pudo guardar localmente.'
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
      <p class="loader-status">{progressStage} {progress}%</p>
      <progress
        class="loader-progress"
        max="100"
        value={progress}
        aria-label={progressStage}
        aria-valuetext={`${progress}%`}
      ></progress>
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
  .loader-progress { display: block; width: min(100%, 280px); height: 0.6rem; margin: 1rem auto 0; accent-color: var(--accent); }
  .loader-error { color: var(--accent); margin-top: 1rem; }
</style>
