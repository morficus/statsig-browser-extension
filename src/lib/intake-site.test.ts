import { describe, expect, it } from 'vitest'

import { INTAKE_SITE_MATCHES, isIntakeSiteUrl, matchesUrlPattern } from './intake-site'

describe('isIntakeSiteUrl', () => {
  it.each([
    'https://app.talkiatry.com/assessment',
    'https://app.staging.talkiatry.com/assessment',
    'https://app.talkiatry.com/assessment/step-2',
    'https://app.talkiatry.com/assessment?utm_source=x&step=3',
    'https://app.talkiatry.com/assessment/step-2?x=1#section',
    'https://APP.TALKIATRY.COM/assessment',
  ])('accepts %s', (url) => {
    expect(isIntakeSiteUrl(url)).toBeTruthy()
  })

  it('accepts /assessments because the trailing * glob matches it, same as Chrome', () => {
    expect(isIntakeSiteUrl('https://app.talkiatry.com/assessments')).toBeTruthy()
  })

  it.each([
    'http://app.talkiatry.com/assessment',
    'https://app.talkiatry.com/',
    'https://app.talkiatry.com/login',
    'https://app.talkiatry.com/Assessment',
    'https://talkiatry.com/assessment',
    'https://www.talkiatry.com/assessment',
    'https://dev.app.talkiatry.com/assessment',
    'https://app.talkiatry.com.evil.example/assessment',
    'https://evil.example/assessment',
    'https://evil.example/?next=https://app.talkiatry.com/assessment',
    'https://evil.example/#https://app.talkiatry.com/assessment',
    'https://app.talkiatry.com:8443/assessment',
    'chrome-extension://abcdefghijklmnop/popup.html',
    'about:blank',
    'file:///assessment',
    '',
    'not a url',
    'app.talkiatry.com/assessment',
    undefined,
    null,
  ])('rejects %s', (url) => {
    expect(isIntakeSiteUrl(url)).toBeFalsy()
  })
})

describe('matchesUrlPattern', () => {
  it.each(INTAKE_SITE_MATCHES)('matches the canonical URL of %s', (pattern) => {
    const canonical = new URL(pattern.slice(0, -1))
    expect(matchesUrlPattern(canonical, pattern)).toBeTruthy()
  })

  it.each([
    ['https://talkiatry.com/x', true],
    ['https://a.b.talkiatry.com/x', true],
    ['https://eviltalkiatry.com/x', false],
  ])('wildcard host *.talkiatry.com vs %s', (url, expected) => {
    expect(matchesUrlPattern(new URL(url), 'https://*.talkiatry.com/*')).toBe(expected)
  })

  it.each([
    ['https://example.com/a*b', 'https://example.com/ab', true],
    ['https://example.com/a*b', 'https://example.com/a-x-b', true],
    ['https://example.com/a*b', 'https://example.com/a-x-bc', false],
    ['https://example.com/a.b', 'https://example.com/aXb', false],
    ['https://example.com/*', 'https://example.com/', true],
    ['https://example.com/*', 'https://example.com/anything?q=1', true],
  ])('path glob %s vs %s', (pattern, url, expected) => {
    expect(matchesUrlPattern(new URL(url), pattern)).toBe(expected)
  })

  it.each(['*://example.com/*', 'https://*/*', 'https://ex*ample.com/*', '<all_urls>', 'https://example.com', ''])(
    'returns false for unsupported pattern %j',
    (pattern) => {
      expect(matchesUrlPattern(new URL('https://example.com/'), pattern)).toBeFalsy()
    },
  )
})
