import { describe, expect, it } from 'vitest'

import {
  ALLOWED_WRITE_CALLS,
  API_BASE_URL,
  STATSIG_API_VERSION,
  isAllowedApiRequest,
  isAllowedApiUrl,
} from './api-config'

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

const ALLOWED_WRITES: [string, string][] = [
  ['PATCH', '/experiments/exp_1/overrides'],
  ['DELETE', '/experiments/exp_1/overrides/userID/user_1'],
  ['PATCH', '/layers/layer_1/overrides'],
  ['DELETE', '/layers/layer_1/overrides/userID/user_1'],
  ['POST', '/gates/gate_1/overrides'],
  ['DELETE', '/gates/gate_1/overrides'],
]

describe('isAllowedApiRequest', () => {
  it('lists exactly the write calls this test pins', () => {
    expect(ALLOWED_WRITE_CALLS.map(({ method, path }) => `${method} ${path}`)).toStrictEqual([
      'PATCH /experiments/{id}/overrides',
      'DELETE /experiments/{id}/overrides/userID/{userID}',
      'PATCH /layers/{id}/overrides',
      'DELETE /layers/{id}/overrides/userID/{userID}',
      'POST /gates/{id}/overrides',
      'DELETE /gates/{id}/overrides',
    ])
  })

  it.each([undefined, 'GET', 'get'])('allows method %s on an allowed URL', (method) => {
    expect(isAllowedApiRequest(method, `${API_BASE_URL}/gates?limit=5`)).toBeTruthy()
  })

  it.each([undefined, 'GET'])('refuses method %s on a disallowed URL', (method) => {
    expect(isAllowedApiRequest(method, 'https://evil.example/gates')).toBeFalsy()
    expect(isAllowedApiRequest(method, '/gates')).toBeFalsy()
  })

  it.each(ALLOWED_WRITES)('allows %s %s', (method, path) => {
    expect(isAllowedApiRequest(method, `${API_BASE_URL}${path}`)).toBeTruthy()
    expect(isAllowedApiRequest(method.toLowerCase(), `${API_BASE_URL}${path}`)).toBeTruthy()
    expect(isAllowedApiRequest(method, `${API_BASE_URL}${path}?x=1`)).toBeTruthy()
  })

  it.each(ALLOWED_WRITES)('refuses near misses of %s %s', (method, path) => {
    const url = `${API_BASE_URL}${path}`
    expect(isAllowedApiRequest('PUT', url)).toBeFalsy()
    expect(isAllowedApiRequest(method, `${url}/extra`)).toBeFalsy()
    expect(isAllowedApiRequest(method, `${url}/`)).toBeFalsy()
    expect(isAllowedApiRequest(method, url.replace('/overrides', ''))).toBeFalsy()
    expect(isAllowedApiRequest(method, url.replace(/\/[^/]+\/overrides/u, '//overrides'))).toBeFalsy()
    expect(isAllowedApiRequest(method, url.replace('https://', 'http://'))).toBeFalsy()
  })

  it.each([
    ['POST', '/gates'],
    ['POST', '/experiments'],
    ['DELETE', '/layers/layer_1'],
    ['POST', '/audit_logs'],
    ['DELETE', '/gates'],
    ['PATCH', '/gates/gate_1/overrides'],
    ['POST', '/layers/layer_1/overrides'],
    ['POST', '/experiments/exp_1/overrides'],
    ['DELETE', '/experiments/exp_1/overrides'],
    ['DELETE', '/experiments/exp_1/overrides/userID'],
    ['DELETE', '/experiments/exp_1/overrides/userID/'],
    ['DELETE', '/gates/gate_1/overrides/userID/user_1'],
    ['POST', ''],
  ])('refuses %s %s', (method, path) => {
    expect(isAllowedApiRequest(method, `${API_BASE_URL}${path}`)).toBeFalsy()
  })

  it('refuses a write whose host is not the Console API', () => {
    expect(isAllowedApiRequest('POST', 'https://evil.example/console/v1/gates/g/overrides')).toBeFalsy()
  })
})

describe('write allowlist covers the gate handlers', () => {
  // Same paths and methods that src/handlers/gate-overrides.ts sends.
  it.each([
    ['POST', `${API_BASE_URL}/gates/g1/overrides`],
    ['DELETE', `${API_BASE_URL}/gates/g1/overrides`],
  ])('allows %s %s', (method, url) => {
    expect(isAllowedApiRequest(method, url)).toBeTruthy()
  })
})

describe('write allowlist leaves out the base experiment modal calls (Q4, WL-057)', () => {
  // The base POST replaces the whole list and the base DELETE removes every ID in a row.
  // Both can remove other Testers' overrides (REQ-OVR-009).
  it.each([
    ['POST', `${API_BASE_URL}/experiments/e1/overrides`],
    ['post', `${API_BASE_URL}/experiments/e1/overrides`],
    ['DELETE', `${API_BASE_URL}/experiments/e1/overrides`],
    ['delete', `${API_BASE_URL}/experiments/e1/overrides`],
  ])('refuses %s %s', (method, url) => {
    expect(isAllowedApiRequest(method, url)).toBeFalsy()
  })

  it('still allows the Tester-safe experiment calls', () => {
    expect(isAllowedApiRequest('PATCH', `${API_BASE_URL}/experiments/e1/overrides`)).toBeTruthy()
    expect(isAllowedApiRequest('DELETE', `${API_BASE_URL}/experiments/e1/overrides/userID/u1`)).toBeTruthy()
  })
})
