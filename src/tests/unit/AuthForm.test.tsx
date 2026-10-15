import { screen, waitFor } from '@testing-library/react'
import { beforeEach, vi, describe, expect, it } from 'vitest'

import { Dialog, DialogContent } from '@/src/components/ui/dialog'
import { initialLogin } from '@/src/handlers/initial-login'

import { AuthForm } from '../../components/modals/AuthForm'
import { renderWithProviders } from '../utils/TestUtils'

interface LoginResult {
  data: { message: string } | undefined
  error: string | undefined
  success: boolean
}

const noopLoginResolver = (_value: LoginResult) => {}

const { addProjectMock } = vi.hoisted(() => ({ addProjectMock: vi.fn() }))

// Mock initialLogin handler
vi.mock(import('@/src/handlers/initial-login'), async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/handlers/initial-login')>()
  return {
    ...actual,
    initialLogin: vi.fn(),
  }
})

// Mock project creation, which persists the key and fetches its detection data
vi.mock(import('@/src/hooks/use-projects'), async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/hooks/use-projects')>()
  return {
    ...actual,
    useAddProject: () => addProjectMock,
  }
})

describe('authForm component', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    addProjectMock.mockResolvedValue('project-1')
  })

  it('renders initial state correctly', () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Login to Statsig')).toBeInTheDocument()
    expect(screen.getByLabelText(/Statsig Console API Key/iu)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Login/iu })).toBeInTheDocument()
  })

  it('tells the tester to use their own Personal Console Key', () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Use your own Personal Console Key, not a shared project key.')).toBeInTheDocument()
  })

  it('shows validation error for empty API key', async () => {
    const { user } = renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    await user.click(screen.getByRole('button', { name: /Login/iu }))

    await waitFor(() => {
      expect(screen.getByText('Please enter an API key')).toBeInTheDocument()
    })
    expect(initialLogin).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid API key prefix', async () => {
    const { user } = renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    const input = screen.getByPlaceholderText('console-...')
    await user.type(input, 'wrong-prefix-key')
    await user.click(screen.getByRole('button', { name: /Login/iu }))

    await waitFor(() => {
      expect(screen.getByText('API key should start with "console-"')).toBeInTheDocument()
    })
    expect(initialLogin).not.toHaveBeenCalled()
  })

  it('calls mutate with correct API key on valid submission', async () => {
    const mockLogin = vi.mocked(initialLogin)
    mockLogin.mockResolvedValue({ data: { message: 'Success' }, error: undefined, success: true })

    const { user } = renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    const input = screen.getByPlaceholderText('console-...')
    await user.type(input, 'console-valid-key')
    await user.click(screen.getByRole('button', { name: /Login/iu }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('console-valid-key', expect.anything())
    })
  })

  it('offers the key types, defaulting to read & write', () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole('combobox', { name: 'Key type' })).toHaveTextContent('Read & write')
  })

  it.each([
    ['Read & write', 'write-key'],
    ['Read only', 'read-key'],
  ])('saves the project as %s', async (label, apiKeyType) => {
    vi.mocked(initialLogin).mockResolvedValue({ data: { message: 'Success' }, error: undefined, success: true })

    const { user } = renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    await user.type(screen.getByPlaceholderText('console-...'), 'console-valid-key')
    await user.click(screen.getByRole('combobox', { name: 'Key type' }))
    await user.click(screen.getByRole('option', { name: label }))
    await user.click(screen.getByRole('button', { name: /Login/iu }))

    await waitFor(() => {
      expect(addProjectMock).toHaveBeenCalledWith('console-valid-key', false, apiKeyType)
    })
  })

  it('does not show the key when the login request fails with it in the message', async () => {
    vi.mocked(initialLogin).mockRejectedValue(new Error('Request failed for console-abc123'))

    const { user } = renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    await user.type(screen.getByPlaceholderText('console-...'), 'console-abc123')
    await user.click(screen.getByRole('button', { name: /Login/iu }))

    await waitFor(() => {
      expect(screen.getByText(/Request failed/u)).toBeInTheDocument()
    })
    expect(screen.queryByText(/abc123/u)).not.toBeInTheDocument()
  })

  it('disables input and button when pending', async () => {
    const mockLogin = vi.mocked(initialLogin)
    let resolveLogin: (value: LoginResult) => void = noopLoginResolver
    const loginPromise = new Promise<LoginResult>((resolve) => {
      resolveLogin = resolve
    })
    mockLogin.mockReturnValue(loginPromise)

    const { user } = renderWithProviders(
      <Dialog open>
        <DialogContent>
          <AuthForm {...defaultProps} />
        </DialogContent>
      </Dialog>,
    )

    const input = screen.getByPlaceholderText('console-...')
    await user.type(input, 'console-valid-key')
    await user.click(screen.getByRole('button', { name: /Login/iu }))

    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: /Login/iu })).toBeDisabled()

    resolveLogin({ data: { message: 'Success' }, error: undefined, success: true })
  })
})
