import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { READ_ONLY_KEY_REASON } from '@/src/hooks/use-write-access'
import {
  makeExperiment,
  makeExperimentOverride,
  makeExperimentOverridesResponse,
  makeUserIDOverride,
} from '@/src/tests/fixtures/statsig'
import { renderWithProviders } from '@/src/tests/utils/TestUtils'

import { OverridesSection } from './OverridesSection'

const { writeAccess } = vi.hoisted(() => ({
  writeAccess: { canWrite: true, reason: null as string | null },
}))

vi.mock('@/src/hooks/use-write-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/hooks/use-write-access')>()),
  useWriteAccess: () => writeAccess,
}))

vi.mock('@/src/hooks/use-experiment', () => ({
  useExperiment: () => ({
    data: makeExperiment({ groups: [{ id: 'Control', name: 'Control', parameterValues: {}, size: 100 }] }),
  }),
}))

vi.mock('@/src/hooks/use-feature-gates', () => ({
  useFeatureGates: () => ({ data: { pages: [{ data: [] }] } }),
}))

vi.mock('@/src/hooks/use-overrides', () => ({
  useOverrides: () => ({
    data: makeExperimentOverridesResponse({
      overrides: [makeExperimentOverride()],
      userIDOverrides: [makeUserIDOverride({ ids: ['u_current'] })],
    }),
  }),
}))

vi.mock('@/src/hooks/use-user-details', () => ({
  useUserDetails: () => ({ data: { userID: 'u_current' } }),
}))

vi.mock('@/src/hooks/use-experiment-mutations', () => ({
  useExperimentMutations: () => ({ deleteMutation: vi.fn(), isPending: false, updateMutation: vi.fn() }),
}))

const deleteButtons = () => screen.getAllByRole('button', { name: 'Delete override' })

describe('experiment OverridesSection write access', () => {
  beforeEach(() => {
    writeAccess.canWrite = true
    writeAccess.reason = null
  })

  it('enables every write control and shows no reason with a write key', () => {
    renderWithProviders(<OverridesSection />)

    expect(screen.queryByText(READ_ONLY_KEY_REASON)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add Manual/iu })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Select group for detected user' })).toBeEnabled()
    for (const button of deleteButtons()) {
      expect(button).toBeEnabled()
    }
  })

  it('shows the reason once and disables every write control with a read key', () => {
    writeAccess.canWrite = false
    writeAccess.reason = READ_ONLY_KEY_REASON

    renderWithProviders(<OverridesSection />)

    expect(screen.getAllByText(READ_ONLY_KEY_REASON)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Add Manual/iu })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Select group for detected user' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Override' })).toBeDisabled()
    // The environment select is a local choice, not a write
    expect(screen.getAllByRole('combobox')[0]).toBeEnabled()
    // One delete button in the user overrides table, one in the gate/segment overrides table
    const userRow = screen.getByRole('row', { name: /u_current/u })
    const gateRow = screen.getByRole('row', { name: /beta_gate|gate_1/u })
    expect(within(userRow).getByRole('button', { name: 'Delete override' })).toBeDisabled()
    expect(within(gateRow).getByRole('button', { name: 'Delete override' })).toBeDisabled()
    expect(deleteButtons()).toHaveLength(2)
  })
})
