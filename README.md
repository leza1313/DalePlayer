# DalePlayer

Mezclador multipista offline para músicos sustitutos. PWA que reproduce archivos **Opus multicanal** (hasta 255 canales) con control individual de volumen, paneo, mute y solo por pista.

Diseñado para grupos de música donde un músico sustituto necesita estudiar el repertorio escuchando el concierto completo y aislando/mezclando los instrumentos a su gusto.

## Uso

1. Abre la app en tu móvil o tablet.
2. Introduce la contraseña de acceso.
3. Selecciona el archivo `.opus` del concierto.
4. Escucha, mezcla y estudia.

El manifiesto con nombres de pistas y marcadores viene **integrado en la app** (`public/concert.json`). Los músicos nunca tienen que elegirlo: la app lo aplica automáticamente al cargar el audio.

La mezcla que hagas (faders, paneo, mute, solo) **se guarda automáticamente en tu dispositivo** y se recupera al volver a abrir la app. Cada músico tiene su propia mezcla independiente.

## Desarrollo

```bash
npm install --ignore-engines
npm run dev       # http://localhost:5173
npm run build     # genera dist/
```

Requiere Node 18+ (con 16 funciona usando `--ignore-engines`).

## Formato del concierto

### Archivo de audio

Un único archivo **Ogg Opus multicanal** por concierto. Codificado con `mapping_family 255` para soportar más de 8 canales.

La app espera que el audio esté a 48 kHz (el estándar de Opus), pero acepta cualquier input sample rate (internamente Opus siempre decodifica a 48 kHz).

### Manifiesto JSON (integrado en la app)

La app carga automáticamente `public/concert.json` como manifiesto del concierto. Para actualizarlo, edita ese archivo y despliega de nuevo.

```json
{
  "title": "Concierto Feria 2026",
  "tracks": [
    { "name": "Bajo",      "channels": [0] },
    { "name": "Congas",    "channels": [1] },
    { "name": "Timbales",  "channels": [2] },
    { "name": "Piano",     "channels": [3] },
    { "name": "Trompeta 1","channels": [4] },
    { "name": "Trompeta 2","channels": [5] },
    { "name": "Trompeta 3","channels": [6] },
    { "name": "Trombon 1", "channels": [7] },
    { "name": "Trombon 2", "channels": [8] },
    { "name": "Saxo 1",    "channels": [9] },
    { "name": "Saxo 2",    "channels": [10] },
    { "name": "Cantante",  "channels": [11] },
    { "name": "Coros L/R", "channels": [12, 13] },
    { "name": "Ambiente L/R","channels": [14, 15] },
    { "name": "Click L/R", "channels": [16, 17] }
  ],
  "markers": [
    { "time": 0,     "name": "1. Apertura" },
    { "time": 245.3, "name": "2. La vida es un carnaval" },
    { "time": 512.8, "name": "3. Tumbao" },
    { "time": 780.5, "name": "4. Cierre" }
  ]
}
```

- `tracks[].channels`: array de índices de canal. **1 elemento = pista mono, 2 = estéreo.**
- `tracks[].defaultPan`: paneo inicial opcional entre `-1` (izquierda) y `1` (derecha). Solo se aplica si todavía no existe una mezcla guardada; los cambios del usuario se conservan.
- `markers[].time`: segundos desde el inicio de la canción dentro del concierto.
- Si no hay manifiesto, las pistas se muestran como "Canal 1".."Canal N" sin marcadores.

### Exportar desde Reaper

1. En Reaper, asegúrate de que cada pista ocupa los canales correctos (mono = 1 canal, estéreo = 2 canales).
2. **Render**: File → Render, formato **Ogg Opus**.
3. Configuración importante en ffmpeg si exportas con él:
   ```bash
   ffmpeg -i input.wav -c:a libopus -mapping_family 255 -b:a 128k output.opus
   ```
   El flag `-mapping_family 255` es **obligatorio** para más de 8 canales.

## Cambiar la contraseña

1. Edita `src/lib/config.ts` y cambia `APP_PASSWORD_HASH`.
2. Para calcular el nuevo hash, ejecuta en Node:
   ```js
   let pw = 'TU_NUEVA_CONTRASENA'
   let h = 0
   for (let i = 0; i < pw.length; i++) h = ((h << 5) - h) + pw.charCodeAt(i) | 0
   console.log((h >>> 0).toString(16).padStart(8, '0'))
   ```
3. Copia el resultado en `config.ts`, haz commit y push. La PWA se actualizará sola en los dispositivos que se conecten.

## Desplegar en GitHub Pages

1. Crea un repositorio en GitHub y sube el código.
2. Ve a Settings → Pages → Source: **GitHub Actions**.
3. Haz push a `main`. El workflow `.github/workflows/deploy.yml` compila y despliega automáticamente.
4. La app estará en `https://TU_USUARIO.github.io/DalePlayer/`.

**Nota:** GitHub Pages en cuentas gratuitas requiere repositorio público. El hash de la contraseña en el código no revela la contraseña real.

## Arquitectura técnica

- **Vite + Svelte 4 + TypeScript**
- **Web Audio API**: `AudioBufferSourceNode` por pista, scheduling gapless
- **libopus WASM**: decodificación Opus multicanal propia (los navegadores no decodifican bien >8 canales)
- **IndexedDB**: persistencia del archivo de audio y la mezcla del usuario
- **PWA**: service worker, instalable, offline
- **Decodificación por ventana deslizante**: solo se decodifican ~25s alrededor del cabezal (~100 MB RAM en vez de ~18 GB)

## Estructura

```
src/
├── lib/
│   ├── config.ts              # APP_PASSWORD_HASH
│   ├── types.ts
│   ├── audio/
│   │   ├── decoder.ts         # Ogg parser + OpusStreamDecoder
│   │   ├── engine.ts          # AudioEngine: scheduling, grafo, AnalyserNodes
│   │   └── mixer.ts           # (futuro) lógica de mezcla avanzada
│   ├── state/
│   │   ├── app.svelte.ts      # AppState (locked/loading/ready)
│   │   ├── auth.ts            # Lógica de contraseña
│   │   ├── player.svelte.ts   # Store reactiva del reproductor
│   │   ├── persistence.ts     # IndexedDB
│   │   └── mixState.ts        # Auto-guardado de mezcla
│   └── components/
│       ├── GateScreen.svelte
│       ├── LoaderScreen.svelte
│       ├── MixerView.svelte
│       ├── ChannelStrip.svelte
│       ├── MasterStrip.svelte
│       ├── TransportBar.svelte
│       └── MarkerList.svelte
```
