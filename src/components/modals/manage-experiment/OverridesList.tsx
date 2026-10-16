import { memo, useCallback, useMemo } from 'react'

import type { SortableColumnConfig } from '@/src/hooks/use-sorted-table'
import type { ExperimentOverride, Group, UserIDOverride } from '@/src/types/statsig'

import { SharedOverridesTable } from '@/src/components/common/SharedOverridesTable'
import { SortableTableHeads } from '@/src/components/tables/SortableHeader'
import { GeneralEmptyState } from '@/src/components/ui/general-empty-state'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/src/components/ui/table'
import { useSortedTable } from '@/src/hooks/use-sorted-table'

import { ExperimentOverrideRow } from './ExperimentOverrideRow'
import { OverrideRow } from './OverrideRow'

type UserOverrideItem = UserIDOverride & { isCurrentUser?: boolean }

const getUserOverrideRowId = (override: UserOverrideItem) => `${override.groupID}-${override.ids?.join(',')}`
const getExperimentOverrideRowId = (override: ExperimentOverride) =>
  `${override.type}-${override.name}-${override.groupID}`

const groupLabel = (groups: Group[], groupID: string) => groups.find((group) => group.id === groupID)?.name ?? groupID

// The list is read-only: rows draw no delete control, so the shared table never asks to confirm a delete.
const ignoreDelete = () => {}

interface UserOverridesTableProps {
  overrides: UserOverrideItem[]
  groups: Group[]
}

const UserOverridesTable = memo(function UserOverridesTable({ overrides, groups }: UserOverridesTableProps) {
  const isCurrentUserPredicate = useCallback((item: UserOverrideItem) => Boolean(item.isCurrentUser), [])

  const renderRow = useCallback(
    (override: UserOverrideItem) => (
      <OverrideRow key={getUserOverrideRowId(override)} override={override} groups={groups} />
    ),
    [groups],
  )

  const columns = useMemo(
    (): SortableColumnConfig<UserOverrideItem>[] => [
      { accessor: (item) => item.ids.join(', '), header: 'IDs', id: 'ids' },
      { accessor: (item) => item.environment ?? 'All', header: 'Environment', id: 'environment' },
      { accessor: (item) => item.unitType ?? 'userID', header: 'ID Type', id: 'idType' },
      { accessor: (item) => groupLabel(groups, item.groupID), header: 'Group', id: 'group' },
    ],
    [groups],
  )

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">User Overrides</h4>
      <SharedOverridesTable
        items={overrides}
        columns={columns}
        getRowId={getUserOverrideRowId}
        isCurrentUserPredicate={isCurrentUserPredicate}
        onDeleteConfirm={ignoreDelete}
        colSpan={4}
        emptyEntityName="item"
        renderRow={renderRow}
      />
    </div>
  )
})

UserOverridesTable.displayName = 'UserOverridesTable'

interface GateOverridesTableProps {
  overrides: ExperimentOverride[]
  groups: Group[]
}

const GateOverridesTable = memo(function GateOverridesTable({ overrides, groups }: GateOverridesTableProps) {
  const columns = useMemo(
    (): SortableColumnConfig<ExperimentOverride>[] => [
      { accessor: (item) => item.type, header: 'Type', id: 'type' },
      { accessor: (item) => item.name, header: 'Name', id: 'name' },
      { accessor: (item) => groupLabel(groups, item.groupID), header: 'Group', id: 'group' },
    ],
    [groups],
  )

  const { headerColumns, items: sortedOverrides } = useSortedTable({
    columns,
    data: overrides,
    getRowId: getExperimentOverrideRowId,
  })

  return (
    <div className="mt-8 space-y-3">
      <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Gate/Segment Overrides</h4>
      <div className="overflow-hidden rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <SortableTableHeads columns={headerColumns} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOverrides.length > 0 ? (
              sortedOverrides.map((override) => (
                <ExperimentOverrideRow key={getExperimentOverrideRowId(override)} override={override} groups={groups} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <div className="flex justify-center">
                    <GeneralEmptyState variant="override" entityName="item" />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
})

GateOverridesTable.displayName = 'GateOverridesTable'

interface OverridesListProps {
  overridesData:
    | {
        userIDOverrides: (UserIDOverride & { isCurrentUser?: boolean })[]
        overrides: ExperimentOverride[]
      }
    | undefined
  groups: Group[]
}

const EMPTY_USERS: (UserIDOverride & { isCurrentUser?: boolean })[] = []
const EMPTY_EXPERIMENTS: ExperimentOverride[] = []

export const OverridesList = memo(function OverridesList({ overridesData, groups }: OverridesListProps) {
  const userOverrides = overridesData?.userIDOverrides ?? EMPTY_USERS
  const gateOverrides = overridesData?.overrides ?? EMPTY_EXPERIMENTS

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Active Overrides</h3>
      <div className="flex flex-col gap-6">
        <UserOverridesTable overrides={userOverrides} groups={groups} />

        <GateOverridesTable overrides={gateOverrides} groups={groups} />
      </div>
    </div>
  )
})

OverridesList.displayName = 'OverridesList'
