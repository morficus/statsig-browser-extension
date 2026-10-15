import { useEffect } from 'react'

import { getUserDetails } from '@/src/handlers/get-user-details'
import { getActiveIntakeTab } from '@/src/lib/tabs'
import { useContextStore } from '@/src/store/use-context-store'

/**
 * Reads the Statsig identifiers of the inspected page. Runs `getUserDetailsFromPage` in the page's
 * MAIN world through `scripting.executeScript`, the only injection this extension registers.
 */
export const useDetectedStatsigKeys = () => {
  const setDetectedKeys = useContextStore((state) => state.setDetectedKeys)

  useEffect(() => {
    const read = async () => {
      const tab = await getActiveIntakeTab()
      if (!tab) {
        return
      }
      const details = await getUserDetails(tab)
      setDetectedKeys(details?.keys ?? null)
    }

    void read()
  }, [setDetectedKeys])
}
