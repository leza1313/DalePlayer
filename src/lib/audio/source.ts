export interface AudioSource {
  readonly size: number
  read(offset: number, length: number): Promise<Uint8Array>
}

export type AudioSourceDescriptor =
  | { kind: 'blob'; blob: Blob }
  | { kind: 'http'; url: string; size: number; headers?: Record<string, string> }

export class BlobAudioSource implements AudioSource {
  readonly size: number

  constructor(private readonly blob: Blob) {
    this.size = blob.size
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || length < 0 || offset + length > this.size) {
      throw new Error('Rango de lectura fuera del archivo')
    }
    return new Uint8Array(await this.blob.slice(offset, offset + length).arrayBuffer())
  }
}

export class HttpRangeAudioSource implements AudioSource {
  readonly size: number

  constructor(
    private readonly url: string,
    size: number,
    private readonly headers: Record<string, string> = {}
  ) {
    this.size = size
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || length < 0 || offset + length > this.size) {
      throw new Error('Rango de lectura fuera del archivo')
    }
    if (length === 0) return new Uint8Array(0)

    const end = offset + length - 1
    const response = await fetch(this.url, {
      headers: { ...this.headers, Range: `bytes=${offset}-${end}` }
    })
    if (!response.ok) throw new Error(`Error HTTP ${response.status} al leer el audio`)
    if (response.status !== 206) {
      throw new Error('El servidor no admite lecturas HTTP por rangos')
    }

    const data = new Uint8Array(await response.arrayBuffer())
    if (data.byteLength !== length) {
      throw new Error('El servidor devolvio un rango de audio incompleto')
    }
    return data
  }
}

export function createAudioSource(descriptor: AudioSourceDescriptor): AudioSource {
  if (descriptor.kind === 'blob') return new BlobAudioSource(descriptor.blob)
  return new HttpRangeAudioSource(descriptor.url, descriptor.size, descriptor.headers)
}
