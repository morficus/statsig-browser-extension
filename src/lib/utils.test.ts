import { describe, expect, it } from 'vitest'

import { NetworkError, cn, handleApiError } from './utils'

describe('shared library helpers', () => {
  it('merges class names with tailwind precedence', () => {
    expect(cn('px-2', undefined, false, 'px-4', 'text-sm')).toBe('px-4 text-sm')
  })

  describe('write failures (REQ-OVR-016)', () => {
    const KEY_NOT_VALID = 'The Console Key is not valid. Check the key, then try again.'
    const READ_ONLY_KEY = 'Read-only key. Add a key with write access to change overrides.'
    const KEY_NOT_ALLOWED = 'The Console Key is not allowed to do this. Ask someone from engineering for help.'
    const RATE_LIMITED = 'Too many requests to Statsig right now. Wait a few minutes, then try again.'
    const NO_NETWORK = 'Cannot reach Statsig. Check your network connection, then try again.'

    it('maps a 401 with the plain-text body to "key not valid"', () => {
      expect(
        handleApiError({
          message: 'Unauthorized',
          response: { _data: 'Unauthorized' },
          status: 401,
        }),
      ).toBe(KEY_NOT_VALID)
    })

    it('maps a 401 with no body to "key not valid"', () => {
      expect(
        handleApiError({
          message: '',
          response: { _data: undefined },
          status: 401,
        }),
      ).toBe(KEY_NOT_VALID)
    })

    it('maps a 401 with the read-only JSON body to "read-only key"', () => {
      expect(
        handleApiError({
          message: '{"message":"Read only API keys can not modify entities","status":401}',
          response: { _data: { message: 'Read only API keys can not modify entities', status: 401 } },
          status: 401,
        }),
      ).toBe(READ_ONLY_KEY)
    })

    it('maps a 401 with a JSON body that does not say read only to "key not valid"', () => {
      expect(
        handleApiError({
          message: 'Unauthorized',
          response: { _data: { message: 'Unauthorized', status: 401 } },
          status: 401,
        }),
      ).toBe(KEY_NOT_VALID)
    })

    it('maps a 403 to "key not allowed"', () => {
      expect(
        handleApiError({
          message: 'Forbidden',
          response: { _data: { error: 'ignored' } },
          status: 403,
        }),
      ).toBe(KEY_NOT_ALLOWED)
    })

    it('maps a 429 to the rate limit message', () => {
      expect(
        handleApiError({
          message: 'Too Many Requests',
          response: { _data: { message: 'ignored' } },
          status: 429,
        }),
      ).toBe(RATE_LIMITED)
    })

    it('maps a NetworkError to the network message', () => {
      expect(handleApiError(new NetworkError('Failed to fetch'))).toBe(NO_NETWORK)
    })

    it('gives a NetworkError the NetworkError name', () => {
      const error = new NetworkError('Failed to fetch')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('NetworkError')
      expect(error.message).toBe('Failed to fetch')
    })
  })

  it.each([
    [403, 'The Console Key is not allowed to do this. Ask someone from engineering for help.'],
    [429, 'Too many requests to Statsig right now. Wait a few minutes, then try again.'],
    [404, 'The requested resource was not found.'],
    [500, 'Server error. Please try again later.'],
    [503, 'Server error. Please try again later.'],
  ])('maps a %i by status when the body is empty, undefined, or plain text', (status, expected) => {
    for (const data of ['', undefined, 'plain text body']) {
      expect(handleApiError({ message: 'raw body', response: { _data: data }, status })).toBe(expected)
    }
  })

  it('maps a 404 to a friendly message', () => {
    expect(
      handleApiError({
        message: 'Not Found',
        response: { _data: { message: 'ignored' } },
        status: 404,
      }),
    ).toBe('The requested resource was not found.')
  })

  it('returns a generic server error for 5xx responses', () => {
    expect(
      handleApiError({
        message: 'Internal Server Error',
        response: { _data: { message: 'backend exploded' } },
        status: 500,
      }),
    ).toBe('Server error. Please try again later.')
  })

  it('returns API payload messages when a mapped status does not apply', () => {
    expect(
      handleApiError({
        message: 'Conflict',
        response: { _data: { message: 'Duplicate override' } },
        status: 409,
      }),
    ).toBe('Duplicate override')

    expect(
      handleApiError({
        message: 'Bad Request',
        response: { _data: { error: 'Malformed payload' } },
        status: 400,
      }),
    ).toBe('Malformed payload')
  })

  it('falls back to the original error message when no payload message exists', () => {
    expect(
      handleApiError({
        message: 'Request failed',
        response: { _data: 'not-an-object' },
        status: 422,
      }),
    ).toBe('Request failed')
  })

  it('redacts a console key in the payload message of an unmapped status', () => {
    expect(
      handleApiError({
        message: 'I am a teapot',
        response: { _data: { message: 'Bad key console-AbC123xyz_456-DEF' } },
        status: 418,
      }),
    ).toBe('Bad key console-…')
  })

  it('falls back to the redacted error message when the payload message is not a string', () => {
    const message = handleApiError({
      message: 'Bad Request',
      response: { _data: { message: ['console-abc123'] } },
      status: 400,
    })

    expect(message).toBe('Bad Request')
    expect(message).not.toContain('console-abc123')

    const leaky = handleApiError({
      message: 'Key: console-abc123',
      response: { _data: { error: { detail: 'console-abc123' } } },
      status: 400,
    })

    expect(leaky).toBe('Key: console-…')
  })

  it('returns native error messages and unknown fallbacks', () => {
    expect(handleApiError(new Error('Boom'))).toBe('Boom')
    expect(handleApiError(null)).toBe('An unknown error occurred')
    expect(handleApiError('boom')).toBe('An unknown error occurred')
  })
})

describe('handleApiError key redaction (REQ-SEC-003)', () => {
  const LEAKY_BODY =
    'This endpoint only accepts an active CONSOLE key, but an invalid key was sent. Key: console-AbC123xyz_456-DEF'

  it('does not echo a console key found in a payload message', () => {
    const message = handleApiError({
      message: 'Bad Request',
      response: { _data: { message: LEAKY_BODY } },
      status: 400,
    })

    expect(message).not.toContain('console-AbC123xyz_456-DEF')
    expect(message).toContain('Key: console-…')
  })

  it('does not echo a console key found in a payload error field', () => {
    const message = handleApiError({
      message: 'Bad Request',
      response: { _data: { error: LEAKY_BODY } },
      status: 422,
    })

    expect(message).not.toContain('console-AbC123xyz_456-DEF')
  })

  it('does not echo a console key found in the raw wretch message (the response body text)', () => {
    const message = handleApiError({
      message: LEAKY_BODY,
      response: { _data: 'not-an-object' },
      status: 422,
    })

    expect(message).not.toContain('console-AbC123xyz_456-DEF')
  })

  it('does not echo a console key when a 401 comes with an empty parsed body', () => {
    const message = handleApiError({
      message: LEAKY_BODY,
      response: { _data: undefined },
      status: 401,
    })

    expect(message).not.toContain('console-AbC123xyz_456-DEF')
  })

  it('does not echo a console key found in a native error message', () => {
    expect(handleApiError(new Error(LEAKY_BODY))).not.toContain('console-AbC123xyz_456-DEF')
  })

  it('leaves messages without a key unchanged', () => {
    expect(handleApiError(new Error('API key should start with "console-"'))).toBe(
      'API key should start with "console-"',
    )
  })
})
