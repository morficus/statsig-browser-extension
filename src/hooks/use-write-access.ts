import { useWxtStorage } from '@/src/hooks/use-wxt-storage'
import { apiKeyTypeStorage } from '@/src/lib/storage'

export const READ_ONLY_KEY_REASON = 'Read-only key. Add a key with write access to change overrides.'

/**
 * Whether the active project's Console Key may change things in Statsig. Every write control
 * gates on this, and shows `reason` when it is disabled.
 */
export function useWriteAccess(): { canWrite: boolean; reason: string | null } {
  const [keyType, , isLoading] = useWxtStorage(apiKeyTypeStorage)

  if (isLoading) {
    return { canWrite: false, reason: null }
  }
  if (keyType === 'read-key') {
    return { canWrite: false, reason: READ_ONLY_KEY_REASON }
  }
  return { canWrite: true, reason: null }
}
