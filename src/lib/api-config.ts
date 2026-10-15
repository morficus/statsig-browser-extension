// Single source of the Statsig Console API policy (REQ-SEC-005).
// Base URL, version header and URL allowlist live here, so a move to a proxy changes only this file.

export const API_BASE_URL = 'https://statsigapi.net/console/v1'

export const STATSIG_API_VERSION = '20240601'

const BASE = new URL(API_BASE_URL)

/** True only for https URLs on the Console API host, under the base path, with no credentials or custom port. */
export const isAllowedApiUrl = (url: string): boolean => {
  const parsed = URL.canParse(url) ? new URL(url) : undefined
  if (!parsed) {
    return false
  }

  return (
    parsed.protocol === BASE.protocol &&
    parsed.host === BASE.host &&
    parsed.username === '' &&
    parsed.password === '' &&
    parsed.port === '' &&
    (parsed.pathname === BASE.pathname || parsed.pathname.startsWith(`${BASE.pathname}/`))
  )
}

interface AllowedWriteCall {
  method: string
  /** Path below the base URL. `{id}` and `{userID}` each match exactly one non-empty segment. */
  path: string
}

/** The only non-GET calls the extension may make: the override writes. */
export const ALLOWED_WRITE_CALLS: readonly AllowedWriteCall[] = [
  { method: 'PATCH', path: '/experiments/{id}/overrides' },
  { method: 'DELETE', path: '/experiments/{id}/overrides/userID/{userID}' },
  { method: 'PATCH', path: '/layers/{id}/overrides' },
  { method: 'DELETE', path: '/layers/{id}/overrides/userID/{userID}' },
  { method: 'POST', path: '/gates/{id}/overrides' },
  { method: 'DELETE', path: '/gates/{id}/overrides' },
  { method: 'POST', path: '/experiments/{id}/overrides' }, // Base experiment modal, kept until Q4 is decided (WL-042)
  { method: 'DELETE', path: '/experiments/{id}/overrides' }, // Base experiment modal, kept until Q4 is decided (WL-042)
]

const matchesPathTemplate = (template: string, path: string): boolean => {
  const templateSegments = template.split('/')
  const pathSegments = path.split('/')
  return (
    templateSegments.length === pathSegments.length &&
    templateSegments.every((segment, index) => {
      const actual = pathSegments[index] ?? ''
      return segment.startsWith('{') ? actual !== '' : segment === actual
    })
  )
}

/** True for GET on an allowed URL, or for a non-GET call that is on `ALLOWED_WRITE_CALLS`. */
export const isAllowedApiRequest = (method: string | undefined, url: string): boolean => {
  if (!isAllowedApiUrl(url)) {
    return false
  }

  const upperMethod = (method ?? 'GET').toUpperCase()
  if (upperMethod === 'GET') {
    return true
  }

  const path = new URL(url).pathname.slice(BASE.pathname.length)
  return ALLOWED_WRITE_CALLS.some((call) => call.method === upperMethod && matchesPathTemplate(call.path, path))
}
