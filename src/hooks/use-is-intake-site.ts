import { useEffect, useState } from 'react'

import { getActiveIntakeTab } from '@/src/lib/tabs'

/** Whether the inspected tab is an Intake Site page; `undefined` until the check resolves. */
export const useIsIntakeSite = () => {
  const [isIntakeSite, setIsIntakeSite] = useState<boolean>()

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
  }, [])

  return isIntakeSite
}
