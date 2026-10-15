// Single source of the Intake Site URL patterns (REQ-SET-008).
// The manifest and the runtime check both use it.
// `wxt.config.ts` imports this file, so it must stay import-free.

/** The Chrome match patterns for the Intake Site. */
export const INTAKE_SITE_MATCHES = [
  'https://app.talkiatry.com/assessment*',
  'https://app.staging.talkiatry.com/assessment*',
] as const

function hostMatches(hostname: string, patternHost: string): boolean {
  const wildcard = patternHost.startsWith('*.')
  const name = wildcard ? patternHost.slice(2) : patternHost
  if (name === '' || name.includes('*')) {
    return false
  }
  return hostname === name || (wildcard && hostname.endsWith(`.${name}`))
}

function pathToRegExp(path: string): RegExp {
  const source = path
    .split('*')
    .map((chunk) => chunk.replaceAll(/[$()+.?[\\\]^{|}]/gu, String.raw`\$&`))
    .join('.*')
  return new RegExp(`^${source}$`, 'u')
}

/** Checks a URL against a Chrome match pattern (https/http subset); unsupported patterns never match. */
export function matchesUrlPattern(url: URL, pattern: string): boolean {
  const parts = /^(?<scheme>[^:/]+):\/\/(?<host>[^/]+)(?<path>\/.*)$/u.exec(pattern)
  const { scheme, host, path } = parts?.groups ?? {}
  if (scheme === undefined || host === undefined || path === undefined) {
    return false
  }
  if (scheme !== 'https' && scheme !== 'http') {
    return false
  }
  if (scheme !== url.protocol.slice(0, -1) || url.port !== '') {
    return false
  }
  return hostMatches(url.hostname, host.toLowerCase()) && pathToRegExp(path).test(url.pathname + url.search)
}

/** Whether a tab URL belongs to the Intake Site; invalid or missing URLs return false. */
export function isIntakeSiteUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false
  }
  const parsed = URL.parse(url)
  if (!parsed) {
    return false
  }
  return INTAKE_SITE_MATCHES.some((pattern) => matchesUrlPattern(parsed, pattern))
}
