import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { storage } from 'wxt/utils/storage'

import { clearManualStableId, getManualStableId, saveManualStableId, validateManualStableId } from './manual-stable-id'

const STAGING = 'https://app.staging.talkiatry.com'
const PRODUCTION = 'https://app.talkiatry.com'
const keyFor = (origin: string) => `session:manual-stable-id:${origin}` as const
// The key the browser area holds: WXT strips the `session:` prefix.
const rawKeyFor = (origin: string) => `manual-stable-id:${origin}`

describe('validateManualStableId', () => {
  it('returns the trimmed value', () => {
    expect(validateManualStableId('  abc-123  ')).toStrictEqual({ ok: true, value: 'abc-123' })
  })

  it('accepts a value with no spaces', () => {
    expect(validateManualStableId('d1b6a1f0-5a6b-4c89-9f5e-0b8a7c2d3e4f')).toStrictEqual({
      ok: true,
      value: 'd1b6a1f0-5a6b-4c89-9f5e-0b8a7c2d3e4f',
    })
  })

  it('rejects an empty value', () => {
    expect(validateManualStableId('')).toStrictEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a value of only whitespace as empty', () => {
    expect(validateManualStableId('   ')).toStrictEqual({ ok: false, reason: 'empty' })
    expect(validateManualStableId('\t\n ')).toStrictEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a value with a space inside', () => {
    expect(validateManualStableId('abc 123')).toStrictEqual({ ok: false, reason: 'whitespace' })
  })

  it('rejects a value with a tab inside', () => {
    expect(validateManualStableId('abc\t123')).toStrictEqual({ ok: false, reason: 'whitespace' })
  })

  it('rejects a value with a newline inside', () => {
    expect(validateManualStableId('abc\n123')).toStrictEqual({ ok: false, reason: 'whitespace' })
  })
})

describe('manual Stable ID storage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('reads undefined when nothing is stored', async () => {
    await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
  })

  it('saves and reads the value for an origin', async () => {
    await saveManualStableId(STAGING, 'abc-123')

    await expect(getManualStableId(STAGING)).resolves.toBe('abc-123')
  })

  it('stores the trimmed value in session storage under one key per origin', async () => {
    await saveManualStableId(STAGING, '  abc-123  ')

    await expect(storage.getItem(keyFor(STAGING))).resolves.toBe('abc-123')
    await expect(fakeBrowser.storage.session.get(null)).resolves.toStrictEqual({
      [rawKeyFor(STAGING)]: 'abc-123',
    })
    await expect(fakeBrowser.storage.local.get(null)).resolves.toStrictEqual({})
  })

  it('keeps two origins apart', async () => {
    await saveManualStableId(STAGING, 'staging-id')
    await saveManualStableId(PRODUCTION, 'production-id')

    await expect(getManualStableId(STAGING)).resolves.toBe('staging-id')
    await expect(getManualStableId(PRODUCTION)).resolves.toBe('production-id')
  })

  it('replaces the value when it is saved again', async () => {
    await saveManualStableId(STAGING, 'first')
    await saveManualStableId(STAGING, 'second')

    await expect(getManualStableId(STAGING)).resolves.toBe('second')
  })

  it('clears the value for one origin only', async () => {
    await saveManualStableId(STAGING, 'staging-id')
    await saveManualStableId(PRODUCTION, 'production-id')

    await clearManualStableId(STAGING)

    await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
    await expect(getManualStableId(PRODUCTION)).resolves.toBe('production-id')
  })

  it('clears without error when nothing is stored', async () => {
    await expect(clearManualStableId(STAGING)).resolves.toBeUndefined()
  })

  it.each([
    ['a number', 42],
    ['an object', { value: 'abc' }],
    ['null', null],
    ['an empty string', ''],
    ['an array', ['abc']],
  ])('reads undefined when the stored value is %s', async (_label, stored) => {
    await fakeBrowser.storage.session.set({ [rawKeyFor(STAGING)]: stored })

    await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
  })

  it.each([
    ['empty', ''],
    ['empty', '   '],
    ['whitespace', 'abc 123'],
  ])('throws and stores nothing for an invalid value (%s: %j)', async (_reason, value) => {
    await expect(saveManualStableId(STAGING, value)).rejects.toThrow(Error)

    await expect(fakeBrowser.storage.session.get(null)).resolves.toStrictEqual({})
    await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
  })

  it('keeps the stored value when a later save is invalid', async () => {
    await saveManualStableId(STAGING, 'abc-123')

    await expect(saveManualStableId(STAGING, 'bad value')).rejects.toThrow(Error)

    await expect(getManualStableId(STAGING)).resolves.toBe('abc-123')
  })
})
