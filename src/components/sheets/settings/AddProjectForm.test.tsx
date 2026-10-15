import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { initialLogin } from '@/src/handlers/initial-login'
import { renderWithProviders } from '@/src/tests/utils/TestUtils'

import { AddProjectForm } from './AddProjectForm'

const { addProjectMock } = vi.hoisted(() => ({ addProjectMock: vi.fn() }))

vi.mock(import('@/src/handlers/initial-login'), () => ({
  initialLogin: vi.fn(),
}))

vi.mock('@/src/hooks/use-projects', () => ({
  useAddProject: () => addProjectMock,
}))

vi.mock('@/src/store/use-settings-store', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) => selector({ projects: [] }),
}))

describe('addProjectForm component', () => {
  it('tells the tester to use their own Personal Console Key', () => {
    renderWithProviders(<AddProjectForm />)

    expect(screen.getByText('Use your own Personal Console Key, not a shared project key.')).toBeInTheDocument()
  })

  it('defaults the key type to read & write', () => {
    renderWithProviders(<AddProjectForm />)

    expect(screen.getByRole('combobox', { name: 'Key type' })).toHaveTextContent('Read & write')
  })

  it('does not show the key when the request fails with it in the message', async () => {
    vi.mocked(initialLogin).mockRejectedValue(new Error('Request failed for console-abc123'))
    const { user } = renderWithProviders(<AddProjectForm />)

    await user.type(screen.getByLabelText('Statsig Console API Key'), 'console-abc123')
    await user.click(screen.getByRole('button', { name: /Add/iu }))

    await waitFor(() => {
      expect(screen.getByText(/Request failed/u)).toBeInTheDocument()
    })
    expect(screen.queryByText(/abc123/u)).not.toBeInTheDocument()
  })

  it('sends the chosen key type with the key', async () => {
    addProjectMock.mockResolvedValue('p9')
    vi.mocked(initialLogin).mockResolvedValue({ data: undefined, error: undefined, success: true })
    const { user } = renderWithProviders(<AddProjectForm pinOrigin />)

    await user.type(screen.getByLabelText('Statsig Console API Key'), 'console-new')
    await user.click(screen.getByRole('combobox', { name: 'Key type' }))
    await user.click(screen.getByRole('option', { name: 'Read only' }))
    await user.click(screen.getByRole('button', { name: /Add/iu }))

    await waitFor(() => {
      expect(addProjectMock).toHaveBeenCalledWith('console-new', true, 'read-key')
    })
  })
})
