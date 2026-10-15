import { describe, expect, it } from 'vitest'

import { INTAKE_SITE_MATCHES } from '@/src/lib/intake-site'
import config from '@/wxt.config'

describe('extension manifest', () => {
  const manifest = config.manifest as { host_permissions: string[]; permissions: string[] }

  it('reaches only statsigapi.net and the Intake Site', () => {
    expect(manifest.host_permissions).toStrictEqual(['https://statsigapi.net/*', ...INTAKE_SITE_MATCHES])
  })

  it('keeps the same API permissions', () => {
    expect(manifest.permissions).toStrictEqual(['storage', 'scripting', 'activeTab'])
  })

  it('never uses <all_urls>', () => {
    expect(JSON.stringify(manifest)).not.toContain('<all_urls>')
  })
})
