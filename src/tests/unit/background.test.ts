import { beforeEach, describe, expect, it, vi } from 'vitest'

import { API_BASE_URL } from '@/src/lib/api-config'

const addListener = vi.fn()
const getValue = vi.fn()
const getKeyType = vi.fn()
const EXTENSION_URL = 'chrome-extension://test-extension-id/'
const extensionSender = { url: `${EXTENSION_URL}popup.html` }

vi.mock('wxt/utils/define-background', () => ({
  defineBackground: (fn: () => void) => {
    fn()
    return fn
  },
}))

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: () => EXTENSION_URL,
      onMessage: {
        addListener,
      },
    },
  },
}))

vi.mock('@/src/lib/storage', () => ({
  apiKeyStorage: {
    getValue,
  },
  apiKeyTypeStorage: {
    getValue: getKeyType,
  },
}))

type MessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean

const loadListener = async (): Promise<MessageListener> => {
  addListener.mockClear()
  vi.resetModules()
  await import('@/entrypoints/background')
  const listener = addListener.mock.calls[0]?.[0] as MessageListener | undefined
  if (!listener) {
    throw new Error('background script did not register an onMessage listener')
  }
  return listener
}

const jsonResponse = (body: unknown, init: Partial<Response> = {}) =>
  ({
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        callback('application/json', 'content-type')
      },
    },
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    url: init.url ?? `${API_BASE_URL}/gates`,
  }) as Response

describe('background API proxy', () => {
  beforeEach(() => {
    getValue.mockReset()
    getKeyType.mockReset()
    getKeyType.mockResolvedValue('write-key')
    vi.unstubAllGlobals()
  })

  it('ignores messages that are not API_REQUEST with a config', async () => {
    const listener = await loadListener()
    const sendResponse = vi.fn()

    expect(listener('ping', extensionSender, sendResponse)).toBeFalsy()
    expect(listener({ type: 'PING' }, extensionSender, sendResponse)).toBeFalsy()
    expect(listener({ type: 'API_REQUEST' }, extensionSender, sendResponse)).toBeFalsy()
    expect(sendResponse).not.toHaveBeenCalled()
  })

  it('injects the stored API key and forwards a JSON response', async () => {
    getValue.mockResolvedValue('"console-quoted-key"')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'g1' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    const keepChannel = listener(
      {
        config: {
          headers: { Accept: 'application/json' },
          method: 'GET',
          url: `${API_BASE_URL}/gates`,
        },
        type: 'API_REQUEST',
      },
      extensionSender,
      sendResponse,
    )

    expect(keepChannel).toBeTruthy()
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        response: {
          data: { data: [{ id: 'g1' }] },
          headers: { 'content-type': 'application/json' },
          ok: true,
          status: 200,
          statusText: 'OK',
          url: `${API_BASE_URL}/gates`,
        },
        success: true,
      })
    })

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/gates`, {
      body: undefined,
      headers: {
        Accept: 'application/json',
        'STATSIG-API-KEY': 'console-quoted-key',
        'STATSIG-API-VERSION': '20240601',
      },
      method: 'GET',
      redirect: 'error',
    })
  })

  it('forwards only Accept, Content-Type, the key and the version header', async () => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      {
        config: {
          body: '{}',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Foo': 'bar',
            'X-HTTP-Method-Override': 'DELETE',
          },
          method: 'POST',
          url: `${API_BASE_URL}/gates/my_gate/overrides`,
        },
        type: 'API_REQUEST',
      },
      extensionSender,
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/gates/my_gate/overrides`, {
      body: '{}',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'STATSIG-API-KEY': 'console-stored',
        'STATSIG-API-VERSION': '20240601',
      },
      method: 'POST',
      redirect: 'error',
    })
  })

  it.each(['STATSIG-API-KEY', 'statsig-api-key'])('preserves an explicit %s header', async (headerName) => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('not-json'))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      {
        config: {
          body: '{"name":"gate"}',
          headers: { [headerName]: 'console-explicit' },
          method: 'POST',
          url: `${API_BASE_URL}/gates/my_gate/overrides`,
        },
        type: 'API_REQUEST',
      },
      extensionSender,
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/gates/my_gate/overrides`, {
      body: '{"name":"gate"}',
      headers: { [headerName]: 'console-explicit', 'STATSIG-API-VERSION': '20240601' },
      method: 'POST',
      redirect: 'error',
    })
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        response: expect.objectContaining({ data: 'not-json' }),
        success: true,
      }),
    )
  })

  it('returns a network error when fetch rejects', async () => {
    getValue.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener({ config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' }, extensionSender, sendResponse)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: 'offline', success: false })
    })
  })

  it('falls back to a generic message when fetch rejects a non-Error', async () => {
    getValue.mockResolvedValue('')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('boom'))

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener({ config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' }, extensionSender, sendResponse)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: 'Network error', success: false })
    })
  })

  it('keeps a caller-supplied STATSIG-API-VERSION header', async () => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      { config: { headers: { 'statsig-api-version': '19990101' }, url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' },
      extensionSender,
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/gates`, {
      body: undefined,
      headers: { 'STATSIG-API-KEY': 'console-stored', 'statsig-api-version': '19990101' },
      method: 'GET',
      redirect: 'error',
    })
  })

  it.each([
    'https://evil.example/x',
    'https://statsigapi.net.evil.com/console/v1/gates',
    'http://statsigapi.net/console/v1/gates',
    'https://statsigapi.net/console/v1evil',
    '/console/v1/gates',
  ])('refuses %s without reading the key or calling fetch', async (url) => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      { config: { headers: { 'STATSIG-API-KEY': 'k' }, url }, type: 'API_REQUEST' },
      extensionSender,
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        error: "This request isn't allowed by Intake Experiment Testing.",
        success: false,
      })
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getValue).not.toHaveBeenCalled()
  })

  it('refuses a sender with a web page URL without reading the key or calling fetch', async () => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      { config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' },
      { url: 'https://example.com/page' },
      sendResponse,
    )

    expect(sendResponse).toHaveBeenCalledWith({
      error: "This request isn't allowed by Intake Experiment Testing.",
      success: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getValue).not.toHaveBeenCalled()
  })

  it.each([{}, { url: undefined }, { url: 'chrome-extension://other-extension-id/popup.html' }])(
    'refuses a sender without an extension URL: %j',
    async (sender) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const listener = await loadListener()
      const sendResponse = vi.fn()
      listener({ config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' }, sender, sendResponse)

      expect(sendResponse).toHaveBeenCalledWith({
        error: "This request isn't allowed by Intake Experiment Testing.",
        success: false,
      })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(getValue).not.toHaveBeenCalled()
    },
  )

  it('accepts a sender with the extension URL', async () => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      { config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' },
      { url: `${EXTENSION_URL}popup.html` },
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['POST', `${API_BASE_URL}/gates`],
    ['PUT', `${API_BASE_URL}/gates/my_gate/overrides`],
    ['DELETE', `${API_BASE_URL}/layers/my_layer`],
    ['POST', `${API_BASE_URL}/audit_logs`],
  ])('refuses the write %s %s without reading the key or calling fetch', async (method, url) => {
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener({ config: { method, url }, type: 'API_REQUEST' }, extensionSender, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({
      error: "This request isn't allowed by Intake Experiment Testing.",
      success: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getValue).not.toHaveBeenCalled()
  })

  it('refuses an allowed write with a read-only key without calling fetch', async () => {
    getKeyType.mockResolvedValue('read-key')
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    const keepChannel = listener(
      { config: { method: 'POST', url: `${API_BASE_URL}/gates/my_gate/overrides` }, type: 'API_REQUEST' },
      extensionSender,
      sendResponse,
    )

    expect(keepChannel).toBeTruthy()
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Read-only key. Add a key with write access to change overrides.',
        success: false,
      })
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls fetch for an allowed write with a write key', async () => {
    getKeyType.mockResolvedValue('write-key')
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      { config: { method: 'patch', url: `${API_BASE_URL}/experiments/exp/overrides` }, type: 'API_REQUEST' },
      extensionSender,
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/experiments/exp/overrides`,
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('still calls fetch for a GET with a read-only key without consulting the key type', async () => {
    getKeyType.mockResolvedValue('read-key')
    getValue.mockResolvedValue('console-stored')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener(
      { config: { method: 'GET', url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' },
      extensionSender,
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getKeyType).not.toHaveBeenCalled()
  })
})
