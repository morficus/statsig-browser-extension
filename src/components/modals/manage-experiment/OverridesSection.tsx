import { useCallback } from 'react'

import { useOverridesSectionLogic } from '@/src/hooks/use-overrides-section-logic'

import type { AddOverrideParams } from './PageContextCard'

import { AddOverrideForm } from './AddOverrideForm'
import { OverridesList } from './OverridesList'
import { PageContextCard } from './PageContextCard'

export function OverridesSection() {
  const {
    addOverride,
    canWrite,
    deleteOverride,
    detectedUser,
    detectedUserId,
    detectedUserOverrides,
    groups,
    handleBackClick,
    handleCreateOverrideClick,
    isDetectedUserOverridden,
    isPending,
    overridesData,
    readOnlyReason,
    view,
    experiment,
  } = useOverridesSectionLogic()

  const handleAddOverride = useCallback(
    ({ userId, groupId, environment, idType }: AddOverrideParams) => {
      addOverride({
        environment: environment ?? undefined,
        groupID: groupId,
        ids: [userId],
        unitType: idType ?? undefined,
      })
    },
    [addOverride],
  )

  return (
    <div className="mt-4 flex flex-col gap-6">
      {readOnlyReason && <p className="text-xs text-muted-foreground">{readOnlyReason}</p>}
      <PageContextCard
        detectedUser={detectedUser ?? undefined}
        detectedUserId={detectedUserId ?? ''}
        isDetectedUserOverridden={isDetectedUserOverridden}
        detectedUserOverrides={detectedUserOverrides}
        canEdit={canWrite}
        isPending={isPending}
        groups={groups}
        onAddOverride={handleAddOverride}
        experiment={experiment}
      />

      {view === 'table' || !canWrite ? (
        <OverridesList
          canEdit={canWrite}
          onCreateOverrideClick={handleCreateOverrideClick}
          overridesData={overridesData}
          onDeleteOverride={deleteOverride}
          isPending={isPending}
          groups={groups}
        />
      ) : (
        <AddOverrideForm
          groups={groups}
          onCancel={handleBackClick}
          onAddOverride={addOverride}
          isPending={isPending}
          experiment={experiment}
        />
      )}
    </div>
  )
}
