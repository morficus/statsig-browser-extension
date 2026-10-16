import { CheckCircle2 } from 'lucide-react'
import { memo } from 'react'

import type { Experiment } from '@/src/types/statsig'

import { SharedPageContextCard } from '@/src/components/common/SharedPageContextCard'
import { Badge } from '@/src/components/ui/badge'

interface ExperimentPageContextCardProps {
  detectedUser: Record<string, unknown> | undefined
  detectedUserId: string
  detectedUserOverrides?: {
    environment: string | null
  }[]
  isDetectedUserOverridden: boolean
  experiment?: Experiment
}

const EMPTY_OVERRIDES: {
  environment: string | null
}[] = []

export const PageContextCard = memo(function PageContextCard({
  detectedUser,
  detectedUserId,
  isDetectedUserOverridden,
  detectedUserOverrides = EMPTY_OVERRIDES,
  experiment,
}: ExperimentPageContextCardProps) {
  const idType = experiment?.idType ?? 'userID'

  return (
    <SharedPageContextCard detectedUser={detectedUser} detectedUserId={detectedUserId}>
      <div className="mt-1 space-y-5">
        {idType !== 'userID' && (
          <div className="text-[11px] text-muted-foreground">
            Using ID Type: <span className="font-medium text-foreground">{idType}</span>
          </div>
        )}

        {isDetectedUserOverridden && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Active Overrides
            </span>
            <div className="flex flex-wrap gap-1.5">
              {detectedUserOverrides.map((override) => (
                <Badge
                  key={override.environment ?? 'global'}
                  variant="secondary"
                  className="h-5 border-success/20 bg-success/10 px-1.5 text-[10px] text-success"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {override.environment ?? 'Global'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </SharedPageContextCard>
  )
})

PageContextCard.displayName = 'PageContextCard'
