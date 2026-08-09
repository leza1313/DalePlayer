import { APP_PASSWORD_HASH } from '../config'

const STORAGE_KEY = 'dalePlayer_authHash'

export function checkPassword(password: string): boolean {
  return hashPassword(password) === APP_PASSWORD_HASH
}

export function isUnlocked(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === APP_PASSWORD_HASH
}

export function unlock(password: string): boolean {
  if (!checkPassword(password)) return false
  localStorage.setItem(STORAGE_KEY, APP_PASSWORD_HASH)
  return true
}

function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
