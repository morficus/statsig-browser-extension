import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { OverrideRecord } from '@/src/lib/override-record'
import type { Experiment, ExperimentOverridesResponse, LayerOverridesResponse } from '@/src/types/statsig'

import { overrideRecordsStorage } from '@/src/lib/storage'

import { forceStableIdIntoExperimentGroup, removeStableIdFromExperimentGroup } from './experiment-overrides'
import { forceStableIdIntoLayerGroup, removeStableIdFromLayerGroup } from './layer-overrides'
import { clearStableIdOverride, forceStableIdIntoGroup } from './override-engine'

vi.mock('./experiment-overrides')
vi.mock('./layer-overrides')

const NOW = 1_700_000_000_000
const LATER = 1_700_000_500_000
const STABLE_ID = 'tester-stable-id'
const ENVIRONMENT = 'staging'

const experimentResponse: ExperimentOverridesResponse = { overrides: [], userIDOverrides: [] }
const layerResponse: LayerOverridesResponse = { conditionalOverrides: [], idOverrides: [] }

/** The experiment `id` and `name` differ on purpose, so a mix-up shows in the calls. */
const experimentBase = { id: 'exp_1', name: 'Experiment One' }

/** Pass `{ layerID }` to set the key, even to `undefined`. Pass nothing to leave the key out. */
const forceArgs = (layer: Pick<Experiment, 'layerID'> = {}): Parameters<typeof forceStableIdIntoGroup>[0] => ({
  environment: ENVIRONMENT,
  experiment: { ...experimentBase, ...layer },
  groupName: 'Test B',
  stableId: STABLE_ID,
})

const experimentRecord: OverrideRecord = {
  createdAt: NOW,
  environment: ENVIRONMENT,
  experimentId: 'exp_1',
  experimentName: 'Experiment One',
  groupName: 'Test B',
  stableId: STABLE_ID,
}

const layerRecord: OverrideRecord = { ...experimentRecord, layerId: 'layer_1' }

/** Records that must never change when the Tester's record is forced or cleared. */
const otherStableIdRecord: OverrideRecord = { ...experimentRecord, stableId: 'someone-elses-id' }
const otherEnvironmentRecord: OverrideRecord = { ...experimentRecord, environment: 'production' }
const otherExperimentRecord: OverrideRecord = {
  ...experimentRecord,
  experimentId: 'exp_2',
  experimentName: 'Experiment Two',
  layerId: 'layer_2',
}
const otherRecords = [otherStableIdRecord, otherEnvironmentRecord, otherExperimentRecord]

const stored = (): Promise<OverrideRecord[]> => overrideRecordsStorage.getValue()

/** The error shape the handlers throw: a message from `handleApiError`, and the wretch error as the cause. */
const handlerError = (cause?: unknown): Error => new Error('handler failed', { cause })

/** Both are spied on in `beforeEach`. `vi.mocked` gives the spy back, without a `let` that starts empty. */
const setValueSpy = () => vi.mocked(overrideRecordsStorage.setValue)
const dateNowSpy = () => vi.mocked(Date.now)

/** Put records in storage, then forget that write, so a test can check that the engine wrote nothing. */
const seed = async (records: OverrideRecord[]) => {
  await overrideRecordsStorage.setValue(records)
  setValueSpy().mockClear()
}

const expectStorageUntouched = async (before: OverrideRecord[]) => {
  expect(setValueSpy()).not.toHaveBeenCalled()
  await expect(stored()).resolves.toStrictEqual(before)
}

/** Make the remove handlers fail with the status, or succeed when there is none. */
const answerDeletes = (status?: number) => {
  const fail = () => Promise.reject(handlerError({ status }))
  vi.mocked(removeStableIdFromExperimentGroup).mockImplementation(
    status === undefined ? () => Promise.resolve(experimentResponse) : fail,
  )
  vi.mocked(removeStableIdFromLayerGroup).mockImplementation(
    status === undefined ? () => Promise.resolve(layerResponse) : fail,
  )
}

const experimentArgs = (id: string): Parameters<typeof forceStableIdIntoGroup>[0] => ({
  ...forceArgs(),
  experiment: { id, name: `Name ${id}` },
})

const recordFor = (id: string): OverrideRecord => ({
  ...experimentRecord,
  experimentId: id,
  experimentName: `Name ${id}`,
})

/** Lets every promise that can run, run. */
const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

describe('override-engine', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fakeBrowser.reset()
    vi.mocked(forceStableIdIntoExperimentGroup).mockResolvedValue(experimentResponse)
    vi.mocked(removeStableIdFromExperimentGroup).mockResolvedValue(experimentResponse)
    vi.mocked(forceStableIdIntoLayerGroup).mockResolvedValue(layerResponse)
    vi.mocked(removeStableIdFromLayerGroup).mockResolvedValue(layerResponse)
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    vi.spyOn(overrideRecordsStorage, 'setValue')
  })

  describe('forceStableIdIntoGroup', () => {
    describe.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
    ])('when the layerID is %s', (_label, layerID) => {
      it('sends the write to the experiment handler with the exact args, and not to the layer handler', async () => {
        await forceStableIdIntoGroup(forceArgs({ layerID }))

        expect(forceStableIdIntoExperimentGroup).toHaveBeenCalledExactlyOnceWith({
          environment: ENVIRONMENT,
          experimentId: 'exp_1',
          groupName: 'Test B',
          stableId: STABLE_ID,
        })
        expect(forceStableIdIntoLayerGroup).not.toHaveBeenCalled()
        expect(removeStableIdFromExperimentGroup).not.toHaveBeenCalled()
        expect(removeStableIdFromLayerGroup).not.toHaveBeenCalled()
      })

      it('saves and returns the record with no layerId key', async () => {
        const result = await forceStableIdIntoGroup(forceArgs({ layerID }))

        expect(result).toStrictEqual(experimentRecord)
        expect(Object.keys(result)).not.toContain('layerId')
        await expect(stored()).resolves.toStrictEqual([experimentRecord])
      })
    })

    it('sends the write to the experiment handler when the experiment has no layerID key at all', async () => {
      const result = await forceStableIdIntoGroup(forceArgs())

      expect(forceStableIdIntoExperimentGroup).toHaveBeenCalledTimes(1)
      expect(forceStableIdIntoLayerGroup).not.toHaveBeenCalled()
      expect(result).toStrictEqual(experimentRecord)
      expect(Object.keys(result)).not.toContain('layerId')
    })

    describe('when the experiment is in a layer', () => {
      it('sends the write to the layer handler with the layer id and the experiment id, and not to the experiment handler', async () => {
        await forceStableIdIntoGroup(forceArgs({ layerID: 'layer_1' }))

        expect(forceStableIdIntoLayerGroup).toHaveBeenCalledExactlyOnceWith({
          environment: ENVIRONMENT,
          experimentName: 'exp_1',
          groupName: 'Test B',
          layerId: 'layer_1',
          stableId: STABLE_ID,
        })
        expect(forceStableIdIntoExperimentGroup).not.toHaveBeenCalled()
        expect(removeStableIdFromExperimentGroup).not.toHaveBeenCalled()
        expect(removeStableIdFromLayerGroup).not.toHaveBeenCalled()
      })

      it('saves and returns the record with the layerId', async () => {
        const result = await forceStableIdIntoGroup(forceArgs({ layerID: 'layer_1' }))

        expect(result).toStrictEqual(layerRecord)
        await expect(stored()).resolves.toStrictEqual([layerRecord])
      })
    })

    it('has not saved the record while the write is still running', async () => {
      const recordsDuringWrite: OverrideRecord[][] = []
      vi.mocked(forceStableIdIntoExperimentGroup).mockImplementation(async () => {
        recordsDuringWrite.push(await stored())
        return experimentResponse
      })

      await forceStableIdIntoGroup(forceArgs())

      expect(recordsDuringWrite).toStrictEqual([[]])
      expect(setValueSpy()).toHaveBeenCalledTimes(1)
      await expect(stored()).resolves.toStrictEqual([experimentRecord])
    })

    it('keeps the other records and adds the new one', async () => {
      await seed(otherRecords)

      await forceStableIdIntoGroup(forceArgs())

      await expect(stored()).resolves.toStrictEqual([...otherRecords, experimentRecord])
    })

    it('forces a second group for the same experiment, Stable ID, and environment into one record', async () => {
      await seed(otherRecords)
      await forceStableIdIntoGroup(forceArgs())
      dateNowSpy().mockReturnValue(LATER)

      const result = await forceStableIdIntoGroup({ ...forceArgs(), groupName: 'Control' })

      const expected: OverrideRecord = { ...experimentRecord, createdAt: LATER, groupName: 'Control' }
      expect(result).toStrictEqual(expected)
      await expect(stored()).resolves.toStrictEqual([...otherRecords, expected])
    })

    it.each([
      ['an experiment', forceStableIdIntoExperimentGroup, undefined],
      ['a layer', forceStableIdIntoLayerGroup, 'layer_1'],
    ])(
      'throws the same error and leaves the storage alone when the write to %s fails',
      async (_label, handler, layerID) => {
        await seed(otherRecords)
        const error = handlerError({ status: 500 })
        vi.mocked(handler).mockRejectedValue(error)

        await expect(forceStableIdIntoGroup(forceArgs({ layerID }))).rejects.toBe(error)

        await expectStorageUntouched(otherRecords)
      },
    )

    it('leaves an empty storage empty when the write fails', async () => {
      const error = handlerError({ status: 429 })
      vi.mocked(forceStableIdIntoExperimentGroup).mockRejectedValue(error)

      await expect(forceStableIdIntoGroup(forceArgs())).rejects.toBe(error)

      expect(setValueSpy()).not.toHaveBeenCalled()
      await expect(fakeBrowser.storage.local.get(null)).resolves.toStrictEqual({})
    })

    it('does not retry a failed write', async () => {
      vi.mocked(forceStableIdIntoLayerGroup).mockRejectedValue(handlerError())

      await expect(forceStableIdIntoGroup(forceArgs({ layerID: 'layer_1' }))).rejects.toThrow('handler failed')

      expect(forceStableIdIntoLayerGroup).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearStableIdOverride', () => {
    describe.each([
      ['no layerId', experimentRecord],
      ['an empty layerId', { ...experimentRecord, layerId: '' }],
    ])('when the record has %s', (_label, record) => {
      it("calls the experiment remove handler with the record's exact group, Stable ID, and environment", async () => {
        await clearStableIdOverride(record)

        expect(removeStableIdFromExperimentGroup).toHaveBeenCalledExactlyOnceWith({
          environment: ENVIRONMENT,
          experimentId: 'exp_1',
          groupName: 'Test B',
          stableId: STABLE_ID,
        })
        expect(removeStableIdFromLayerGroup).not.toHaveBeenCalled()
        expect(forceStableIdIntoExperimentGroup).not.toHaveBeenCalled()
        expect(forceStableIdIntoLayerGroup).not.toHaveBeenCalled()
      })
    })

    it("calls the layer remove handler with the record's layer id, experiment id, group, Stable ID, and environment", async () => {
      await clearStableIdOverride(layerRecord)

      expect(removeStableIdFromLayerGroup).toHaveBeenCalledExactlyOnceWith({
        environment: ENVIRONMENT,
        experimentName: 'exp_1',
        groupName: 'Test B',
        layerId: 'layer_1',
        stableId: STABLE_ID,
      })
      expect(removeStableIdFromExperimentGroup).not.toHaveBeenCalled()
      expect(forceStableIdIntoExperimentGroup).not.toHaveBeenCalled()
      expect(forceStableIdIntoLayerGroup).not.toHaveBeenCalled()
    })

    it.each([
      ['an experiment', experimentRecord],
      ['a layer', layerRecord],
    ])('removes only that record and returns cleared when the DELETE for %s succeeds', async (_label, record) => {
      await seed([otherStableIdRecord, record, otherEnvironmentRecord, otherExperimentRecord])

      await expect(clearStableIdOverride(record)).resolves.toBe('cleared')

      await expect(stored()).resolves.toStrictEqual(otherRecords)
    })

    it('returns cleared and removes nothing else when the record is not in storage', async () => {
      await seed(otherRecords)

      await expect(clearStableIdOverride(experimentRecord)).resolves.toBe('cleared')

      await expect(stored()).resolves.toStrictEqual(otherRecords)
    })

    it.each([
      ['an experiment', experimentRecord, removeStableIdFromExperimentGroup],
      ['a layer', layerRecord, removeStableIdFromLayerGroup],
    ])(
      'removes the record and returns not-found when the DELETE for %s gets a 404',
      async (_label, record, handler) => {
        await seed([record, ...otherRecords])
        vi.mocked(handler).mockRejectedValue(handlerError({ status: 404 }))

        await expect(clearStableIdOverride(record)).resolves.toBe('not-found')

        await expect(stored()).resolves.toStrictEqual(otherRecords)
      },
    )

    it.each([
      ['a 401', { status: 401 }],
      ['a 403', { status: 403 }],
      ['a 429', { status: 429 }],
      ['a 500', { status: 500 }],
      ['a cause without a status', { message: 'no status here' }],
      ['a status that is a string', { status: '404' }],
      ['a status that is null', { status: null }],
      ['a cause that is a string', '404'],
      ['a cause that is null', null],
      ['a cause that is a number', 404],
      ['no cause', undefined],
    ])('throws the same error and keeps the record when the DELETE gets %s', async (_label, cause) => {
      const before = [experimentRecord, ...otherRecords]
      await seed(before)
      const error = handlerError(cause)
      vi.mocked(removeStableIdFromExperimentGroup).mockRejectedValue(error)

      await expect(clearStableIdOverride(experimentRecord)).rejects.toBe(error)

      await expectStorageUntouched(before)
    })

    it.each([401, 429])(
      'throws the same error and keeps the record when the layer DELETE gets a %i',
      async (status) => {
        const before = [layerRecord, ...otherRecords]
        await seed(before)
        const error = handlerError({ status })
        vi.mocked(removeStableIdFromLayerGroup).mockRejectedValue(error)

        await expect(clearStableIdOverride(layerRecord)).rejects.toBe(error)

        await expectStorageUntouched(before)
      },
    )

    it.each([
      ['a string', 'plain text failure'],
      ['null', null],
      ['undefined', undefined],
    ])('throws %s as it is, and keeps the record', async (_label, thrown) => {
      await seed([experimentRecord])
      vi.mocked(removeStableIdFromExperimentGroup).mockRejectedValue(thrown)

      await expect(clearStableIdOverride(experimentRecord)).rejects.toBe(thrown)

      await expectStorageUntouched([experimentRecord])
    })

    it('does not retry a failed DELETE', async () => {
      vi.mocked(removeStableIdFromExperimentGroup).mockRejectedValue(handlerError({ status: 429 }))

      await expect(clearStableIdOverride(experimentRecord)).rejects.toThrow('handler failed')

      expect(removeStableIdFromExperimentGroup).toHaveBeenCalledTimes(1)
    })
  })

  describe('a stored record that has changed since the record was cleared', () => {
    const olderGroupRecord: OverrideRecord = { ...experimentRecord, groupName: 'Control' }

    describe.each([
      ['the DELETE succeeds', 'cleared', undefined],
      ['the DELETE gets a 404', 'not-found', 404],
    ] as const)('when %s', (_label, expected, status) => {
      it('keeps the newer record that has another group', async () => {
        await seed([otherStableIdRecord, experimentRecord])
        answerDeletes(status)

        await expect(clearStableIdOverride(olderGroupRecord)).resolves.toBe(expected)

        expect(removeStableIdFromExperimentGroup).toHaveBeenCalledExactlyOnceWith({
          environment: ENVIRONMENT,
          experimentId: 'exp_1',
          groupName: 'Control',
          stableId: STABLE_ID,
        })
        await expectStorageUntouched([otherStableIdRecord, experimentRecord])
      })

      it.each([
        ['a layer, when the cleared record has none', experimentRecord, layerRecord],
        ['no layer, when the cleared record has one', layerRecord, experimentRecord],
        ['another layer', { ...layerRecord, layerId: 'layer_9' }, layerRecord],
      ])('keeps the stored record that has %s', async (_caseLabel, cleared, kept) => {
        await seed([kept])
        answerDeletes(status)

        await expect(clearStableIdOverride(cleared)).resolves.toBe(expected)

        await expectStorageUntouched([kept])
      })

      it.each([
        ['an empty layerId', { ...experimentRecord, layerId: '' }, experimentRecord],
        ['a missing layerId', experimentRecord, { ...experimentRecord, layerId: '' }],
      ])(
        'removes the stored record when the cleared record has %s and the stored one is the other',
        async (_caseLabel, cleared, storedRecord) => {
          await seed([otherStableIdRecord, storedRecord])
          answerDeletes(status)

          await expect(clearStableIdOverride(cleared)).resolves.toBe(expected)

          await expect(stored()).resolves.toStrictEqual([otherStableIdRecord])
        },
      )

      it('removes a stored record of the same group even when it was forced again later', async () => {
        await seed([{ ...experimentRecord, createdAt: LATER }])
        answerDeletes(status)

        await expect(clearStableIdOverride(experimentRecord)).resolves.toBe(expected)

        await expect(stored()).resolves.toStrictEqual([])
      })
    })
  })

  describe('running one operation at a time', () => {
    it('saves both records when two forces for different experiments are started together', async () => {
      const results = await Promise.all([
        forceStableIdIntoGroup(experimentArgs('exp_a')),
        forceStableIdIntoGroup(experimentArgs('exp_b')),
      ])

      expect(results).toStrictEqual([recordFor('exp_a'), recordFor('exp_b')])
      await expect(stored()).resolves.toStrictEqual([recordFor('exp_a'), recordFor('exp_b')])
    })

    it('removes both records when two clears for different experiments are started together', async () => {
      await seed([recordFor('exp_a'), otherStableIdRecord, recordFor('exp_b')])

      const results = await Promise.all([
        clearStableIdOverride(recordFor('exp_a')),
        clearStableIdOverride(recordFor('exp_b')),
      ])

      expect(results).toStrictEqual(['cleared', 'cleared'])
      await expect(stored()).resolves.toStrictEqual([otherStableIdRecord])
    })

    it('runs the other operations when one in the middle fails, and gives each caller its own outcome', async () => {
      await seed([recordFor('exp_x')])
      const error = handlerError({ status: 429 })
      vi.mocked(removeStableIdFromExperimentGroup).mockRejectedValueOnce(error)

      const results = await Promise.allSettled([
        forceStableIdIntoGroup(experimentArgs('exp_a')),
        clearStableIdOverride(recordFor('exp_x')),
        forceStableIdIntoGroup(experimentArgs('exp_c')),
      ])

      expect(results.map(({ status }) => status)).toStrictEqual(['fulfilled', 'rejected', 'fulfilled'])
      expect((results[0] as PromiseFulfilledResult<OverrideRecord>).value).toStrictEqual(recordFor('exp_a'))
      expect((results[1] as PromiseRejectedResult).reason).toBe(error)
      expect((results[2] as PromiseFulfilledResult<OverrideRecord>).value).toStrictEqual(recordFor('exp_c'))
      await expect(stored()).resolves.toStrictEqual([recordFor('exp_x'), recordFor('exp_a'), recordFor('exp_c')])
    })

    it('runs a later force after a force that failed', async () => {
      const error = handlerError({ status: 500 })
      vi.mocked(forceStableIdIntoExperimentGroup).mockRejectedValueOnce(error)

      const failed = forceStableIdIntoGroup(experimentArgs('exp_a'))
      const passed = forceStableIdIntoGroup(experimentArgs('exp_b'))

      await expect(failed).rejects.toBe(error)
      await expect(passed).resolves.toStrictEqual(recordFor('exp_b'))
      await expect(stored()).resolves.toStrictEqual([recordFor('exp_b')])
    })

    it('starts the next call only after the call before has settled, in the order of the calls', async () => {
      const first = Promise.withResolvers<ExperimentOverridesResponse>()
      vi.mocked(forceStableIdIntoExperimentGroup).mockReturnValueOnce(first.promise)
      const forcing = forceStableIdIntoGroup(experimentArgs('exp_a'))
      const clearing = clearStableIdOverride(recordFor('exp_b'))
      const forcingAgain = forceStableIdIntoGroup(experimentArgs('exp_c'))

      try {
        await flush()
        expect(forceStableIdIntoExperimentGroup).toHaveBeenCalledTimes(1)
        expect(removeStableIdFromExperimentGroup).not.toHaveBeenCalled()
      } finally {
        first.resolve(experimentResponse)
      }
      await Promise.all([forcing, clearing, forcingAgain])

      expect(forceStableIdIntoExperimentGroup).toHaveBeenCalledTimes(2)
      expect(removeStableIdFromExperimentGroup).toHaveBeenCalledTimes(1)
      const [firstForce, secondForce] = vi.mocked(forceStableIdIntoExperimentGroup).mock.invocationCallOrder
      const [remove] = vi.mocked(removeStableIdFromExperimentGroup).mock.invocationCallOrder
      expect(firstForce).toBeLessThan(remove)
      expect(remove).toBeLessThan(secondForce)
    })

    it('does not start the record write of a call before the call before it has saved its record', async () => {
      const first = Promise.withResolvers<ExperimentOverridesResponse>()
      vi.mocked(forceStableIdIntoExperimentGroup).mockReturnValueOnce(first.promise)
      const forcing = forceStableIdIntoGroup(experimentArgs('exp_a'))
      const forcingAgain = forceStableIdIntoGroup(experimentArgs('exp_b'))

      try {
        await flush()
        expect(forceStableIdIntoExperimentGroup).toHaveBeenCalledTimes(1)
        expect(setValueSpy()).not.toHaveBeenCalled()
      } finally {
        first.resolve(experimentResponse)
      }
      await Promise.all([forcing, forcingAgain])

      expect(setValueSpy()).toHaveBeenCalledTimes(2)
    })
  })
})
