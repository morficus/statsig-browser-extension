import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExperimentOverridesResponse } from '@/src/types/statsig'

import { READ_ONLY_KEY_REASON } from '@/src/hooks/use-write-access'
import {
  makeExperiment,
  makeExperimentOverride,
  makeExperimentOverridesResponse,
  makeUserIDOverride,
} from '@/src/tests/fixtures/statsig'
import { renderWithProviders } from '@/src/tests/utils/TestUtils'

import { OverridesSection } from './OverridesSection'

const { overridesState, writeAccess } = vi.hoisted(() => ({
  overridesState: { data: undefined as ExperimentOverridesResponse | undefined },
  writeAccess: { canWrite: true, reason: null as string | null },
}))

vi.mock('@/src/hooks/use-write-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/hooks/use-write-access')>()),
  useWriteAccess: () => writeAccess,
}))

vi.mock('@/src/hooks/use-experiment', () => ({
  useExperiment: () => ({
    data: makeExperiment({
      groups: [
        { id: 'Control', name: 'Control', parameterValues: {}, size: 50 },
        { id: 'Test', name: 'Test Group', parameterValues: {}, size: 50 },
      ],
    }),
  }),
}))

vi.mock('@/src/hooks/use-feature-gates', () => ({
  useFeatureGates: () => ({ data: { pages: [{ data: [] }] } }),
}))

vi.mock('@/src/hooks/use-overrides', () => ({
  useOverrides: () => ({ data: overridesState.data }),
}))

vi.mock('@/src/hooks/use-user-details', () => ({
  useUserDetails: () => ({ data: { userID: 'u_current' } }),
}))

const populatedOverrides = () =>
  makeExperimentOverridesResponse({
    overrides: [
      makeExperimentOverride({ groupID: 'Control', name: 'beta_gate', type: 'gate' }),
      makeExperimentOverride({ groupID: 'Test', name: 'beta_segment', type: 'segment' }),
    ],
    userIDOverrides: [
      makeUserIDOverride({ groupID: 'Test', ids: ['u_current'] }),
      makeUserIDOverride({ groupID: 'Control', ids: ['u_other_1', 'u_other_2'] }),
    ],
  })

// Writes live in Force me and Clear. This modal only lists what is there.
const expectNoWriteControls = () => {
  expect(screen.queryByRole('button', { name: /add/iu })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /delete/iu })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^override/iu })).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
}

describe('experiment OverridesSection is read-only', () => {
  beforeEach(() => {
    writeAccess.canWrite = true
    writeAccess.reason = null
    overridesState.data = populatedOverrides()
  })

  it('lists the ID overrides, the current user first and the others behind a toggle', async () => {
    const { user } = renderWithProviders(<OverridesSection />)

    expect(screen.getByRole('heading', { name: 'Active Overrides' })).toBeInTheDocument()

    // The Tester's own ID override shows first, and the others stay behind the toggle
    const currentRow = screen.getByRole('row', { name: /u_current/u })
    expect(within(currentRow).getByText('Production')).toBeInTheDocument()
    expect(within(currentRow).getByText('userID')).toBeInTheDocument()
    expect(within(currentRow).getByText('Test Group')).toBeInTheDocument()
    expect(within(currentRow).getByText('You')).toBeInTheDocument()
    expect(screen.queryByText(/u_other_1/u)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Show 1 other overrides/iu }))
    const otherRow = screen.getByRole('row', { name: /u_other_1/u })
    expect(within(otherRow).getByText('u_other_1, u_other_2')).toBeInTheDocument()
    // The group name, then its ID, which here is the same text
    expect(within(otherRow).getAllByText('Control')).toHaveLength(2)
  })

  it('lists the gate and segment overrides', () => {
    renderWithProviders(<OverridesSection />)

    const gateRow = screen.getByRole('row', { name: /beta_gate/u })
    expect(within(gateRow).getByText('gate')).toBeInTheDocument()
    const segmentRow = screen.getByRole('row', { name: /beta_segment/u })
    expect(within(segmentRow).getByText('segment')).toBeInTheDocument()
    expect(within(segmentRow).getByText('Test Group')).toBeInTheDocument()
  })

  it('shows who the page user is and where they are overridden', () => {
    renderWithProviders(<OverridesSection />)

    expect(screen.getByText('Current User:')).toBeInTheDocument()
    expect(screen.getAllByText('u_current').length).toBeGreaterThanOrEqual(1)
    // Badge in the context card, next to the Environment cell of the table row
    expect(screen.getAllByText('Production')).toHaveLength(2)
  })

  it('has no add, form, or delete control, with a write key', async () => {
    const { user } = renderWithProviders(<OverridesSection />)

    expectNoWriteControls()

    await user.click(screen.getByRole('button', { name: /Show 1 other overrides/iu }))

    expectNoWriteControls()
    expect(screen.queryByRole('button', { name: 'Delete override' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Manual/iu })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/ID Value/iu)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Select group for detected user' })).not.toBeInTheDocument()
    // Each table has one column per field and no empty column for row actions
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
  })

  it('has the same controls with a read-only key and shows no read-only reason', () => {
    writeAccess.canWrite = false
    writeAccess.reason = READ_ONLY_KEY_REASON

    renderWithProviders(<OverridesSection />)

    expectNoWriteControls()
    expect(screen.queryByText(READ_ONLY_KEY_REASON)).not.toBeInTheDocument()
  })

  it('shows the empty state for both tables when there are no overrides', () => {
    overridesState.data = makeExperimentOverridesResponse()

    renderWithProviders(<OverridesSection />)

    expect(screen.getAllByText('No overrides found')).toHaveLength(2)
    expectNoWriteControls()
  })

  it('shows the empty state while the overrides are not loaded', () => {
    overridesState.data = undefined

    renderWithProviders(<OverridesSection />)

    expect(screen.getAllByText('No overrides found')).toHaveLength(2)
    expectNoWriteControls()
  })
})
