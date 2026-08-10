# DalePlayer — Definición de la aplicación

## 1. Propósito

**DalePlayer** es una aplicación web (PWA) de reproducción de audio multipista con mezclador,
diseñada como herramienta de estudio para músicos sustitutos de un grupo de salsa (~13 músicos).

**Problema que resuelve:** cuando un músico del grupo no puede asistir a un concierto, el
sustituto debe estudiar el repertorio por su cuenta. DalePlayer le permite escuchar el concierto
completo con control individual sobre cada instrumento, para centrarse en su propia parte.

## 2. Usuarios

- **Administrador (el líder del grupo):** exporta el audio multicanal desde Reaper, prepara el
  manifiesto de marcadores, despliega la app y gestiona la contraseña de acceso.
- **Músicos sustitutos:** acceden desde su móvil/tablet, cargan el concierto y estudian con el
  mezclador. No necesitan cuentas de usuario ni conocimientos técnicos.

## 3. Funcionalidades

### 3.1 Reproductor multipista
- Un archivo `.opus` multicanal por concierto (configuración actual: **12 canales mono +
  3 pares estéreo = 18 canales / 15 pistas**). El número de pistas es ampliable vía manifiesto.
- Duración típica: concierto completo (~1h30).
- Reproducción continua con seek instantáneo.
- Controles de transporte: play/pause, barra de progreso con marcas de canciones, tiempo actual/total.

### 3.2 Mezclador (por pista)
- Fader de volumen.
- Paneo (balance en pistas estéreo).
- Mute.
- Solo (lógica estándar: si hay algún solo activo, suena solo lo seleccionado).
- VU-metro de nivel.
- **Master:** fader general.
- **Botón "Restablecer mezcla":** vuelve a valores por defecto (faders a 0 dB, pan centrado,
  sin mute/solo).

### 3.3 Marcadores de canciones (solo lectura)
- Definidos por el administrador en un **manifiesto JSON** que acompaña al archivo de audio.
- La app muestra la lista de canciones y permite saltar directamente a cada una.
- Los músicos NO pueden editar marcadores desde la app.

### 3.4 Persistencia de la mezcla
- **Una mezcla por concierto y dispositivo**, guardada automáticamente en IndexedDB con cada cambio.
- Persiste indefinidamente entre sesiones; nunca se resetea ni cambia sola.
- **Aislamiento total:** sin servidor ni sincronización. Es imposible que un dispositivo
  afecte a la mezcla de otro. Cada músico tiene SU mezcla en SU móvil.

### 3.5 Control de acceso
- Pantalla de contraseña al abrir la app.
- Contraseña **hardcodeada** (hash SHA-256) en `src/lib/config.ts`.
- La app recuerda el acceso en localStorage **hasta que la contraseña cambie**: al desplegar
  una nueva versión con contraseña distinta, todos los dispositivos vuelven a pedirla.
- Flujo de revocación: el administrador cambia el hash, redespliega, y quien no tenga la nueva
  contraseña queda fuera en cuanto su dispositivo se conecte y reciba la actualización.
- **Límites honestos (aceptados):**
  - Es una barrera disuasoria, no criptográfica: un usuario técnico podría saltársela.
  - Un dispositivo permanentemente offline conserva la versión y contraseña antiguas.
  - Los archivos de audio ya descargados permanecen en el dispositivo.

## 4. Formato de entrada

### 4.1 Audio
- Un único archivo `.opus` (Ogg Opus multicanal) por concierto.
- Bitrate de referencia: ~128 kbps por canal → archivo de ~1,5 GB para 90 min.
- Exportado por el administrador desde Reaper.

### 4.2 Manifiesto JSON (mismo nombre base que el `.opus`)
```json
{
  "title": "Concierto Feria 2026",
  "tracks": [
    { "name": "Bajo",   "channels": [0] },
    { "name": "Congas", "channels": [1] },
    { "name": "Coros",  "channels": [12, 13] }
  ],
  "markers": [
    { "time": 0,     "name": "1. Apertura" },
    { "time": 324.8, "name": "2. Tumbao" }
  ]
}
```
- `tracks[].channels`: 1 canal = pista mono, 2 canales = pista estéreo.
- `tracks[].defaultPan`: paneo inicial opcional entre -1 (izquierda) y 1 (derecha). Solo se usa al crear la mezcla por primera vez.
- `markers[].time`: segundos desde el inicio.
- Sin manifiesto: nombres por defecto (Canal 1..N) y sin marcadores.

## 5. Arquitectura técnica

### 5.1 Stack
- **Vite + Svelte + TypeScript**
- **Web Audio API** (motor de mezcla)
- **Decodificador Opus WASM** en Web Worker (libopus; los navegadores no decodifican bien
  más de 8 canales, por eso se decodifica de forma propia)
- **vite-plugin-pwa** (PWA offline, auto-update)
- **idb** (IndexedDB)

### 5.2 Motor de audio: decodificación por ventana deslizante
- Decodificar 90 min × 18 canales a PCM completo requeriría ~18 GB de RAM: imposible.
- El Worker decodifica solo una **ventana de ~25 s por delante del cabezal** (~100 MB RAM).
- Seek: bisección por granulepos Ogg + re-decodificación desde el nuevo punto.
- Scheduling gapless mediante `AudioBufferSourceNode` encadenados.
- Soporta cualquier número de canales (hasta 255 del formato Opus).

### 5.3 Grafo de mezcla (por pista)
```
Fuente (chunks) → GainNode (fader) → StereoPannerNode (pan) → GainNode (mute/solo)
→ AnalyserNode (VU) → Master Gain → Salida
```

### 5.4 PWA
- Instalable en tablet/móvil, 100% offline tras la primera carga.
- App shell precacheada; archivo `.opus` y mezcla en IndexedDB (con `storage.persist()`).
- **Wake Lock:** la pantalla no se apaga durante la reproducción (uso en atril).
- **Media Session API:** controles desde pantalla de bloqueo.
- **Auto-update:** al detectar nueva versión desplegada, se actualiza (clave para la revocación
  de contraseña).

### 5.5 Despliegue
- **GitHub Pages** con GitHub Actions (build + deploy en cada push a `main`).
- Nota: con cuenta gratuita de GitHub, Pages requiere repo público. El hash en el código
  no revela la contraseña, por lo que no es un problema.

## 6. Estructura del proyecto
```
DalePlayer/
├── .github/workflows/deploy.yml
├── index.html, vite.config.ts, tsconfig.json, package.json
├── public/manifest.webmanifest, iconos PWA
└── src/
    ├── main.ts, App.svelte
    └── lib/
        ├── config.ts                # APP_PASSWORD_HASH
        ├── audio/
        │   ├── decoder.worker.ts    # demux Ogg + decode Opus por ventana (WASM)
        │   ├── engine.ts            # reloj, scheduling gapless, seek
        │   └── mixer.ts             # grafo de mezcla
        ├── state/
        │   ├── player.svelte.ts     # estado de reproducción
        │   ├── tracks.svelte.ts     # estado de las pistas
        │   ├── auth.ts              # pantalla de acceso
        │   └── persistence.ts       # IndexedDB: archivo, manifiesto, mezcla
        ├── components/
        │   ├── GateScreen.svelte
        │   ├── LoaderScreen.svelte
        │   ├── MixerView.svelte
        │   ├── ChannelStrip.svelte
        │   ├── MasterStrip.svelte
        │   ├── TransportBar.svelte
        │   └── MarkerList.svelte
        └── types.ts
```

## 7. Riesgos identificados
| Riesgo | Mitigación |
|---|---|
| Codificar >8 canales en Opus (ffmpeg) | Usar `-mapping_family 255`; validar en fase 2 con archivo de prueba de 18 canales |
| Cuota de IndexedDB en tablets (~1,5 GB por concierto) | Detectar espacio disponible y avisar; permitir recargar archivo |
| iOS/Android detiene audio web con pantalla bloqueada | Wake Lock + Media Session; limitación inherente a la plataforma web |

## 8. Fases de desarrollo
1. **Scaffold:** Vite + Svelte + TS + PWA + workflow de despliegue.
2. **Motor de audio:** worker + ventana deslizante, validado con archivo de prueba de 18 canales.
3. **Mezclador UI:** faders, pan, mute, solo, VU, master.
4. **Marcadores:** manifiesto JSON + guía de exportación desde Reaper.
5. **Persistencia + contraseña.**
6. **Pulido PWA:** iconos, wake lock, media session + README operativo.

## 9. Fuera de alcance (posibles futuras mejoras)
- Bucle A-B por secciones.
- Cambio de tempo / tono.
- Visor de partituras.
- Perfiles de mezcla múltiples por dispositivo (mezclas con nombre).
- Edición de marcadores desde la app.
- Backend con usuarios reales.
