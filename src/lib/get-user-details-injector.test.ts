import { afterEach, describe, expect, it, vi } from 'vitest'

import { djb2 } from './djb2'
import { getUserDetailsFromPage } from './get-user-details-injector'

interface StatsigGlobals {
  statsig?: unknown
  __STATSIG__?: unknown
  __STATSIG_JS_SDK__?: unknown
}

const win = globalThis as unknown as StatsigGlobals

const cleanup = () => {
  delete win.statsig
  delete win.__STATSIG__
  delete win.__STATSIG_JS_SDK__
}

const storeStableId = (value = '"stored_stable"') => {
  globalThis.localStorage.setItem('statsig.stable_id.123', value)
}

const withContext = (context: Record<string, unknown>) => {
  win.statsig = { _user: { userID: 'u_1' }, getContext: () => context }
}

describe('getUserDetailsFromPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('returns null when no statsig instance exists on the page', () => {
    expect(getUserDetailsFromPage()).toBeNull()
  })

  it('reads user via getCurrentUser when present on window.statsig', () => {
    const user = { email: 'a@b.com', userID: 'u_1' }
    win.statsig = {
      getCurrentUser: () => user,
      getStableID: () => 'stable_42',
    }

    const result = getUserDetailsFromPage()
    expect(result).toStrictEqual({
      context: undefined,
      href: globalThis.location.href,
      stableId: { source: 'sdk', value: 'stable_42' },
      user: { ...user, stableID: 'stable_42' },
    })
  })

  it('falls back to _user when getCurrentUser is missing', () => {
    win.statsig = {
      _user: { userID: 'u_2' },
    }

    expect(getUserDetailsFromPage()).toStrictEqual({
      context: undefined,
      href: globalThis.location.href,
      user: { userID: 'u_2' },
    })
  })

  it('falls back to identity.user and identity.stableID', () => {
    win.statsig = {
      identity: { stableID: 'stable_identity', user: { userID: 'u_3' } },
    }

    expect(getUserDetailsFromPage()).toStrictEqual({
      context: undefined,
      href: globalThis.location.href,
      stableId: { source: 'sdk', value: 'stable_identity' },
      user: { stableID: 'stable_identity', userID: 'u_3' },
    })
  })

  it('reads stableID via getContext when getStableID returns empty', () => {
    win.statsig = {
      getContext: () => ({ stableID: 'ctx_stable' }),
      getCurrentUser: () => ({ userID: 'u_4' }),
      getStableID: () => '',
    }

    const result = getUserDetailsFromPage()
    expect(result?.user).toStrictEqual({ stableID: 'ctx_stable', userID: 'u_4' })
    expect(result?.context).toStrictEqual({ stableID: 'ctx_stable' })
  })

  it('uses __STATSIG__.firstInstance context as stableID fallback', () => {
    win.statsig = {
      // No stableID anywhere on this instance.
      getCurrentUser: () => ({ userID: 'u_5' }),
    }
    win.__STATSIG__ = {
      firstInstance: {
        getContext: () => ({ stableID: 'first_instance_stable' }),
      },
      instance: () => ({}),
    }

    const result = getUserDetailsFromPage()
    expect(result?.user).toStrictEqual({ stableID: 'first_instance_stable', userID: 'u_5' })
  })

  it('prefers __STATSIG__ instances when window.statsig is absent', () => {
    win.__STATSIG__ = {
      instance: () => ({}),
      instances: {
        'client-1': {
          _stableID: 'react_stable',
          _user: { userID: 'u_react' },
        },
      },
    }

    expect(getUserDetailsFromPage()).toStrictEqual({
      context: undefined,
      href: globalThis.location.href,
      keys: { gateHashes: [], hashedSdkKeys: [], sdkKeys: ['client-1'] },
      stableId: { source: 'sdk', value: 'react_stable' },
      user: { stableID: 'react_stable', userID: 'u_react' },
    })
  })

  it('falls back to __STATSIG__.firstInstance when instances map is empty', () => {
    win.__STATSIG__ = {
      firstInstance: {
        _user: { userID: 'u_first' },
      },
      instance: () => ({}),
      instances: {},
    }

    expect(getUserDetailsFromPage()?.user).toStrictEqual({ userID: 'u_first' })
  })

  it('reads from __STATSIG_JS_SDK__ when other globals are missing', () => {
    win.__STATSIG_JS_SDK__ = {
      instance: {
        _user: { userID: 'u_js' },
      },
    }

    expect(getUserDetailsFromPage()?.user).toStrictEqual({ userID: 'u_js' })
  })

  it('returns an empty user object when getCurrentUser yields null but identity exists', () => {
    win.statsig = {
      _stableID: 'only_stable',
      identity: { user: {} },
    }

    expect(getUserDetailsFromPage()).toStrictEqual({
      context: undefined,
      href: globalThis.location.href,
      stableId: { source: 'sdk', value: 'only_stable' },
      user: { stableID: 'only_stable' },
    })
  })

  it('ignores window.statsig that lacks recognizable user fields', () => {
    win.statsig = {
      _stableID: 'unused',
    }

    expect(getUserDetailsFromPage()).toBeNull()
  })

  it('returns null when an exception is thrown during detection', () => {
    win.statsig = {
      get getCurrentUser() {
        throw new Error('boom')
      },
    }

    // Silence the catch — function swallows errors.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(getUserDetailsFromPage()).toBeNull()
    spy.mockRestore()
  })
})

describe('getUserDetailsFromPage key detection', () => {
  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
  })

  it('collects the client SDK key from every instance map and from the context', () => {
    win.__STATSIG__ = {
      acInstances: { 'client-autocapture': {} },
      instance: () => ({}),
      instances: {
        'client-main': {
          _user: { userID: 'u_1' },
          getContext: () => ({ sdkKey: 'client-context', values: {} }),
        },
      },
      srInstances: { 'client-replay': {} },
    }

    expect(getUserDetailsFromPage()?.keys).toStrictEqual({
      gateHashes: [],
      hashedSdkKeys: [],
      sdkKeys: ['client-main', 'client-replay', 'client-autocapture', 'client-context'],
    })
  })

  it('ignores instance keys that are not client SDK keys', () => {
    win.__STATSIG__ = {
      instance: () => ({}),
      instances: { 'not-a-key': { _user: { userID: 'u_1' } } },
    }

    expect(getUserDetailsFromPage()?.keys).toBeUndefined()
  })

  it('reads the hashed SDK key and the gate hashes from the evaluation payload', () => {
    win.statsig = {
      _user: { userID: 'u_1' },
      getContext: () => ({
        sdkKey: 'client-main',
        values: {
          feature_gates: { '111': {}, '222': {} },
          hash_used: 'djb2',
          hashed_sdk_key_used: '2447027979',
        },
      }),
    }

    expect(getUserDetailsFromPage()?.keys).toStrictEqual({
      gateHashes: ['111', '222'],
      hashedSdkKeys: ['2447027979'],
      sdkKeys: ['client-main'],
    })
  })

  it('hashes plain gate names when the payload is not hashed', () => {
    win.statsig = {
      _user: { userID: 'u_1' },
      getContext: () => ({
        values: { feature_gates: { a_gate: {} }, hash_used: 'none' },
      }),
    }

    expect(getUserDetailsFromPage()?.keys?.gateHashes).toStrictEqual([djb2('a_gate')])
  })

  it('skips gate hashes the Console API cannot reproduce', () => {
    win.statsig = {
      _user: { userID: 'u_1' },
      getContext: () => ({
        values: { feature_gates: { abc: {} }, hash_used: 'sha256', hashed_sdk_key_used: '123' },
      }),
    }

    expect(getUserDetailsFromPage()?.keys).toStrictEqual({
      gateHashes: [],
      hashedSdkKeys: ['123'],
      sdkKeys: [],
    })
  })

  it('falls back to the cached evaluations of a bootstrapped page', () => {
    globalThis.localStorage.setItem(
      'statsig.cached.evaluations.123',
      JSON.stringify({
        data: JSON.stringify({ feature_gates: { '999': {} }, hash_used: 'djb2', hashed_sdk_key_used: '2414204405' }),
      }),
    )
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.keys).toStrictEqual({
      gateHashes: ['999'],
      hashedSdkKeys: ['2414204405'],
      sdkKeys: [],
    })
  })

  it('ignores unrelated or malformed storage entries', () => {
    globalThis.localStorage.setItem('unrelated', 'value')
    globalThis.localStorage.setItem('statsig.cached.evaluations.1', 'not json')
    globalThis.localStorage.setItem('statsig.cached.evaluations.2', JSON.stringify({ data: 42 }))
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.keys).toBeUndefined()
  })
})

describe('getUserDetailsFromPage Stable ID lookup order', () => {
  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
  })

  it('prefers getStableID() over localStorage', () => {
    storeStableId()
    win.statsig = {
      getCurrentUser: () => ({ userID: 'u_1' }),
      getStableID: () => 'sdk_stable',
    }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'sdk', value: 'sdk_stable' })
    expect(result?.user).toStrictEqual({ stableID: 'sdk_stable', userID: 'u_1' })
  })

  it('reads getContext().stableID as source sdk', () => {
    storeStableId()
    win.statsig = {
      getContext: () => ({ stableID: 'ctx_stable' }),
      getCurrentUser: () => ({ userID: 'u_1' }),
    }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'sdk', value: 'ctx_stable' })
    expect(result?.user.stableID).toBe('ctx_stable')
  })

  it('reads the __STATSIG__.firstInstance context as source sdk', () => {
    storeStableId()
    win.statsig = { getCurrentUser: () => ({ userID: 'u_1' }) }
    win.__STATSIG__ = {
      firstInstance: { getContext: () => ({ stableID: 'first_instance_stable' }) },
      instance: () => ({}),
    }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'sdk', value: 'first_instance_stable' })
    expect(result?.user.stableID).toBe('first_instance_stable')
  })

  it('reads _stableID as source sdk', () => {
    storeStableId()
    win.statsig = { _stableID: 'private_stable', _user: { userID: 'u_1' } }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'sdk', value: 'private_stable' })
    expect(result?.user.stableID).toBe('private_stable')
  })

  it('reads identity.stableID as source sdk', () => {
    storeStableId()
    win.statsig = { identity: { stableID: 'identity_stable', user: { userID: 'u_1' } } }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'sdk', value: 'identity_stable' })
    expect(result?.user.stableID).toBe('identity_stable')
  })

  it('falls through to localStorage when every SDK lookup is empty', () => {
    storeStableId()
    win.statsig = {
      getContext: () => ({ stableID: '' }),
      getCurrentUser: () => ({ userID: 'u_1' }),
      getStableID: () => '',
    }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'localStorage', value: 'stored_stable' })
    expect(result?.user).toStrictEqual({ stableID: 'stored_stable', userID: 'u_1' })
  })

  it('falls through to localStorage when an SDK lookup returns something other than a string', () => {
    storeStableId()
    win.statsig = {
      getCurrentUser: () => ({ userID: 'u_1' }),
      getStableID: () => ({ not: 'a string' }),
    }

    expect(getUserDetailsFromPage()?.stableId).toStrictEqual({ source: 'localStorage', value: 'stored_stable' })
  })

  it('leaves stableId out when the SDK and localStorage have no Stable ID', () => {
    win.statsig = { _user: { userID: 'u_1' } }

    const result = getUserDetailsFromPage()
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('stableId')
    expect(result?.user).toStrictEqual({ userID: 'u_1' })
  })

  it.each([
    ['statsig.stable_id.123', '"id_123"', 'id_123'],
    ['statsig.stable_id.98765', '"id_98765"', 'id_98765'],
    ['statsig.stable_id.0', '"id_0"', 'id_0'],
  ])('matches the key %s whatever number ends it', (key, raw, expected) => {
    globalThis.localStorage.setItem(key, raw)
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.stableId).toStrictEqual({ source: 'localStorage', value: expected })
  })

  it('parses a JSON-encoded value', () => {
    globalThis.localStorage.setItem('statsig.stable_id.123', JSON.stringify('json_stable'))
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.stableId).toStrictEqual({ source: 'localStorage', value: 'json_stable' })
  })

  it('uses a raw value that is not valid JSON', () => {
    globalThis.localStorage.setItem('statsig.stable_id.123', 'raw-stable-id')
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.stableId).toStrictEqual({ source: 'localStorage', value: 'raw-stable-id' })
  })

  it('trims the localStorage value', () => {
    globalThis.localStorage.setItem('statsig.stable_id.123', JSON.stringify('  padded_stable  '))
    win.statsig = { _user: { userID: 'u_1' } }

    const result = getUserDetailsFromPage()
    expect(result?.stableId).toStrictEqual({ source: 'localStorage', value: 'padded_stable' })
    expect(result?.user.stableID).toBe('padded_stable')
  })

  it.each([
    ['an empty raw value', ''],
    ['an empty JSON string', '""'],
    ['a blank JSON string', '"   "'],
    ['a blank raw value', '   '],
    ['a JSON number', '12345'],
    ['a JSON object', '{"id":"nested"}'],
    ['JSON null', 'null'],
  ])('skips %s and uses the next matching key', (_name, unusable) => {
    globalThis.localStorage.setItem('statsig.stable_id.1', unusable)
    globalThis.localStorage.setItem('statsig.stable_id.2', JSON.stringify('second_key'))
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.stableId).toStrictEqual({ source: 'localStorage', value: 'second_key' })
  })

  it('takes the first usable matching key in index order', () => {
    globalThis.localStorage.setItem('unrelated', 'value')
    globalThis.localStorage.setItem('statsig.stable_id.1', JSON.stringify('first_key'))
    globalThis.localStorage.setItem('statsig.stable_id.2', JSON.stringify('second_key'))
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.stableId).toStrictEqual({ source: 'localStorage', value: 'first_key' })
  })

  it('does not match a key that only contains the prefix in the middle', () => {
    globalThis.localStorage.setItem('x.statsig.stable_id.1', JSON.stringify('wrong_key'))
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()).not.toHaveProperty('stableId')
  })

  it('has no localStorage Stable ID when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      key: () => {
        throw new Error('SecurityError')
      },
      get length(): number {
        throw new Error('SecurityError')
      },
    })
    win.statsig = { _user: { userID: 'u_1' } }

    try {
      const result = getUserDetailsFromPage()
      expect(result?.user).toStrictEqual({ userID: 'u_1' })
      expect(result).not.toHaveProperty('stableId')
    } finally {
      // The afterEach hook clears the real storage, so the stub has to go first.
      vi.unstubAllGlobals()
    }
  })

  it('ignores a cookie that holds a Stable ID', () => {
    document.cookie = 'statsig.stable_id.1=cookie_stable'
    // The cookie has to be readable for this test to prove anything.
    expect(document.cookie).toContain('cookie_stable')
    win.statsig = { _user: { userID: 'u_1' } }

    try {
      const result = getUserDetailsFromPage()
      expect(result).not.toHaveProperty('stableId')
      expect(result?.user).toStrictEqual({ userID: 'u_1' })

      cleanup()
      expect(getUserDetailsFromPage()).toBeNull()
    } finally {
      document.cookie = 'statsig.stable_id.1=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  })
})

describe('getUserDetailsFromPage without an SDK instance', () => {
  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
  })

  it('returns the localStorage Stable ID, the href, and nothing else', () => {
    globalThis.localStorage.setItem('statsig.stable_id.123', JSON.stringify('lonely_stable'))

    expect(getUserDetailsFromPage()).toStrictEqual({
      href: globalThis.location.href,
      stableId: { source: 'localStorage', value: 'lonely_stable' },
      user: { stableID: 'lonely_stable' },
    })
  })

  it('returns null when there is no instance and no localStorage Stable ID', () => {
    globalThis.localStorage.setItem('unrelated', 'value')
    globalThis.localStorage.setItem('x.statsig.stable_id.1', JSON.stringify('wrong_key'))
    globalThis.localStorage.setItem('statsig.stable_id.2', '""')

    expect(getUserDetailsFromPage()).toBeNull()
  })
})

describe('getUserDetailsFromPage environment tier and href', () => {
  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
  })

  it('reads context.options.environment.tier', () => {
    withContext({ options: { environment: { tier: 'staging' } } })

    expect(getUserDetailsFromPage()?.environmentTier).toBe('staging')
  })

  it('leaves environmentTier out when the context has no tier', () => {
    withContext({ options: { environment: {} } })

    expect(getUserDetailsFromPage()).not.toHaveProperty('environmentTier')
  })

  it.each([
    ['a number', 5],
    ['null', null],
    ['an object', { name: 'staging' }],
    ['an empty string', ''],
  ])('leaves environmentTier out when the tier is %s', (_name, tier) => {
    withContext({ options: { environment: { tier } } })

    expect(getUserDetailsFromPage()).not.toHaveProperty('environmentTier')
  })

  it.each([
    ['options is missing', {}],
    ['options is not a record', { options: 'staging' }],
    ['environment is missing', { options: {} }],
    ['environment is not a record', { options: { environment: 'staging' } }],
  ])('leaves environmentTier out when %s', (_name, context) => {
    withContext(context)

    expect(getUserDetailsFromPage()).not.toHaveProperty('environmentTier')
  })

  it('leaves environmentTier out when the instance has no getContext', () => {
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()).not.toHaveProperty('environmentTier')
  })

  it('returns the page href with an instance', () => {
    win.statsig = { _user: { userID: 'u_1' } }

    expect(getUserDetailsFromPage()?.href).toBe(globalThis.location.href)
  })

  it('returns the page href without an instance', () => {
    globalThis.localStorage.setItem('statsig.stable_id.1', JSON.stringify('lonely_stable'))

    expect(getUserDetailsFromPage()?.href).toBe(globalThis.location.href)
  })
})
