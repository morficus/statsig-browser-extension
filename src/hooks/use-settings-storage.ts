import { useWxtStorage } from '@/src/hooks/use-wxt-storage'
import { currentOverridesStorage, localStorageKeyStorage } from '@/src/lib/storage'
import { useSettingsStore } from '@/src/store/use-settings-store'

export const useSettingsStorage = () => {
  const { activeProjectId, apiKey, clearProjects, isApiKeyLoading, projects } = useSettingsStore()
  const [localStorageValue, setLocalStorageKey] = useWxtStorage(localStorageKeyStorage)
  const [, setCurrentOverrides] = useWxtStorage(currentOverridesStorage)

  const reset = async () => {
    await clearProjects()
    setLocalStorageKey('statsig_user')
    setCurrentOverrides([])
  }

  return {
    activeProjectId,
    apiKey,
    isApiKeyLoading,
    localStorageValue,
    projects,
    reset,
    setLocalStorageKey,
  }
}
