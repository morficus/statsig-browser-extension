import { useOverridesSectionLogic } from '@/src/hooks/use-overrides-section-logic'

import { OverridesList } from './OverridesList'
import { PageContextCard } from './PageContextCard'

export function OverridesSection() {
  const {
    detectedUser,
    detectedUserId,
    detectedUserOverrides,
    experiment,
    groups,
    isDetectedUserOverridden,
    overridesData,
  } = useOverridesSectionLogic()

  return (
    <div className="mt-4 flex flex-col gap-6">
      <PageContextCard
        detectedUser={detectedUser ?? undefined}
        detectedUserId={detectedUserId ?? ''}
        isDetectedUserOverridden={isDetectedUserOverridden}
        detectedUserOverrides={detectedUserOverrides}
        experiment={experiment}
      />

      <OverridesList overridesData={overridesData} groups={groups} />
    </div>
  )
}
