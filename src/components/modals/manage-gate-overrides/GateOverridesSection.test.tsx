import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { READ_ONLY_KEY_REASON } from '@/src/hooks/use-write-access'
import { makeFeatureGate, makeGateOverride } from '@/src/tests/fixtures/statsig'
import { renderWithProviders } from '@/src/tests/utils/TestUtils'

import { GateOverridesSection } from './GateOverridesSection'

const { writeAccess } = vi.hoisted(() => ({
  writeAccess: { canWrite: true, reason: null as string | null },
}))

vi.mock('@/src/hooks/use-write-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/hooks/use-write-access')>()),
  useWriteAccess: () => writeAccess,
}))

vi.mock('@/src/hooks/use-gate-overrides', () => ({
  useGateOverrides: () => ({
    data: makeGateOverride({ passingUserIDs: ['u_current'] }),
    isLoading: false,
  }),
}))

vi.mock('@/src/hooks/use-user-details', () => ({
  useUserDetails: () => ({ data: { userID: 'u_current' } }),
}))

vi.mock('@/src/handlers/gate-overrides', () => ({
  deleteGateOverrides: vi.fn(),
  updateGateOverrides: vi.fn(),
}))

const renderSection = () => renderWithProviders(<GateOverridesSection featureGate={makeFeatureGate()} />)

describe('gateOverridesSection write access', () => {
  beforeEach(() => {
    writeAccess.canWrite = true
    writeAccess.reason = null
  })

  it('enables every write control and shows no reason with a write key', () => {
    renderSection()

    expect(screen.queryByText(READ_ONLY_KEY_REASON)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add Manual/iu })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'PASS' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'FAIL' })).toBeEnabled()
  })

  it('shows the reason once and disables every write control with a read key', () => {
    writeAccess.canWrite = false
    writeAccess.reason = READ_ONLY_KEY_REASON

    renderSection()

    expect(screen.getAllByText(READ_ONLY_KEY_REASON)).toHaveLength(1)
    // The environment select is a local choice, not a write
    expect(screen.getByRole('combobox')).toBeEnabled()
    expect(screen.getByRole('button', { name: /Add Manual/iu })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'PASS' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'FAIL' })).toBeDisabled()
    // One delete button per override row, rendered but disabled
    const deleteButtons = screen.getAllByRole('button').filter((button) => button.querySelector('svg.lucide-trash-2'))
    expect(deleteButtons.length).toBeGreaterThan(0)
    for (const button of deleteButtons) {
      expect(button).toBeDisabled()
    }
  })
})
