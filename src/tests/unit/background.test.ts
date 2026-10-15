import { beforeEach, describe, expect, it, vi } from 'vitest'

import { API_BASE_URL } from '@/src/lib/api-config'

const addListener = vi.fn()
const getValue = vi.fn()

vi.mock('wxt/utils/define-background', () => ({
  defineBackground: (fn: () => void) => {
    fn()
    return fn
  },
}))

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
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
    vi.unstubAllGlobals()
  })

  it('ignores messages that are not API_REQUEST with a config', async () => {
    const listener = await loadListener()
    const sendResponse = vi.fn()

    expect(listener('ping', {}, sendResponse)).toBeFalsy()
    expect(listener({ type: 'PING' }, {}, sendResponse)).toBeFalsy()
    expect(listener({ type: 'API_REQUEST' }, {}, sendResponse)).toBeFalsy()
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
      {},
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
          url: `${API_BASE_URL}/gates`,
        },
        type: 'API_REQUEST',
      },
      {},
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/gates`, {
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
    listener({ config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' }, {}, sendResponse)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ error: 'offline', success: false })
    })
  })

  it('falls back to a generic message when fetch rejects a non-Error', async () => {
    getValue.mockResolvedValue('')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('boom'))

    const listener = await loadListener()
    const sendResponse = vi.fn()
    listener({ config: { url: `${API_BASE_URL}/gates` }, type: 'API_REQUEST' }, {}, sendResponse)

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
      {},
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/gates`, {
      body: undefined,
      headers: { 'STATSIG-API-KEY': 'console-stored', 'statsig-api-version': '19990101' },
      method: undefined,
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
    listener({ config: { headers: { 'STATSIG-API-KEY': 'k' }, url }, type: 'API_REQUEST' }, {}, sendResponse)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        error: "This request isn't allowed by Intake Experiment Testing.",
        success: false,
      })
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getValue).not.toHaveBeenCalled()
  })
})
