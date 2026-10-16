import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LayerIDOverride, LayerOverridesResponse } from '@/src/types/statsig'

import { forceStableIdIntoLayerGroup, removeStableIdFromLayerGroup } from './layer-overrides'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    deleteCall: vi.fn(),
    deleteJson: vi.fn(),
    patchCall: vi.fn(),
    patchJson: vi.fn(),
    url: vi.fn(),
  },
}))

vi.mock('@/src/lib/fetcher', () => ({
  api: {
    url: apiMock.url,
  },
}))

const STABLE_ID = 'tester-stable-id'
const OTHER_ID = 'someone-elses-id'
const NOT_CONFIRMED = 'Statsig did not confirm the override. Try again.'
const INPUT_MESSAGE = 'A layer, an experiment, a group, a Stable ID, and an environment are needed.'
const NOT_FOUND_MESSAGE = 'The requested resource was not found.'

const args = {
  environment: 'staging',
  experimentName: 'exp_1',
  groupName: 'Test B',
  layerId: 'layer/a b',
  stableId: STABLE_ID,
}

const entry = (overrides: Partial<LayerIDOverride> & Pick<LayerIDOverride, 'groupName' | 'ids'>): LayerIDOverride => ({
  environment: 'staging',
  experimentName: 'exp_1',
  idType: 'stableID',
  ...overrides,
})

const state = (...idOverrides: LayerIDOverride[]): LayerOverridesResponse => ({
  conditionalOverrides: [],
  idOverrides,
})

const response = (data: LayerOverridesResponse) => ({ data, message: 'Success' })

/** The error shape that wretch throws. `handleApiError` reads `response._data` and `status`. */
const wretchError = (status: number) => Object.assign(new Error('raw'), { response: { _data: undefined }, status })

const resolvePatch = (data: LayerOverridesResponse) => apiMock.patchJson.mockResolvedValue(response(data))
const resolveDelete = (data: LayerOverridesResponse) => apiMock.deleteJson.mockResolvedValue(response(data))

/** Every path and body that went out, as one string. Used to check that no other ID is sent. */
const everythingSent = (): string =>
  JSON.stringify([apiMock.url.mock.calls, apiMock.patchCall.mock.calls, apiMock.deleteCall.mock.calls])

const expectedDeletePath = (groupName: string) =>
  `/layers/layer%2Fa%20b/overrides/userID/${STABLE_ID}` +
  `?groupName=${encodeURIComponent(groupName)}&experimentName=exp_1&idType=stableID&environment=staging`

describe('layer-overrides handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.patchCall.mockReturnValue({ json: apiMock.patchJson })
    apiMock.deleteCall.mockReturnValue({ json: apiMock.deleteJson })
    apiMock.url.mockReturnValue({ delete: apiMock.deleteCall, patch: apiMock.patchCall })
  })

  describe('forceStableIdIntoLayerGroup', () => {
    it('sends one PATCH with only the Tester ID, and encodes the layer id in the path', async () => {
      resolvePatch(state(entry({ groupName: 'Test B', ids: [STABLE_ID] })))

      await forceStableIdIntoLayerGroup(args)

      expect(apiMock.url).toHaveBeenCalledExactlyOnceWith('/layers/layer%2Fa%20b/overrides')
      expect(apiMock.patchCall).toHaveBeenCalledTimes(1)
      expect(apiMock.patchCall.mock.calls[0]?.[0]).toStrictEqual({
        conditionalOverrides: [],
        idOverrides: [
          {
            environment: 'staging',
            experimentName: 'exp_1',
            groupName: 'Test B',
            idType: 'stableID',
            ids: [STABLE_ID],
          },
        ],
        op: 'add',
      })
      expect(apiMock.deleteCall).not.toHaveBeenCalled()
    })

    it('sends no DELETE and returns the response when the ID is only in the target group', async () => {
      const afterPatch: LayerOverridesResponse = {
        conditionalOverrides: [{ id: 'segment_1', type: 'segment' }],
        idOverrides: [
          entry({ groupName: 'Test A', ids: [OTHER_ID, 'third-id'] }),
          entry({ groupName: 'Test B', ids: [OTHER_ID, STABLE_ID] }),
          entry({ groupName: 'Test C', ids: ['fourth-id'] }),
        ],
      }
      resolvePatch(afterPatch)

      const result = await forceStableIdIntoLayerGroup(args)

      expect(result).toStrictEqual(afterPatch)
      expect(apiMock.deleteCall).not.toHaveBeenCalled()
      expect(apiMock.url).toHaveBeenCalledTimes(1)
    })

    it('removes the ID from group A after the PATCH when it moves from A to B', async () => {
      const afterPatch = state(
        entry({ groupName: 'Test A', ids: [OTHER_ID, STABLE_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      const afterDelete = state(
        entry({ groupName: 'Test A', ids: [OTHER_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      resolvePatch(afterPatch)
      resolveDelete(afterDelete)

      const result = await forceStableIdIntoLayerGroup(args)

      expect(result).toStrictEqual(afterDelete)
      expect(apiMock.deleteCall).toHaveBeenCalledExactlyOnceWith()
      expect(apiMock.url).toHaveBeenCalledTimes(2)
      expect(apiMock.url).toHaveBeenNthCalledWith(1, '/layers/layer%2Fa%20b/overrides')
      expect(apiMock.url).toHaveBeenNthCalledWith(2, expectedDeletePath('Test A'))
      expect(everythingSent()).not.toContain(OTHER_ID)
    })

    it('removes the ID from every other group, one after the other, and returns the last response', async () => {
      const afterPatch = state(
        entry({ groupName: 'Test A', ids: [STABLE_ID] }),
        entry({ groupName: 'Control', ids: [STABLE_ID, OTHER_ID] }),
        // A true duplicate of the entry above (same bucket). It must not cause a second DELETE for group A.
        entry({ groupName: 'Test A', ids: [STABLE_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      const afterFirstDelete = state(
        entry({ groupName: 'Control', ids: [STABLE_ID, OTHER_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      const afterSecondDelete = state(
        entry({ groupName: 'Control', ids: [OTHER_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      resolvePatch(afterPatch)
      apiMock.deleteJson
        .mockResolvedValueOnce(response(afterFirstDelete))
        .mockResolvedValueOnce(response(afterSecondDelete))

      const result = await forceStableIdIntoLayerGroup(args)

      expect(result).toStrictEqual(afterSecondDelete)
      expect(apiMock.deleteCall).toHaveBeenCalledTimes(2)
      expect(apiMock.url).toHaveBeenNthCalledWith(2, expectedDeletePath('Test A'))
      expect(apiMock.url).toHaveBeenNthCalledWith(3, expectedDeletePath('Control'))
      expect(everythingSent()).not.toContain(OTHER_ID)
    })

    it.each([
      ['environment is null', { environment: null }],
      ['environment is undefined', { environment: undefined }],
      ['environment is another environment', { environment: 'production' }],
      ['idType is userID', { idType: 'userID' }],
      ['idType is null', { idType: null }],
      ['idType is undefined', { idType: undefined }],
      ['experimentName is another experiment', { experimentName: 'exp_2' }],
      ['experimentName is null', { experimentName: null }],
      ['experimentName is undefined', { experimentName: undefined }],
    ] as [string, Partial<LayerIDOverride>][])(
      'sends no DELETE when the ID is in another group and %s',
      async (_label, otherBucket) => {
        const afterPatch = state(
          { ...entry({ groupName: 'Test A', ids: [STABLE_ID] }), ...otherBucket },
          entry({ groupName: 'Test B', ids: [STABLE_ID] }),
        )
        resolvePatch(afterPatch)

        const result = await forceStableIdIntoLayerGroup(args)

        expect(result).toStrictEqual(afterPatch)
        expect(apiMock.deleteCall).not.toHaveBeenCalled()
      },
    )

    it('throws when the PATCH response does not have the ID in the target group', async () => {
      resolvePatch(state(entry({ groupName: 'Test B', ids: [OTHER_ID] })))

      await expect(forceStableIdIntoLayerGroup(args)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.deleteCall).not.toHaveBeenCalled()
      expect(apiMock.patchCall).toHaveBeenCalledTimes(1)
    })

    it('throws before any DELETE when the PATCH response has the ID only in another group of the same bucket', async () => {
      // Otherwise the clean-up would remove the ID from group A, and the Tester would be in no group.
      resolvePatch(
        state(
          entry({ groupName: 'Test A', ids: [STABLE_ID, OTHER_ID] }),
          entry({ groupName: 'Test B', ids: [OTHER_ID] }),
        ),
      )

      await expect(forceStableIdIntoLayerGroup(args)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.url).toHaveBeenCalledTimes(1)
      expect(apiMock.deleteCall).not.toHaveBeenCalled()
      expect(everythingSent()).not.toContain('userID')
    })

    it.each([
      ['has no data', {}],
      ['has null data', { data: null }],
      ['has no idOverrides', { data: { conditionalOverrides: [] } }],
      [
        'has idOverrides that is not an array',
        { data: { conditionalOverrides: [], idOverrides: { Test_B: [STABLE_ID] } } },
      ],
      ['has null in idOverrides', { data: { conditionalOverrides: [], idOverrides: [null] } }],
      [
        'has a target entry with no ids',
        {
          data: {
            conditionalOverrides: [],
            idOverrides: [{ environment: 'staging', experimentName: 'exp_1', groupName: 'Test B', idType: 'stableID' }],
          },
        },
      ],
      [
        'has a target entry whose ids is not an array',
        { data: state({ ...entry({ groupName: 'Test B', ids: [] }), ids: STABLE_ID as unknown as string[] }) },
      ],
    ] as [string, unknown][])(
      'throws the confirm message and sends no DELETE when the PATCH response %s',
      async (_label, body) => {
        apiMock.patchJson.mockResolvedValue(body)

        await expect(forceStableIdIntoLayerGroup(args)).rejects.toThrow(NOT_CONFIRMED)
        expect(apiMock.url).toHaveBeenCalledTimes(1)
        expect(apiMock.deleteCall).not.toHaveBeenCalled()
      },
    )

    it('ignores another group whose entry has no ids, and sends no DELETE for it', async () => {
      const afterPatch = state(
        { ...entry({ groupName: 'Test A', ids: [] }), ids: undefined as unknown as string[] },
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      resolvePatch(afterPatch)

      await expect(forceStableIdIntoLayerGroup(args)).resolves.toStrictEqual(afterPatch)
      expect(apiMock.deleteCall).not.toHaveBeenCalled()
    })

    it('throws when the ID is in the target group of another experiment only', async () => {
      const otherExperiment = entry({ experimentName: 'exp_2', groupName: 'Test B', ids: [STABLE_ID] })
      resolvePatch(state(otherExperiment))

      await expect(forceStableIdIntoLayerGroup(args)).rejects.toThrow(NOT_CONFIRMED)
    })

    it('throws when the DELETE response still has the ID in group A', async () => {
      const stillInBothGroups = state(
        entry({ groupName: 'Test A', ids: [STABLE_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      resolvePatch(stillInBothGroups)
      resolveDelete(stillInBothGroups)

      await expect(forceStableIdIntoLayerGroup(args)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.deleteCall).toHaveBeenCalledTimes(1)
    })

    it('throws the confirm message when the DELETE response has no data', async () => {
      resolvePatch(
        state(entry({ groupName: 'Test A', ids: [STABLE_ID] }), entry({ groupName: 'Test B', ids: [STABLE_ID] })),
      )
      apiMock.deleteJson.mockResolvedValue({})

      await expect(forceStableIdIntoLayerGroup(args)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.deleteCall).toHaveBeenCalledTimes(1)
    })

    it('wraps a failed PATCH with the original error as cause, and sends no DELETE', async () => {
      const originalError = wretchError(404)
      apiMock.patchJson.mockRejectedValue(originalError)

      const thrown: unknown = await forceStableIdIntoLayerGroup(args).catch((error: unknown) => error)

      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).message).toBe(NOT_FOUND_MESSAGE)
      expect((thrown as Error).cause).toBe(originalError)
      expect(((thrown as Error).cause as { status: number }).status).toBe(404)
      expect(apiMock.deleteCall).not.toHaveBeenCalled()
    })

    it('lets a failed clean-up DELETE propagate as is, and makes no more calls', async () => {
      const originalError = wretchError(404)
      const inThreeGroups = state(
        entry({ groupName: 'Test A', ids: [STABLE_ID] }),
        entry({ groupName: 'Control', ids: [STABLE_ID] }),
        entry({ groupName: 'Test B', ids: [STABLE_ID] }),
      )
      resolvePatch(inThreeGroups)
      apiMock.deleteJson.mockRejectedValue(originalError)

      const thrown: unknown = await forceStableIdIntoLayerGroup(args).catch((error: unknown) => error)

      expect(thrown).toBeInstanceOf(Error)
      // The message is from the original error, and the cause is that error, not another wrapped Error.
      // So the error was wrapped once.
      expect((thrown as Error).message).toBe(NOT_FOUND_MESSAGE)
      expect((thrown as Error).cause).toBe(originalError)
      expect(apiMock.deleteCall).toHaveBeenCalledTimes(1)
      expect(apiMock.url).toHaveBeenCalledTimes(2)
    })

    describe.each(['environment', 'experimentName', 'groupName', 'layerId', 'stableId'] as const)(
      'when %s is',
      (field) => {
        it.each([
          ['an empty string', ''],
          ['undefined', undefined],
          ['null', null],
        ])('%s, it throws the input message and sends no request', async (_label, value) => {
          await expect(forceStableIdIntoLayerGroup({ ...args, [field]: value as unknown as string })).rejects.toThrow(
            INPUT_MESSAGE,
          )
          expect(apiMock.url).not.toHaveBeenCalled()
        })
      },
    )

    it('does not trim: a field with only a space is sent', async () => {
      resolvePatch(state(entry({ groupName: ' ', ids: [STABLE_ID] })))

      await expect(forceStableIdIntoLayerGroup({ ...args, groupName: ' ' })).resolves.toBeDefined()
      expect(apiMock.patchCall).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeStableIdFromLayerGroup', () => {
    it('sends the single-ID DELETE with the exact path and query, and no body', async () => {
      const afterDelete = state(entry({ groupName: 'Test A', ids: [OTHER_ID] }))
      resolveDelete(afterDelete)

      const result = await removeStableIdFromLayerGroup(args)

      expect(result).toStrictEqual(afterDelete)
      expect(apiMock.url).toHaveBeenCalledExactlyOnceWith(
        '/layers/layer%2Fa%20b/overrides/userID/tester-stable-id' +
          '?groupName=Test%20B&experimentName=exp_1&idType=stableID&environment=staging',
      )
      expect(apiMock.deleteCall).toHaveBeenCalledExactlyOnceWith()
      expect(apiMock.patchCall).not.toHaveBeenCalled()
      expect(apiMock.deleteJson).toHaveBeenCalledTimes(1)
    })

    it('encodes every value in the path and the query', async () => {
      resolveDelete(state())

      await removeStableIdFromLayerGroup({
        environment: 'stag&ing',
        experimentName: 'exp 1/x',
        groupName: 'Test B',
        layerId: 'layer/a b',
        stableId: 'id/with space',
      })

      expect(apiMock.url).toHaveBeenCalledWith(
        '/layers/layer%2Fa%20b/overrides/userID/id%2Fwith%20space' +
          '?groupName=Test%20B&experimentName=exp%201%2Fx&idType=stableID&environment=stag%26ing',
      )
    })

    it('wraps a failed DELETE with the original error as cause', async () => {
      const originalError = wretchError(404)
      apiMock.deleteJson.mockRejectedValue(originalError)

      const thrown: unknown = await removeStableIdFromLayerGroup(args).catch((error: unknown) => error)

      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).message).toBe(NOT_FOUND_MESSAGE)
      expect((thrown as Error).cause).toBe(originalError)
      expect(((thrown as Error).cause as { status: number }).status).toBe(404)
    })

    describe.each(['environment', 'experimentName', 'groupName', 'layerId', 'stableId'] as const)(
      'when %s is',
      (field) => {
        it.each([
          ['an empty string', ''],
          ['undefined', undefined],
          ['null', null],
        ])('%s, it throws the input message and sends no request', async (_label, value) => {
          await expect(removeStableIdFromLayerGroup({ ...args, [field]: value as unknown as string })).rejects.toThrow(
            INPUT_MESSAGE,
          )
          expect(apiMock.url).not.toHaveBeenCalled()
        })
      },
    )
  })
})
