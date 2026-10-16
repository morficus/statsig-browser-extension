import { act, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { TesterStableId, useTesterStableId } from '@/src/hooks/use-tester-stable-id'

import { saveManualStableId as saveStoredManualStableId } from '@/src/lib/manual-stable-id'
import { renderWithProviders } from '@/src/tests/utils/TestUtils'

import { StableIdFallback } from './StableIdFallback'

const { useTesterStableIdMock } = vi.hoisted(() => ({
  useTesterStableIdMock: vi.fn<() => TesterStableId>(),
}))

const { getActiveIntakeTabMock, getUserDetailsMock } = vi.hoisted(() => ({
  getActiveIntakeTabMock: vi.fn(),
  getUserDetailsMock: vi.fn(),
}))

vi.mock('@/src/hooks/use-tester-stable-id', () => ({
  useTesterStableId: useTesterStableIdMock,
}))

vi.mock('@/src/lib/tabs', () => ({
  getActiveIntakeTab: getActiveIntakeTabMock,
}))

vi.mock('@/src/handlers/get-user-details', () => ({
  getUserDetails: getUserDetailsMock,
}))

const refetch = vi.fn<TesterStableId['refetch']>()
const saveManualStableId = vi.fn<TesterStableId['saveManualStableId']>()
const clearManualStableId = vi.fn<TesterStableId['clearManualStableId']>()

const baseState = (): TesterStableId => ({
  clearManualStableId,
  isLoading: false,
  isMissing: true,
  isRefetching: false,
  refetch,
  saveManualStableId,
})

const mockState = (overrides: Partial<TesterStableId> = {}) => {
  useTesterStableIdMock.mockReturnValue({ ...baseState(), ...overrides })
}

/** A hook stand-in that keeps the typed-in ID in state, so the component can move between A and B. */
const mockStatefulState = (initialManualStableId?: string) => {
  useTesterStableIdMock.mockImplementation(() => {
    // oxlint-disable-next-line react/hook-use-state
    const [manualStableId, setManualStableId] = useState(initialManualStableId)
    return {
      ...baseState(),
      clearManualStableId: async () => {
        await clearManualStableId()
        setManualStableId(undefined)
      },
      manualStableId,
      saveManualStableId: async (value: string) => {
        await saveManualStableId(value)
        setManualStableId(value)
      },
      source: manualStableId === undefined ? undefined : 'manual',
      stableId: manualStableId,
    }
  })
}

/** Records whether an element with `role="alert"` ever appears in the document. */
const watchForAlert = () => {
  const seen = { alert: false }
  const observer = new MutationObserver(() => {
    seen.alert ||= document.querySelector('[role="alert"]') !== null
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return { observer, seen }
}

const getInput = () => screen.getByLabelText('Stable ID')
const getSubmit = () => screen.getByRole('button', { name: 'Use this ID' })

describe('stableIdFallback', () => {
  beforeEach(() => {
    refetch.mockReset()
    saveManualStableId.mockReset()
    clearManualStableId.mockReset()
    refetch.mockResolvedValue()
    saveManualStableId.mockResolvedValue()
    clearManualStableId.mockResolvedValue()
    useTesterStableIdMock.mockReset()
  })

  describe('renders nothing', () => {
    it('while the page read is loading', () => {
      mockState({ isLoading: true, isMissing: false })

      const { container } = renderWithProviders(<StableIdFallback />)

      expect(container).toBeEmptyDOMElement()
    })

    it('while loading, even if the read already reports missing', () => {
      mockState({ isLoading: true, isMissing: true })

      const { container } = renderWithProviders(<StableIdFallback />)

      expect(container).toBeEmptyDOMElement()
    })

    it('when a Stable ID is detected', () => {
      mockState({ isMissing: false, source: 'sdk', stableId: 'sdk-id' })

      const { container } = renderWithProviders(<StableIdFallback />)

      expect(container).toBeEmptyDOMElement()
    })

    it('when there is no Intake tab', () => {
      mockState({ isMissing: false })

      const { container } = renderWithProviders(<StableIdFallback />)

      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('state A: missing, no typed-in ID', () => {
    beforeEach(() => {
      mockStatefulState()
    })

    it('shows the alert with the exact copy (T-OVR-6)', () => {
      renderWithProviders(<StableIdFallback />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(
        "Stable ID not foundThe extension can't read your Stable ID from this page. Reload the page and try again, or enter your Stable ID below.Try again",
      )
      expect(alert).toHaveClass('border-destructive/50', 'bg-destructive/10')
      expect(screen.getByText('Stable ID not found')).toHaveClass('font-medium')
      expect(
        screen.getByText(
          "The extension can't read your Stable ID from this page. Reload the page and try again, or enter your Stable ID below.",
        ),
      ).toBeInTheDocument()
    })

    it('shows an empty, labelled field with no placeholder and a submit button (T-OVR-6)', () => {
      renderWithProviders(<StableIdFallback />)

      const input = getInput()
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('autocomplete', 'off')
      expect(input).toHaveAttribute('spellcheck', 'false')
      expect(input).not.toHaveAttribute('placeholder')
      expect(input).not.toHaveAttribute('aria-invalid')
      expect(screen.getByText('Stable ID', { selector: 'label' })).toHaveAttribute('for', input.id)
      expect(getSubmit()).toBeEnabled()
      expect(getSubmit()).toHaveAttribute('type', 'submit')
    })

    it('shows the hint with the exact copy and the key prefix in a code element (T-OVR-6)', () => {
      renderWithProviders(<StableIdFallback />)

      const code = screen.getByText('statsig.stable_id.')
      expect(code.tagName).toBe('CODE')
      expect(code.parentElement).toHaveClass('text-muted-foreground')
      expect(code.parentElement?.textContent).toBe(
        'To find it, open DevTools > Application > Local Storage. Copy the value of the key that starts with statsig.stable_id..',
      )
    })

    it('shows no state B content', () => {
      renderWithProviders(<StableIdFallback />)

      expect(screen.queryByText('Using the Stable ID you entered.')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    })

    it('calls refetch from Try again', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(refetch).toHaveBeenCalledTimes(1)
    })

    it('disables Try again while the page read runs again', () => {
      mockState({ isRefetching: true })

      renderWithProviders(<StableIdFallback />)

      expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
    })

    it('shows the empty error and does not save an empty entry', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.click(getSubmit())

      const message = screen.getByText('Enter a Stable ID.')
      expect(message).toHaveClass('text-destructive')
      expect(getInput()).toHaveAttribute('aria-invalid', 'true')
      expect(getInput()).toHaveAttribute('aria-describedby', message.id)
      expect(saveManualStableId).not.toHaveBeenCalled()
    })

    it('shows the empty error for a whitespace-only entry', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), '   ')
      await user.click(getSubmit())

      expect(screen.getByText('Enter a Stable ID.')).toBeInTheDocument()
      expect(saveManualStableId).not.toHaveBeenCalled()
    })

    it('shows the whitespace error for an entry with a space inside', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), 'abc 123')
      await user.click(getSubmit())

      const message = screen.getByText("A Stable ID can't contain spaces.")
      expect(message).toHaveClass('text-destructive')
      expect(getInput()).toHaveAttribute('aria-invalid', 'true')
      expect(getInput()).toHaveAttribute('aria-describedby', message.id)
      expect(saveManualStableId).not.toHaveBeenCalled()
    })

    it('clears the error when the Tester edits the input', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.click(getSubmit())
      expect(screen.getByText('Enter a Stable ID.')).toBeInTheDocument()

      await user.type(getInput(), 'a')

      expect(screen.queryByText('Enter a Stable ID.')).not.toBeInTheDocument()
      expect(getInput()).not.toHaveAttribute('aria-invalid', 'true')
      expect(getInput()).not.toHaveAttribute('aria-describedby')
    })

    it('saves the trimmed value of a padded entry and moves to state B', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), '  abc-123  ')
      await user.click(getSubmit())

      expect(saveManualStableId).toHaveBeenCalledTimes(1)
      expect(saveManualStableId).toHaveBeenCalledWith('abc-123')
      await screen.findByText('Using the Stable ID you entered.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('submits with Enter', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), 'abc-123{Enter}')

      expect(saveManualStableId).toHaveBeenCalledWith('abc-123')
    })

    it('disables the submit button while the save runs', async () => {
      const pending = Promise.withResolvers<void>()
      saveManualStableId.mockReturnValue(pending.promise)
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), 'abc-123')
      await user.click(getSubmit())

      expect(getSubmit()).toBeDisabled()

      await act(async () => {
        pending.resolve()
        await pending.promise
      })

      await screen.findByText('Using the Stable ID you entered.')
    })

    it('shows the save error and stays in state A when the save rejects', async () => {
      saveManualStableId.mockRejectedValue(new Error('storage failed'))
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), 'abc-123')
      await user.click(getSubmit())

      const message = await screen.findByText("The Stable ID wasn't saved. Try again.")
      expect(message).toHaveClass('text-destructive')
      expect(getInput()).toHaveAttribute('aria-describedby', message.id)
      expect(getInput()).toHaveValue('abc-123')
      expect(getSubmit()).toBeEnabled()
      expect(screen.queryByText('Using the Stable ID you entered.')).not.toBeInTheDocument()
    })

    it('clears the save error when the Tester edits the input', async () => {
      saveManualStableId.mockRejectedValue(new Error('storage failed'))
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), 'abc-123')
      await user.click(getSubmit())
      await screen.findByText("The Stable ID wasn't saved. Try again.")

      await user.type(getInput(), '4')

      expect(screen.queryByText("The Stable ID wasn't saved. Try again.")).not.toBeInTheDocument()
    })
  })

  describe('state B: missing, a typed-in ID is in use', () => {
    beforeEach(() => {
      mockStatefulState('abc-123')
    })

    it('shows the line, the ID, and Clear, and nothing else', () => {
      renderWithProviders(<StableIdFallback />)

      expect(screen.getByText('Using the Stable ID you entered.')).toBeInTheDocument()
      const value = screen.getByRole('button', { name: 'abc-123' })
      expect(value).toHaveClass('font-mono')
      expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Stable ID')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Use this ID' })).not.toBeInTheDocument()
    })

    it('goes back to state A with an empty input after Clear', async () => {
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.click(screen.getByRole('button', { name: 'Clear' }))

      expect(clearManualStableId).toHaveBeenCalledTimes(1)
      await screen.findByRole('alert')
      expect(getInput()).toHaveValue('')
    })

    it('stays in state B, logs, and shows the clear error when Clear rejects', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      clearManualStableId.mockRejectedValue(new Error('storage failed'))
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.click(screen.getByRole('button', { name: 'Clear' }))

      const message = await screen.findByText("The Stable ID wasn't cleared. Try again.")
      expect(message).toHaveClass('text-xs', 'text-destructive')
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Using the Stable ID you entered.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
    })

    it('removes the clear error on the next Clear click', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const pending = Promise.withResolvers<void>()
      clearManualStableId.mockRejectedValueOnce(new Error('storage failed'))
      clearManualStableId.mockReturnValueOnce(pending.promise)
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.click(screen.getByRole('button', { name: 'Clear' }))
      await screen.findByText("The Stable ID wasn't cleared. Try again.")

      await user.click(screen.getByRole('button', { name: 'Clear' }))

      expect(screen.queryByText("The Stable ID wasn't cleared. Try again.")).not.toBeInTheDocument()

      await act(async () => {
        pending.resolve()
        await pending.promise
      })

      await screen.findByRole('alert')
    })
  })

  describe('save then clear', () => {
    it('returns to state A with an empty input after a typed-in ID is cleared', async () => {
      mockStatefulState()
      const { user } = renderWithProviders(<StableIdFallback />)

      await user.type(getInput(), 'abc-123')
      await user.click(getSubmit())
      await user.click(await screen.findByRole('button', { name: 'Clear' }))

      await screen.findByRole('alert')
      expect(getInput()).toHaveValue('')
    })
  })

  describe('with the real hook', () => {
    beforeEach(async () => {
      fakeBrowser.reset()
      getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: 'https://app.staging.talkiatry.com/assessment' })
      getUserDetailsMock.mockResolvedValue({ user: {} })
      const actual = await vi.importActual<{ useTesterStableId: typeof useTesterStableId }>(
        '@/src/hooks/use-tester-stable-id',
      )
      useTesterStableIdMock.mockImplementation(actual.useTesterStableId)
    })

    it('never shows state A on the way to state B when an ID is stored', async () => {
      await saveStoredManualStableId('https://app.staging.talkiatry.com', 'abc-123')
      const { observer, seen } = watchForAlert()

      renderWithProviders(<StableIdFallback />)
      await screen.findByText('Using the Stable ID you entered.')
      observer.disconnect()

      expect(seen.alert).toBeFalsy()
      expect(screen.getByRole('button', { name: 'abc-123' })).toBeInTheDocument()
    })

    it('shows state A when no ID is stored', async () => {
      const { observer, seen } = watchForAlert()

      renderWithProviders(<StableIdFallback />)
      await screen.findByRole('alert')
      observer.disconnect()

      expect(seen.alert).toBeTruthy()
      expect(getInput()).toHaveValue('')
    })
  })
})
