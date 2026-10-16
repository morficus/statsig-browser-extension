import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { OverrideRecord } from '@/src/lib/override-record'

import { overrideRecordsStorage } from '@/src/lib/storage'

const record: OverrideRecord = {
  createdAt: 1_700_000_000_000,
  environment: 'staging',
  experimentId: 'intake_copy_test',
  experimentName: 'Intake copy test',
  groupName: 'Control',
  stableId: 'stable-1',
}

describe('overrideRecordsStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('falls back to an empty list', async () => {
    await expect(overrideRecordsStorage.getValue()).resolves.toStrictEqual([])
  })

  it('writes the records to browser.storage.local under statsig-override-records', async () => {
    await overrideRecordsStorage.setValue([record])

    await expect(fakeBrowser.storage.local.get('statsig-override-records')).resolves.toStrictEqual({
      'statsig-override-records': [record],
    })
    await expect(overrideRecordsStorage.getValue()).resolves.toStrictEqual([record])
  })

  it('keeps browser.storage.sync and browser.storage.session empty', async () => {
    await overrideRecordsStorage.setValue([record])

    await expect(fakeBrowser.storage.sync.get(null)).resolves.toStrictEqual({})
    await expect(fakeBrowser.storage.session.get(null)).resolves.toStrictEqual({})
  })
})
