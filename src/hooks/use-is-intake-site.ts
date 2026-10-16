import { useEffect } from 'react'

import { getActiveIntakeTab } from '@/src/lib/tabs'
import { useContextStore } from '@/src/store/use-context-store'

/** Whether the inspected tab is an Intake Site page; `undefined` until the check resolves. */
export const useIsIntakeSite = () => {
  const isIntakeSite = useContextStore((state) => state.isIntakeSite)
  const setIsIntakeSite = useContextStore((state) => state.setIsIntakeSite)

  useEffect(() => {
    let mounted = true

    void getActiveIntakeTab().then((tab) => {
      if (mounted) {
        setIsIntakeSite(tab !== null)
      }
    })

    return () => {
      mounted = false
    }
  }, [setIsIntakeSite])

  return isIntakeSite
}
