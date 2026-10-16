import { useMemo } from 'react'

import { useExperiment } from '@/src/hooks/use-experiment'
import { useFeatureGates } from '@/src/hooks/use-feature-gates'
import { useOverrides } from '@/src/hooks/use-overrides'
import { useUserDetails } from '@/src/hooks/use-user-details'
import { getDetectedUserId } from '@/src/lib/user-utils'
import { useUIStore } from '@/src/store/use-ui-store'

const useOverrideData = (currentItemId: string | undefined) => {
  const { data: experiment } = useExperiment(currentItemId)
  const groups = useMemo(() => experiment?.groups ?? [], [experiment?.groups])

  const { data: featureGatesData } = useFeatureGates()
  const featureGates = useMemo(() => featureGatesData?.pages.flatMap((page) => page.data) ?? [], [featureGatesData])

  const { data: detectedUser } = useUserDetails()

  const detectedUserId = useMemo(
    () => getDetectedUserId(detectedUser, experiment?.idType),
    [detectedUser, experiment?.idType],
  )

  const { data: overridesData } = useOverrides(currentItemId)

  const userIDOverrides = useMemo(() => {
    if (!overridesData) {
      return []
    }

    return overridesData.userIDOverrides.map((override) => {
      const idType = override.unitType ?? 'userID'
      const detectedId = getDetectedUserId(detectedUser, idType)
      const isCurrentUser = detectedId ? override.ids.includes(detectedId) : false
      return { ...override, isCurrentUser }
    })
  }, [overridesData, detectedUser])

  const detectedUserOverrides = useMemo(() => {
    if (!detectedUserId || !overridesData) {
      return []
    }

    const currentIdType = experiment?.idType ?? 'userID'

    return overridesData.userIDOverrides
      .filter((override) => {
        const hasId = override.ids.includes(detectedUserId)
        const overrideIdType = override.unitType ?? 'userID'
        return hasId && overrideIdType === currentIdType
      })
      .map((override) => ({
        environment: override.environment ?? null,
        groupID: override.groupID,
      }))
  }, [detectedUserId, overridesData, experiment?.idType])

  return {
    detectedUser,
    detectedUserId,
    detectedUserOverrides,
    experiment,
    featureGates,
    groups,
    isDetectedUserOverridden: detectedUserOverrides.length > 0,
    overridesData: overridesData ? { ...overridesData, userIDOverrides } : undefined,
  }
}

export const useOverridesSectionLogic = () => {
  const { currentItemId } = useUIStore((state) => state)

  const {
    detectedUser,
    detectedUserId,
    detectedUserOverrides,
    experiment,
    featureGates,
    groups,
    isDetectedUserOverridden,
    overridesData,
  } = useOverrideData(currentItemId)

  return {
    currentItemId,
    detectedUser,
    detectedUserId,
    detectedUserOverrides,
    experiment,
    featureGates,
    groups,
    isDetectedUserOverridden,
    overridesData,
  }
}
