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
