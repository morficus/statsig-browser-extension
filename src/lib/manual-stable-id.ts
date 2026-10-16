import { storage } from 'wxt/utils/storage'

export type ManualStableIdValidation = { ok: true; value: string } | { ok: false; reason: 'empty' | 'whitespace' }

const storageKey = (origin: string) => `session:manual-stable-id:${origin}` as const

/** Trims, then rejects an empty value or one with whitespace inside. */
export function validateManualStableId(raw: string): ManualStableIdValidation {
  const value = raw.trim()

  if (value === '') {
    return { ok: false, reason: 'empty' }
  }

  if (/\s/u.test(value)) {
    return { ok: false, reason: 'whitespace' }
  }

  return { ok: true, value }
}

export async function getManualStableId(origin: string): Promise<string | undefined> {
  const stored = await storage.getItem<unknown>(storageKey(origin))
  if (typeof stored !== 'string') {
    return undefined
  }

  // Session storage is not trusted: a value that fails validation reads as missing.
  const result = validateManualStableId(stored)
  return result.ok ? result.value : undefined
}

export async function saveManualStableId(origin: string, value: string): Promise<void> {
  const result = validateManualStableId(value)

  if (!result.ok) {
    throw new Error(`Invalid Stable ID: ${result.reason}`)
  }

  await storage.setItem(storageKey(origin), result.value)
}

export async function clearManualStableId(origin: string): Promise<void> {
  await storage.removeItem(storageKey(origin))
}
