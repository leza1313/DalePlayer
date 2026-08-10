export const MIN_DB = -60
export const MAX_DB = 10
export const VOLUME_REFERENCE_SLIDER = (0 - MIN_DB) / (MAX_DB - MIN_DB)

export function dbToGain(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_DB) return 0
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  if (!Number.isFinite(gain) || gain <= 0) return -Infinity
  return 20 * Math.log10(gain)
}

export function formatDb(gain: number): string {
  const db = gainToDb(gain)
  if (!Number.isFinite(db) || db <= MIN_DB) return '-∞'
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`
}

export function dbToSlider(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_DB) return 0
  return Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)))
}

export function sliderToDb(value: number): number {
  if (value <= 0) return -Infinity
  return MIN_DB + value * (MAX_DB - MIN_DB)
}

export function snapVolumeSlider(value: number): { slider: number; gain: number; snapped: boolean } {
  const db = sliderToDb(value)
  if (Number.isFinite(db) && Math.abs(db) <= 0.5) {
    return { slider: VOLUME_REFERENCE_SLIDER, gain: 1, snapped: true }
  }
  return { slider: value, gain: dbToGain(db), snapped: false }
}

export function snapPanValue(value: number): { value: number; snapped: boolean } {
  if (Math.abs(value) <= 0.04) return { value: 0, snapped: true }
  return { value, snapped: false }
}

export function triggerReferenceHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(8)
  }
}
