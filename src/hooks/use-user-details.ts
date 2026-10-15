import { useQuery } from '@tanstack/react-query'

import { getActiveIntakeTab } from '@/src/lib/tabs'

import { getUserDetails } from '../handlers/get-user-details'

export const useUserDetails = () =>
  useQuery({
    queryFn: async () => {
      const tab = await getActiveIntakeTab()
      if (!tab) {
        throw new Error('No Intake Site tab found')
      }
      const details = await getUserDetails(tab)
      return details?.user ?? {}
    },
    queryKey: ['user-details'],
    refetchOnWindowFocus: false,
    retry: false,
  })
