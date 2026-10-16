import { useWxtStorage } from '@/src/hooks/use-wxt-storage'
import { localStorageKeyStorage, overrideRecordsStorage } from '@/src/lib/storage'
import { useSettingsStore } from '@/src/store/use-settings-store'

export const useSettingsStorage = () => {
  const { activeProjectId, apiKey, clearProjects, isApiKeyLoading, projects } = useSettingsStore()
  const [localStorageValue, setLocalStorageKey] = useWxtStorage(localStorageKeyStorage)

  const reset = async () => {
    await clearProjects()
    setLocalStorageKey('statsig_user')
    await overrideRecordsStorage.setValue([])
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
