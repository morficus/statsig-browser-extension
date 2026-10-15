import { beforeEach, vi, describe, expect, it } from 'vitest'

import { getUserDetails } from './get-user-details'

const { executeScriptMock } = vi.hoisted(() => ({
  executeScriptMock: vi.fn(),
}))

vi.mock('wxt/browser', () => ({
  browser: {
    scripting: {
      executeScript: executeScriptMock,
    },
  },
}))

const INTAKE_URL = 'https://app.staging.talkiatry.com/assessment'

describe('user details handler', () => {
  beforeEach(() => {
    executeScriptMock.mockReset()
    vi.restoreAllMocks()
  })

  it('returns the injected user details when the script succeeds', async () => {
    const payload = {
      context: { app: 'dashboard' },
      user: { userID: 'user_123' },
    }

    executeScriptMock.mockResolvedValue([{ result: payload }])

    await expect(getUserDetails({ id: 42, url: INTAKE_URL })).resolves.toStrictEqual(payload)

    expect(executeScriptMock).toHaveBeenCalledWith({
      func: expect.any(Function),
      target: { tabId: 42 },
      world: 'MAIN',
    })
  })

  it('returns undefined when the injected script has no result', async () => {
    executeScriptMock.mockResolvedValue([{ result: undefined }])

    await expect(getUserDetails({ id: 7, url: INTAKE_URL })).resolves.toBeUndefined()
  })

  it('returns undefined for restricted about:blank tabs', async () => {
    executeScriptMock.mockRejectedValue(
      new Error(
        'Cannot access contents of url "about:blank". Extension manifest must request permission to access this host.',
      ),
    )

    await expect(getUserDetails({ id: 9, url: INTAKE_URL })).resolves.toBeUndefined()
  })

  it('logs and returns undefined for unexpected errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    executeScriptMock.mockRejectedValue(new Error('Boom'))

    await expect(getUserDetails({ id: 10, url: INTAKE_URL })).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith('Failed to get user details from page', 'Boom')
  })

  it.each([
    ['a non-Intake URL', { id: 1, url: 'https://example.com/' }],
    ['a missing URL', { id: 1 }],
    ['a missing id', { url: INTAKE_URL }],
  ])('does not read the page for %s', async (_name, tab) => {
    await expect(getUserDetails(tab)).resolves.toBeUndefined()

    expect(executeScriptMock).not.toHaveBeenCalled()
  })
})
