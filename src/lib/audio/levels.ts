export const MIN_DB = -60
export const MAX_DB = 10

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
