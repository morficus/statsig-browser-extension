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

    executeScriptMock.mockResolvedValue([{ result: { ...payload, href: INTAKE_URL } }])

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

  describe('the href the page reports', () => {
    const user = { userID: 'user_123' }

    it('keeps the result for an Intake Site href and does not pass the href on', async () => {
      executeScriptMock.mockResolvedValue([{ result: { href: INTAKE_URL, user } }])

      const details = await getUserDetails({ id: 42, url: INTAKE_URL })

      expect(details).toStrictEqual({ user })
      expect(details).not.toHaveProperty('href')
    })

    it.each([
      ['an Intake Site path outside the match patterns', 'https://app.staging.talkiatry.com/login'],
      ['another origin', 'https://example.com/assessment'],
      ['a string that is not a URL', 'not a url'],
      ['an empty string', ''],
    ])('drops the whole result when the href is %s', async (_name, href) => {
      executeScriptMock.mockResolvedValue([{ result: { href, stableId: { source: 'sdk', value: 'abc' }, user } }])

      await expect(getUserDetails({ id: 42, url: INTAKE_URL })).resolves.toBeUndefined()
    })

    it.each([
      ['missing', undefined],
      ['a number', 42],
      ['null', null],
      ['an object', { toString: () => INTAKE_URL }],
    ])('drops the whole result when the href is %s', async (_name, href) => {
      executeScriptMock.mockResolvedValue([{ result: { href, user } }])

      await expect(getUserDetails({ id: 42, url: INTAKE_URL })).resolves.toBeUndefined()
    })
  })

  describe('the Stable ID the page reports', () => {
    const user = { userID: 'user_123' }

    const readWith = (extra: Record<string, unknown>) => {
      executeScriptMock.mockResolvedValue([{ result: { href: INTAKE_URL, user, ...extra } }])
      return getUserDetails({ id: 42, url: INTAKE_URL })
    }

    it.each([
      ['sdk', 'sdk_stable'],
      ['localStorage', 'stored_stable'],
    ])('keeps a Stable ID from the %s source', async (source, value) => {
      await expect(readWith({ stableId: { source, value } })).resolves.toStrictEqual({
        stableId: { source, value },
        user,
      })
    })

    it('trims a padded value', async () => {
      await expect(
        readWith({ stableId: { source: 'localStorage', value: '  padded_stable \n' } }),
      ).resolves.toStrictEqual({
        stableId: { source: 'localStorage', value: 'padded_stable' },
        user,
      })
    })

    it.each([
      ['an unknown source', { source: 'cookie', value: 'abc' }],
      ['a missing source', { value: 'abc' }],
      ['a number value', { source: 'sdk', value: 12_345 }],
      ['a missing value', { source: 'sdk' }],
      ['an empty value', { source: 'sdk', value: '' }],
      ['a blank value', { source: 'localStorage', value: '   ' }],
      ['a string', 'abc'],
      ['null', null],
      ['an array', ['sdk', 'abc']],
    ])('drops the Stable ID for %s and keeps the rest', async (_name, stableId) => {
      const details = await readWith({ stableId })

      expect(details).toStrictEqual({ user })
      expect(details).not.toHaveProperty('stableId')
    })
  })

  describe('the environment tier the page reports', () => {
    const user = { userID: 'user_123' }

    const readWith = (environmentTier: unknown) => {
      executeScriptMock.mockResolvedValue([{ result: { environmentTier, href: INTAKE_URL, user } }])
      return getUserDetails({ id: 42, url: INTAKE_URL })
    }

    it('keeps a non-empty tier', async () => {
      await expect(readWith('staging')).resolves.toStrictEqual({ environmentTier: 'staging', user })
    })

    it.each([
      ['a number', 5],
      ['null', null],
      ['an object', { tier: 'staging' }],
      ['an empty string', ''],
      ['missing', undefined],
    ])('drops the tier when it is %s and keeps the rest', async (_name, tier) => {
      const details = await readWith(tier)

      expect(details).toStrictEqual({ user })
      expect(details).not.toHaveProperty('environmentTier')
    })
  })

  it('passes the context and the keys through with the new fields', async () => {
    const result = {
      context: { app: 'dashboard' },
      environmentTier: 'production',
      href: INTAKE_URL,
      keys: { gateHashes: ['1'], hashedSdkKeys: ['2'], sdkKeys: ['client-3'] },
      stableId: { source: 'sdk', value: 'abc' },
      user: { stableID: 'abc', userID: 'user_123' },
    }
    executeScriptMock.mockResolvedValue([{ result }])

    const { href: _href, ...expected } = result
    await expect(getUserDetails({ id: 42, url: INTAKE_URL })).resolves.toStrictEqual(expected)
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
