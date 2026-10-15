import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/src/tests/utils/TestUtils'

import { AddProjectForm } from './AddProjectForm'

vi.mock(import('@/src/handlers/initial-login'), () => ({
  initialLogin: vi.fn(),
}))

vi.mock('@/src/hooks/use-projects', () => ({
  useAddProject: () => vi.fn().mockResolvedValue('p9'),
}))

vi.mock('@/src/store/use-settings-store', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) => selector({ projects: [] }),
}))

describe('addProjectForm component', () => {
  it('tells the tester to use their own Personal Console Key', () => {
    renderWithProviders(<AddProjectForm />)

    expect(screen.getByText('Use your own Personal Console Key, not a shared project key.')).toBeInTheDocument()
  })
})
