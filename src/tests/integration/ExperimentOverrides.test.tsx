import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, vi, describe, expect, it } from 'vitest'

import { AppContent } from '@/entrypoints/popup/App'
import { fetcher, poster } from '@/src/lib/fetcher'
import { useUIStore } from '@/src/store/use-ui-store'

import {
  makeExperiment,
  makeExperimentOverride,
  makeExperimentOverridesResponse,
  makeUserIDOverride,
  paginated,
  single,
} from '../fixtures/statsig'
import { resetUIStoreState } from '../utils/integration-mocks'
import { renderWithProviders } from '../utils/TestUtils'

// Mock the api instance methods.
// Every write method the extension could use is here. A write from the UI then reaches an assertion.
// Without them, it would throw inside the call.
const { mockWretch } = vi.hoisted(() => {
  const instanceWretch = {
    body: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    headers: vi.fn(),
    json: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    url: vi.fn(),
  }
  instanceWretch.body.mockReturnValue(instanceWretch)
  instanceWretch.delete.mockReturnValue(instanceWretch)
  instanceWretch.get.mockReturnValue(instanceWretch)
  instanceWretch.headers.mockReturnValue(instanceWretch)
  instanceWretch.patch.mockReturnValue(instanceWretch)
  instanceWretch.post.mockReturnValue(instanceWretch)
  instanceWretch.put.mockReturnValue(instanceWretch)
  instanceWretch.url.mockReturnValue(instanceWretch)
  return { mockWretch: instanceWretch }
})

vi.mock('@/src/lib/fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/fetcher')>()
  const mockFetcher: typeof actual.fetcher = vi.fn()
  const mockPoster: typeof actual.poster = vi.fn()
  return {
    ...actual,
    api: mockWretch,
    fetcher: mockFetcher,
    poster: mockPoster,
  }
})

vi.mock('@/src/hooks/use-is-intake-site', () => ({
  useIsIntakeSite: () => true,
}))

// Mock API key and mock detected user
vi.mock(import('@/src/hooks/use-wxt-storage'), async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/hooks/use-wxt-storage')>()
  return {
    ...actual,
    useWxtStorage: <T,>(item: { defaultValue: T; key: string }): [T, (val: T) => void, boolean] => {
      if (item.key === 'local:api_key_type') {
        return ['write-key' as unknown as T, vi.fn(), false]
      }
      if (item.key === 'local:statsig-console-api-key') {
        return ['test-api-key' as unknown as T, vi.fn(), false]
      }
      return [item.defaultValue, vi.fn(), false]
    },
  }
})

// The popup only loads project data for a page that belongs to the active project.
vi.mock('@/src/hooks/use-page-project', () => ({
  usePageProject: () => ({ activeLabel: 'Project 1', hasProjects: true, reason: 'client-key', status: 'matched' }),
}))

vi.mock(import('@/src/hooks/use-user-details'), () => ({
  useUserDetails: () => ({ data: { userID: 'user_123' }, isLoading: false }) as any,
}))

vi.mock(import('@/src/lib/storage'), async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/storage')>()
  return {
    ...actual,
    apiKeyStorage: {
      getValue: vi.fn().mockResolvedValue('test-api-key'),
      setValue: vi.fn(),
      watch: vi.fn(() => () => {}),
    } as any,
  }
})

const mockExperiments = [
  makeExperiment({
    groups: [
      { id: 'group_1', name: 'Control', parameterValues: {}, size: 50 },
      { id: 'group_2', name: 'Test', parameterValues: {}, size: 50 },
    ],
    id: 'exp_1',
    name: 'Test Experiment 1',
  }),
]

const mockOverrides = makeExperimentOverridesResponse({
  overrides: [
    makeExperimentOverride({ groupID: 'Control', name: 'gate_1', type: 'gate' }),
    makeExperimentOverride({ groupID: 'Test', name: 'segment_1', type: 'segment' }),
  ],
  userIDOverrides: [makeUserIDOverride({ groupID: 'Test', ids: ['user_123'] })],
})

const setupMocksWithOtherUser = () => {
  vi.mocked(fetcher).mockImplementation((url: string) => {
    if (url.includes('/overrides')) {
      return Promise.resolve(
        single({
          ...mockOverrides,
          userIDOverrides: [makeUserIDOverride({ groupID: 'Test', ids: ['other_user'] })],
        }),
      )
    }
    if (url.includes('/experiments/exp_1')) {
      return Promise.resolve(single(mockExperiments[0]))
    }
    if (url.includes('/experiments?')) {
      return Promise.resolve(paginated(mockExperiments))
    }
    if (url.includes('/gates?')) {
      return Promise.resolve(paginated([]))
    }
    return Promise.resolve({ data: {} })
  })
}

const setupMocks = () => {
  // Mock fetcher for hooks - ALL Statig API responses are wrapped in { data: ... }
  vi.mocked(fetcher).mockImplementation((url: string) => {
    const urlString = url
    if (urlString.includes('/overrides')) {
      return Promise.resolve(single(mockOverrides))
    }
    if (urlString.includes('/experiments/exp_1')) {
      return Promise.resolve(single(mockExperiments[0]))
    }
    if (urlString.includes('/experiments?')) {
      return Promise.resolve(paginated(mockExperiments))
    }
    if (urlString.includes('/gates?')) {
      return Promise.resolve(paginated([]))
    }
    return Promise.resolve({ data: {} })
  })
}

const openExperimentOverrides = async (user: { click: (element: Element) => Promise<void> }) => {
  await waitFor(() => expect(screen.getByRole('tab', { name: /Experiments/iu })).toBeInTheDocument())
  await user.click(screen.getByRole('tab', { name: /Experiments/iu }))
  await waitFor(() => expect(screen.getByText('Test Experiment 1')).toBeInTheDocument())
  await user.click(screen.getByText('Test Experiment 1').closest('tr')!)
  await waitFor(() => expect(screen.getByRole('tab', { name: /Overrides/iu })).toBeInTheDocument())
  await user.click(screen.getByRole('tab', { name: /Overrides/iu }))
}

const MAX_CLICK_ROUNDS = 5

// Click every enabled button in the panel, then the buttons that those clicks revealed, until none is new.
const clickEnabledButtons = async (user: ReturnType<typeof renderWithProviders>['user'], panel: HTMLElement) => {
  const clicked = new Set<HTMLElement>()
  const unclicked = () =>
    within(panel)
      .getAllByRole('button')
      .filter((button) => !button.hasAttribute('disabled') && !clicked.has(button))

  for (let round = 0; round < MAX_CLICK_ROUNDS && unclicked().length > 0; round += 1) {
    for (const button of unclicked()) {
      clicked.add(button)
      // A user clicks one button after another
      // oxlint-disable-next-line no-await-in-loop
      await user.click(button)
    }
  }
  return clicked.size
}

// A mutation calls its function after a few microtasks, so wait for a macrotask before asserting it never ran.
const flushPendingMutations = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })

describe('experiment Overrides Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState(resetUIStoreState)
  })

  it('should list all overrides in the manage modal', async () => {
    setupMocks()
    const { user } = renderWithProviders(<AppContent />)

    await openExperimentOverrides(user)

    // Check for User ID override (isCurrentUser: true since we mocked user_123)
    // Use findAllByText because user_123 appears in context card AND list
    const userElements = await screen.findAllByText('user_123')
    expect(userElements.length).toBeGreaterThanOrEqual(1)

    // Check for Gate override
    expect(screen.getByText('gate_1')).toBeInTheDocument()
    expect(screen.getByText('gate')).toBeInTheDocument()

    // Check for Segment override
    expect(screen.getByText('segment_1')).toBeInTheDocument()
    expect(screen.getByText('segment')).toBeInTheDocument()
  })

  it('should list the other users overrides behind the toggle, without a delete control', async () => {
    setupMocksWithOtherUser()
    const { user } = renderWithProviders(<AppContent />)

    await openExperimentOverrides(user)

    await user.click(await screen.findByText(/Show 1 other overrides/iu))

    const row = screen.getByText('other_user').closest('tr')!
    expect(within(row).getByText('Production')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /Delete override/iu })).not.toBeInTheDocument()
  })

  it('should offer no add, form, or delete control, even with a write key', async () => {
    setupMocks()
    const { user } = renderWithProviders(<AppContent />)

    await openExperimentOverrides(user)
    await screen.findByText('gate_1')

    expect(screen.queryByRole('button', { name: /Add Manual/iu })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete override/iu })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Override$/iu })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/ID Value/iu)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Select group for detected user' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Gate\/Segment Override/iu })).not.toBeInTheDocument()
  })

  it('should send no write request, whatever button in the overrides panel is clicked', async () => {
    setupMocksWithOtherUser()
    const { user } = renderWithProviders(<AppContent />)

    await openExperimentOverrides(user)
    const panel = await screen.findByRole('tabpanel', { name: /Overrides/iu })
    await within(panel).findByText(/Show 1 other overrides/iu)

    // The toggle reveals the rows of other users, and their buttons are clicked too
    const clickedCount = await clickEnabledButtons(user, panel)
    expect(clickedCount).toBeGreaterThan(1)
    expect(within(panel).getByText('other_user')).toBeInTheDocument()
    await flushPendingMutations()

    for (const write of [poster, mockWretch.post, mockWretch.put, mockWretch.patch, mockWretch.delete]) {
      expect(write).not.toHaveBeenCalled()
    }
  })
})
