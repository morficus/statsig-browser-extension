import { memo, useMemo } from 'react'

import type { Group, UserIDOverride } from '@/src/types/statsig'

import { Badge } from '@/src/components/ui/badge'
import { CopyableText } from '@/src/components/ui/copyable-text'
import { TableCell, TableRow } from '@/src/components/ui/table'

interface OverrideRowProps {
  override: UserIDOverride & { isCurrentUser?: boolean }
  groups: Group[]
}

export const OverrideRow = memo(function OverrideRow({ override, groups }: OverrideRowProps) {
  const groupName = useMemo(
    () => groups.find((group) => group.id === override.groupID)?.name ?? override.groupID,
    [groups, override.groupID],
  )

  return (
    <TableRow className={override.isCurrentUser ? 'bg-muted/30' : undefined}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {override.ids.join(', ')}
          {override.isCurrentUser && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] uppercase">
              You
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{override.environment ?? 'All'}</TableCell>
      <TableCell>{override.unitType ?? 'userID'}</TableCell>
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

OverrideRow.displayName = 'OverrideRow'
