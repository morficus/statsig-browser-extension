import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUIStore } from '@/src/store/use-ui-store'

import { Header } from './Header'

vi.mock('@/src/components/layout/ProjectStatus', () => ({
  ProjectStatus: () => <div data-testid="project-status" />,
}))

describe('header', () => {
  beforeEach(() => {
    useUIStore.getState().reset()
  })

  it('renders the product name and version', () => {
    render(<Header isIntakeSite onLogout={vi.fn()} />)
    expect(screen.getByText('Intake Experiment Testing')).toBeInTheDocument()
    expect(screen.queryByAltText('Statsig')).toBeNull()
    expect(screen.getByText(/^v/u)).toBeInTheDocument()
  })

  it('opens user details and settings from the account menu and logs out', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onLogout = vi.fn()
    render(<Header isIntakeSite onLogout={onLogout} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: /user details/iu }))
    expect(useUIStore.getState().isUserDetailsSheetOpen).toBeTruthy()

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: /^settings$/iu }))
    expect(useUIStore.getState().isSettingsSheetOpen).toBeTruthy()

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: /logout/iu }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('shows the project status and user details on an Intake Site page', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<Header isIntakeSite onLogout={vi.fn()} />)

    expect(screen.getByTestId('project-status')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('menuitem', { name: /user details/iu })).toBeInTheDocument()
  })

  it.each([false, undefined])('hides the project status and user details when isIntakeSite is %s', async (value) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<Header isIntakeSite={value} onLogout={vi.fn()} />)

    expect(screen.queryByTestId('project-status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('menuitem', { name: /^settings$/iu })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /user details/iu })).not.toBeInTheDocument()
  })
})
