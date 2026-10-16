import { beforeEach, vi, describe, expect, it } from 'vitest'

import { useSettingsStore } from '@/src/store/use-settings-store'

import { API_BASE_URL } from './api-config'
import { api, fetcher, poster } from './fetcher'
import { NetworkError, handleApiError } from './utils'

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}))

vi.mock(import('wxt/browser'), async (importOriginal) => ({
  ...(await importOriginal()),
  browser: {
    runtime: {
      sendMessage: sendMessageMock,
    },
  } as any,
}))

describe('custom fetch bridge', () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    useSettingsStore.setState({ apiKey: '' })
  })

  it('fetches JSON data through the background script', async () => {
    sendMessageMock.mockResolvedValue({
      response: {
        data: { ok: true },
        headers: { 'content-type': 'application/json' },
        status: 200,
        statusText: 'OK',
      },
      success: true,
    })

    await expect(fetcher<{ ok: boolean }>('/feature-gates')).resolves.toStrictEqual({ ok: true })

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith({
      config: {
        body: undefined,
        headers: undefined,
        method: 'GET',
        url: `${API_BASE_URL}/feature-gates`,
      },
      type: 'API_REQUEST',
    })
  })

  it('binds a request to the active key before background delivery', async () => {
    useSettingsStore.setState({ apiKey: 'console-a' })
    const delivery = Promise.withResolvers<unknown>()
    sendMessageMock.mockReturnValue(delivery.promise)

    const request = poster('/gates/shared/overrides', { passingUserIDs: ['user-a'] })
    useSettingsStore.setState({ apiKey: 'console-b' })
    delivery.resolve({ response: { data: {}, headers: {}, status: 200, statusText: 'OK' }, success: true })
    await request

    const expectedHeaders = expect.objectContaining({ 'STATSIG-API-KEY': 'console-a' })
    const expectedConfig = expect.objectContaining({ headers: expectedHeaders })
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ config: expectedConfig }))
  })

  it('preserves an explicit key when verifying another project', async () => {
    useSettingsStore.setState({ apiKey: 'console-active' })
    sendMessageMock.mockResolvedValue({
      response: { data: {}, headers: {}, status: 200, statusText: 'OK' },
      success: true,
    })

    await api.headers({ 'STATSIG-API-KEY': 'console-explicit' }).url('/gates?limit=1').get().json()

    const expectedHeaders = expect.objectContaining({ 'STATSIG-API-KEY': 'console-explicit' })
    const expectedConfig = expect.objectContaining({ headers: expectedHeaders })
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ config: expectedConfig }))
  })

  it('posts data through the background script', async () => {
    sendMessageMock.mockResolvedValue({
      response: {
        data: { created: true },
        headers: { 'content-type': 'application/json' },
        status: 200,
        statusText: 'OK',
      },
      success: true,
    })

    await expect(poster<{ created: boolean }>('/overrides', { id: 'gate_1' })).resolves.toStrictEqual({
      created: true,
    })

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const [[callArg]] = sendMessageMock.mock.calls
    expect(callArg).toMatchObject({
      config: {
        method: 'POST',
        url: `${API_BASE_URL}/overrides`,
      },
      type: 'API_REQUEST',
    })
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access
    expect(JSON.parse(callArg.config.body)).toStrictEqual({ id: 'gate_1' })
  })

  it('parses string response payloads from the background script', async () => {
    sendMessageMock.mockResolvedValue({
      response: {
        data: JSON.stringify({ ok: true }),
        headers: { 'content-type': 'application/json' },
        status: 200,
        statusText: 'OK',
      },
      success: true,
    })

    await expect(fetcher<{ ok: boolean }>('/health')).resolves.toStrictEqual({ ok: true })
  })

  it('throws when the background response shape is invalid', async () => {
    sendMessageMock.mockResolvedValue({ invalid: true })

    await expect(fetcher('/invalid')).rejects.toThrow('Invalid response from background script')
  })

  it('throws when the background sends nothing back', async () => {
    sendMessageMock.mockResolvedValue(null)

    await expect(fetcher('/gone')).rejects.toThrow('Invalid response from background script')
  })

  it('throws when the background sends back a bare string', async () => {
    sendMessageMock.mockResolvedValue('boom')

    await expect(fetcher('/gone')).rejects.toThrow('Invalid response from background script')
  })

  it('throws a generic error when the failure carries no message', async () => {
    sendMessageMock.mockResolvedValue({ success: false })

    await expect(fetcher('/forbidden')).rejects.toThrow('Unknown error')
  })

  it('throws when the call succeeded but carries no response', async () => {
    sendMessageMock.mockResolvedValue({ success: true })

    await expect(fetcher('/empty')).rejects.toThrow('Unknown error')
  })

  it('throws the background error when the request fails', async () => {
    sendMessageMock.mockResolvedValue({
      error: 'Forbidden',
      success: false,
    })

    await expect(fetcher('/forbidden')).rejects.toThrow('Forbidden')
  })

  describe('background failures (REQ-OVR-016)', () => {
    it('throws a NetworkError when the background marks the failure as a network error', async () => {
      sendMessageMock.mockResolvedValue({ error: 'Failed to fetch', networkError: true, success: false })

      const error: unknown = await fetcher('/offline').catch((error_: unknown) => error_)

      expect(error).toBeInstanceOf(NetworkError)
      expect(error).toHaveProperty('message', 'Failed to fetch')
    })

    it('uses a default message when a network error carries none', async () => {
      sendMessageMock.mockResolvedValue({ networkError: true, success: false })

      const error: unknown = await fetcher('/offline').catch((error_: unknown) => error_)

      expect(error).toBeInstanceOf(NetworkError)
      expect(error).toHaveProperty('message', 'Network error')
    })

    it('keeps a TypeError for a failure without the network flag', async () => {
      sendMessageMock.mockResolvedValue({ error: "This request isn't allowed", success: false })

      const error: unknown = await fetcher('/refused').catch((error_: unknown) => error_)

      expect(error).toBeInstanceOf(TypeError)
      expect(error).not.toBeInstanceOf(NetworkError)
    })

    it('keeps a TypeError when the network flag is not true', async () => {
      sendMessageMock.mockResolvedValue({ error: 'nope', networkError: false, success: false })

      const error: unknown = await fetcher('/refused').catch((error_: unknown) => error_)

      expect(error).toBeInstanceOf(TypeError)
      expect(error).not.toBeInstanceOf(NetworkError)
    })

    it('reaches the caller of fetcher as an error that handleApiError maps to the network message', async () => {
      sendMessageMock.mockResolvedValue({ error: 'Failed to fetch', networkError: true, success: false })

      const error: unknown = await fetcher('/offline').catch((error_: unknown) => error_)

      expect(handleApiError(error)).toBe('Cannot reach Statsig. Check your network connection, then try again.')
    })

    it('reaches the caller of api and poster as the same network message', async () => {
      sendMessageMock.mockResolvedValue({ error: 'Failed to fetch', networkError: true, success: false })

      const apiError: unknown = await api
        .url('/experiments/exp/overrides')
        .patch({ ids: [] })
        .json()
        .catch((error_: unknown) => error_)
      const posterError: unknown = await poster('/gates/g/overrides', {}).catch((error_: unknown) => error_)

      expect(handleApiError(apiError)).toBe('Cannot reach Statsig. Check your network connection, then try again.')
      expect(handleApiError(posterError)).toBe('Cannot reach Statsig. Check your network connection, then try again.')
    })

    it('maps a plain-text 401 from the background to "key not valid"', async () => {
      sendMessageMock.mockResolvedValue({
        response: { data: 'Unauthorized', headers: {}, status: 401, statusText: 'Unauthorized' },
        success: true,
      })

      const error: unknown = await fetcher('/experiments').catch((error_: unknown) => error_)

      expect(handleApiError(error)).toBe('The Console Key is not valid. Check the key, then try again.')
    })

    it('maps the read-only JSON 401 from the background to "read-only key"', async () => {
      sendMessageMock.mockResolvedValue({
        response: {
          data: { message: 'Read only API keys can not modify entities', status: 401 },
          headers: { 'content-type': 'application/json' },
          status: 401,
          statusText: 'Unauthorized',
        },
        success: true,
      })

      const error: unknown = await api
        .url('/experiments/exp/overrides')
        .patch({})
        .json()
        .catch((error_: unknown) => error_)

      expect(handleApiError(error)).toBe('Read-only key. Add a key with write access to change overrides.')
    })
  })

  it('handles non-JSON content types correctly', async () => {
    // The fetcher returns the data as-is when it's already an object
    sendMessageMock.mockResolvedValue({
      response: {
        data: { message: 'plain text response' },
        headers: { 'content-type': 'text/plain' },
        status: 200,
        statusText: 'OK',
      },
      success: true,
    })

    // The fetcher will return the parsed data object
    await expect(fetcher('/plain')).resolves.toStrictEqual({ message: 'plain text response' })
  })

  it('handles empty data field', async () => {
    sendMessageMock.mockResolvedValue({
      response: {
        data: null,
        headers: { 'content-type': 'application/json' },
        status: 204,
        statusText: 'No Content',
      },
      success: true,
    })

    await expect(fetcher('/no-content')).resolves.toBeNull()
  })

  it('handles array response payloads', async () => {
    sendMessageMock.mockResolvedValue({
      response: {
        data: [{ id: 1 }, { id: 2 }],
        headers: { 'content-type': 'application/json' },
        status: 200,
        statusText: 'OK',
      },
      success: true,
    })

    await expect(fetcher<{ id: number }[]>('/list')).resolves.toStrictEqual([{ id: 1 }, { id: 2 }])
  })
})
