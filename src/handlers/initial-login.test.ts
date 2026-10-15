import { beforeEach, vi, describe, expect, it } from 'vitest'

import { initialLogin } from './initial-login'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    headers: vi.fn(),
    json: vi.fn(),
    url: vi.fn(),
  },
}))

vi.mock(import('@/src/lib/fetcher'), () => ({
  api: apiMock as any,
}))

describe('initialLogin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup mock chain
    apiMock.headers.mockReturnValue(apiMock)
    apiMock.url.mockReturnValue(apiMock)
    apiMock.get.mockReturnValue(apiMock)
  })

  it('should return success when API call succeeds', async () => {
    const mockResponse = { data: [{ id: 'gate_1', name: 'Test Gate' }] }
    apiMock.json.mockResolvedValue(mockResponse)

    const result = await initialLogin('console-valid-key')

    expect(result.success).toBeTruthy()
    expect(result.error).toBeUndefined()
    expect(result.data).toStrictEqual([{ id: 'gate_1', name: 'Test Gate' }])
    expect(apiMock.headers).toHaveBeenCalledWith({ 'STATSIG-API-KEY': 'console-valid-key' })
    expect(apiMock.url).toHaveBeenCalledWith('/gates?limit=1')
  })

  it('should return error when API call fails', async () => {
    const error = new Error('Unauthorized')
    apiMock.json.mockRejectedValue(error)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await initialLogin('console-invalid-key')

    expect(result.success).toBeFalsy()
    expect(result.error).toBe('Unauthorized')
    expect(result.data).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith('Failed to login:', 'Unauthorized')
  })

  it('should never put the Console Key in the returned error or in console output (REQ-SEC-003)', async () => {
    const key = 'console-AbC123xyz456'
    const body = `This endpoint only accepts an active CONSOLE key, but an invalid key was sent. Key: ${key}`
    const wretchError = Object.assign(new Error(body), {
      response: { _data: body },
      status: 429,
      text: body,
      url: 'https://statsigapi.net/console/v1/gates?limit=1',
    })
    apiMock.json.mockRejectedValue(wretchError)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await initialLogin(key)

    expect(result.success).toBeFalsy()
    expect(JSON.stringify(result)).not.toContain(key)
    expect(errorSpy.mock.calls.flat().map(String).join(' ')).not.toContain(key)
    expect(errorSpy).toHaveBeenCalledWith('Failed to login:', expect.any(String))
  })

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network Error')
    apiMock.json.mockRejectedValue(networkError)

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await initialLogin('console-test-key')

    expect(result.success).toBeFalsy()
    expect(result.error).toBe('Network Error')
  })

  it('should extract data.data from the response', async () => {
    const mockResponse = {
      data: {
        items: [],
        pagination: { total: 100 },
      },
    }
    apiMock.json.mockResolvedValue(mockResponse)

    const result = await initialLogin('console-test-key')

    expect(result.data).toStrictEqual({ items: [], pagination: { total: 100 } })
  })

  it('should handle undefined response data', async () => {
    apiMock.json.mockResolvedValue({ data: undefined })

    const result = await initialLogin('console-test-key')

    expect(result.success).toBeTruthy()
    expect(result.data).toBeUndefined()
  })
})
