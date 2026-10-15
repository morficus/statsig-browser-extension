import { expect, test } from '@playwright/test'
// The built manifest is the source of truth for T-SET-1 and REQ-SET-007/009/010.
// When F11 adds the optional `debugger` permission, this test changes with it.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { INTAKE_SITE_MATCHES } from '../src/lib/intake-site'

const MANIFEST_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3', 'manifest.json')
const manifestText = readFileSync(MANIFEST_PATH, 'utf8')
const manifest = JSON.parse(manifestText) as Record<string, unknown>

test('built manifest host_permissions are exactly the Statsig API and the Intake Site', () => {
  expect([...(manifest.host_permissions as string[])].toSorted()).toEqual(
    ['https://statsigapi.net/*', ...INTAKE_SITE_MATCHES].toSorted(),
  )
})

test('built manifest permissions are exactly storage, scripting, activeTab', () => {
  expect([...(manifest.permissions as string[])].toSorted()).toEqual(['activeTab', 'scripting', 'storage'])
})

test('built manifest content scripts exist and match only the Intake Site', () => {
  const scripts = manifest.content_scripts as { matches: string[] }[]
  expect(scripts.length).toBeGreaterThan(0)
  const allowed: readonly string[] = INTAKE_SITE_MATCHES
  for (const match of scripts.flatMap((script) => script.matches)) {
    expect(allowed, `content script match ${match}`).toContain(match)
  }
})

test('built manifest has no optional permissions, web accessible resources, or externally_connectable', () => {
  for (const key of [
    'optional_permissions',
    'optional_host_permissions',
    'web_accessible_resources',
    'externally_connectable',
  ]) {
    expect(manifest, key).not.toHaveProperty(key)
  }
})

test('built manifest contains no broad match patterns', () => {
  for (const broad of ['<all_urls>', '*://', 'https://*/', 'http://*/']) {
    expect(manifestText, broad).not.toContain(broad)
  }
})
