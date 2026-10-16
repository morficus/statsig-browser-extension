import { describe, expect, it } from 'vitest'

import type { OverrideRecord } from './override-record'

import {
  isSameOverrideTarget,
  listOverrideRecords,
  removeOverrideRecord,
  upsertOverrideRecord,
} from './override-record'

const record = (overrides: Partial<OverrideRecord> = {}): OverrideRecord => ({
  createdAt: 1000,
  environment: 'staging',
  experimentId: 'intake_copy_test',
  experimentName: 'Intake copy test',
  groupName: 'Control',
  stableId: 'stable-1',
  ...overrides,
})

const frozen = (records: OverrideRecord[]): readonly OverrideRecord[] =>
  Object.freeze(records.map((item) => Object.freeze(item)))

describe('isSameOverrideTarget', () => {
  it('is true when the experiment, Stable ID, and environment all match', () => {
    expect(isSameOverrideTarget(record(), record({ createdAt: 2000, groupName: 'Test' }))).toBeTruthy()
  })

  it.each([
    ['experiment', { experimentId: 'other_experiment' }],
    ['Stable ID', { stableId: 'stable-2' }],
    ['environment', { environment: 'production' }],
  ])('is false when the %s differs', (_label, change) => {
    expect(isSameOverrideTarget(record(), record(change))).toBeFalsy()
  })

  it('is case-sensitive', () => {
    expect(isSameOverrideTarget(record(), record({ experimentId: 'Intake_Copy_Test' }))).toBeFalsy()
    expect(isSameOverrideTarget(record(), record({ stableId: 'STABLE-1' }))).toBeFalsy()
    expect(isSameOverrideTarget(record(), record({ environment: 'Staging' }))).toBeFalsy()
  })
})

describe('upsertOverrideRecord', () => {
  it('adds a record to an empty list', () => {
    const added = record()

    expect(upsertOverrideRecord([], added)).toStrictEqual([added])
  })

  it('appends a record for a second target, so another environment gives two records', () => {
    const staging = record()
    const production = record({ createdAt: 2000, environment: 'production' })

    expect(upsertOverrideRecord([staging], production)).toStrictEqual([staging, production])
  })

  it('replaces the record for the same target with the new group and createdAt', () => {
    const first = record()
    const other = record({ experimentId: 'other_experiment' })
    const forcedAgain = record({ createdAt: 5000, groupName: 'Test' })

    const result = upsertOverrideRecord([first, other], forcedAgain)

    expect(result).toHaveLength(2)
    expect(result[0]).toBe(forcedAgain)
    expect(result[0]).toMatchObject({ createdAt: 5000, groupName: 'Test' })
    expect(result[1]).toBe(other)
  })

  it('replaces the record at the same index, even when it is not the first', () => {
    const alpha = record({ experimentId: 'alpha' })
    const beta = record({ experimentId: 'beta' })
    const gamma = record({ experimentId: 'gamma' })
    const newBeta = record({ createdAt: 9000, experimentId: 'beta', groupName: 'Test' })

    expect(upsertOverrideRecord([alpha, beta, gamma], newBeta)).toStrictEqual([alpha, newBeta, gamma])
  })

  it('keeps the layer id of the new record', () => {
    const forcedAgain = record({ groupName: 'Test', layerId: 'intake_layer' })

    expect(upsertOverrideRecord([record()], forcedAgain)).toStrictEqual([forcedAgain])
  })

  it('cleans up duplicates from older data: replaces the first match and drops the others', () => {
    const duplicateA = record({ createdAt: 1000, groupName: 'Control' })
    const other = record({ experimentId: 'other_experiment' })
    const duplicateB = record({ createdAt: 2000, groupName: 'Test' })
    const replacement = record({ createdAt: 3000, groupName: 'Test 2' })

    const result = upsertOverrideRecord([duplicateA, other, duplicateB], replacement)

    expect(result).toStrictEqual([replacement, other])
  })

  it('does not mutate the input', () => {
    const records = frozen([record(), record({ environment: 'production' })])

    expect(() => upsertOverrideRecord(records, record({ groupName: 'Test' }))).not.toThrow()
    expect(() => upsertOverrideRecord(records, record({ experimentId: 'new_experiment' }))).not.toThrow()
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ groupName: 'Control' })
  })

  it('returns a new array when nothing matches', () => {
    const records = frozen([record()])

    expect(upsertOverrideRecord(records, record({ stableId: 'stable-2' }))).not.toBe(records)
  })
})

describe('removeOverrideRecord', () => {
  it('removes only the matching record', () => {
    const staging = record()
    const production = record({ environment: 'production' })
    const otherStableId = record({ stableId: 'stable-2' })

    const result = removeOverrideRecord([staging, production, otherStableId], {
      environment: 'staging',
      experimentId: 'intake_copy_test',
      stableId: 'stable-1',
    })

    expect(result).toStrictEqual([production, otherStableId])
  })

  it('removes every record that matches the key', () => {
    const duplicateA = record({ groupName: 'Control' })
    const duplicateB = record({ groupName: 'Test' })
    const other = record({ experimentId: 'other_experiment' })

    expect(removeOverrideRecord([duplicateA, other, duplicateB], duplicateA)).toStrictEqual([other])
  })

  it('returns an equal array when the key matches nothing', () => {
    const records = [record(), record({ environment: 'production' })]

    const result = removeOverrideRecord(records, {
      environment: 'staging',
      experimentId: 'unknown_experiment',
      stableId: 'stable-1',
    })

    expect(result).toStrictEqual(records)
  })

  it('does not mutate the input', () => {
    const records = frozen([record(), record({ environment: 'production' })])

    const result = removeOverrideRecord(records, record())

    expect(result).toHaveLength(1)
    expect(records).toHaveLength(2)
    expect(result).not.toBe(records)
  })
})

describe('listOverrideRecords', () => {
  it('sorts by createdAt, newest first', () => {
    const oldest = record({ createdAt: 1000, experimentId: 'a' })
    const newest = record({ createdAt: 3000, experimentId: 'b' })
    const middle = record({ createdAt: 2000, experimentId: 'c' })

    expect(listOverrideRecords([oldest, newest, middle])).toStrictEqual([newest, middle, oldest])
  })

  it('keeps the stored order for records with the same createdAt', () => {
    const first = record({ createdAt: 2000, experimentId: 'a' })
    const second = record({ createdAt: 2000, experimentId: 'b' })
    const third = record({ createdAt: 2000, experimentId: 'c' })
    const newest = record({ createdAt: 3000, experimentId: 'd' })

    expect(listOverrideRecords([first, second, newest, third])).toStrictEqual([newest, first, second, third])
  })

  it('returns an empty array for an empty list', () => {
    expect(listOverrideRecords([])).toStrictEqual([])
  })

  it('does not mutate the input', () => {
    const older = record({ createdAt: 1000, experimentId: 'a' })
    const newer = record({ createdAt: 2000, experimentId: 'b' })
    const records = frozen([older, newer])

    const result = listOverrideRecords(records)

    expect(result).toStrictEqual([newer, older])
    expect(result).not.toBe(records)
    expect(records).toStrictEqual([older, newer])
  })
})
