import { memo, useMemo } from 'react'

import type { ExperimentOverride, Group } from '@/src/types/statsig'

import { CopyableText } from '@/src/components/ui/copyable-text'
import { TableCell, TableRow } from '@/src/components/ui/table'

interface ExperimentOverrideRowProps {
  override: ExperimentOverride
  groups: Group[]
}

export const ExperimentOverrideRow = memo(function ExperimentOverrideRow({
  override,
  groups,
}: ExperimentOverrideRowProps) {
  const groupName = useMemo(
    () => groups.find((group) => group.id === override.groupID)?.name ?? override.groupID,
    [groups, override.groupID],
  )

  return (
    <TableRow>
      <TableCell className="font-medium capitalize">{override.type}</TableCell>
      <TableCell>{override.name}</TableCell>
      <TableCell>
        <div className="min-w-0">
          <div className="truncate">{groupName}</div>
          <CopyableText
            value={override.groupID}
            copyLabel="Copy Group ID"
            containerClassName="text-[11px] font-mono text-muted-foreground"
            valueClassName="truncate hover:text-foreground transition-colors"
          />
        </div>
      </TableCell>
    </TableRow>
  )
})

ExperimentOverrideRow.displayName = 'ExperimentOverrideRow'
