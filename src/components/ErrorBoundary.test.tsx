import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from './ErrorBoundary'

const Boom = ({ message = 'kaboom' }: { message?: string }) => {
  throw new Error(message)
}

const Leaky = () => {
  throw new Error('request failed', { cause: new Error('bad key console-abc123') })
}

describe('errorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>healthy</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('renders the fallback with the error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom message="upstream failed" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('upstream failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload extension/iu })).toBeInTheDocument()
  })

  it('logs only redacted text, never the raw error with its cause chain', () => {
    const consoleError = vi.mocked(console.error)

    render(
      <ErrorBoundary>
        <Leaky />
      </ErrorBoundary>,
    )

    expect(consoleError).toHaveBeenCalledWith('Uncaught error:', expect.any(String), expect.any(String))
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('abc123')
  })

  it('calls location.reload when the user clicks Reload Extension', async () => {
    const reload = vi.fn()
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { reload },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /reload extension/iu }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
