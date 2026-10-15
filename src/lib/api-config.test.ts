import { describe, expect, it } from 'vitest'

import { API_BASE_URL, STATSIG_API_VERSION, isAllowedApiUrl } from './api-config'

describe('api-config constants', () => {
  it('exposes the Console API base URL and version', () => {
    expect(API_BASE_URL).toBe('https://statsigapi.net/console/v1')
    expect(STATSIG_API_VERSION).toBe('20240601')
  })
})

describe('isAllowedApiUrl', () => {
  it.each([
    API_BASE_URL,
    `${API_BASE_URL}/`,
    `${API_BASE_URL}/gates`,
    `${API_BASE_URL}/gates/my_gate/overrides`,
    `${API_BASE_URL}/gates?limit=10`,
    'https://statsigapi.net:443/console/v1/gates',
  ])('allows %s', (url) => {
    expect(isAllowedApiUrl(url)).toBeTruthy()
  })

  it.each([
    'https://statsigapi.net.evil.com/console/v1/gates',
    'https://evil.example/x',
    'https://evil.example/https://statsigapi.net/console/v1/gates',
    'https://statsigapi.net/console/v1evil',
    'https://statsigapi.net/console/v1evil/gates',
    'http://statsigapi.net/console/v1/x',
    'https://user:pw@statsigapi.net/console/v1/x',
    'https://user@statsigapi.net/console/v1/x',
    'https://statsigapi.net/console/v2/x',
    'https://statsigapi.net/console',
    'https://statsigapi.net/',
    'https://statsigapi.net:8443/console/v1/x',
    'https://api.statsigapi.net/console/v1/x',
    '/console/v1/gates',
    'gates',
    '',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedApiUrl(url)).toBeFalsy()
  })
})
