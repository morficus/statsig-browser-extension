import { beforeEach, vi, describe, expect, it } from 'vitest'

import type { ExperimentOverridesResponse, UserIDOverride } from '@/src/types/statsig'

import {
  deleteExperimentOverrides,
  forceStableIdIntoExperimentGroup,
  removeStableIdFromExperimentGroup,
  updateExperimentOverrides,
} from './experiment-overrides'

const { apiMock, posterMock } = vi.hoisted(() => ({
  apiMock: {
    delete: vi.fn(),
    json: vi.fn(),
    patch: vi.fn(),
    url: vi.fn(),
  },
  posterMock: vi.fn(),
}))

vi.mock('@/src/lib/fetcher', () => ({
  api: apiMock,
  poster: posterMock,
}))

const EXPERIMENT_ID = 'exp/a b'
const EXPERIMENT_PATH = '/experiments/exp%2Fa%20b/overrides'
const STABLE_ID = 'tester-stable-id'
const OTHER_ID = 'other-user-id'
const OTHER_ID_TWO = 'other-user-id-2'
const ENVIRONMENT = 'staging'
const NOT_CONFIRMED = 'Statsig did not confirm the override. Try again.'
const INPUT_MESSAGE = 'An experiment, a group, a Stable ID, and an environment are needed.'

const stableIdArgs = {
  environment: ENVIRONMENT,
  experimentId: EXPERIMENT_ID,
  groupName: 'Test B',
  stableId: STABLE_ID,
}

const entry = (groupID: string, ids: string[], overrides: Partial<UserIDOverride> = {}): UserIDOverride => ({
  environment: ENVIRONMENT,
  groupID,
  ids,
  unitType: 'stableID',
  ...overrides,
})

const state = (...userIDOverrides: UserIDOverride[]): ExperimentOverridesResponse => ({
  overrides: [{ groupID: 'Control', name: 'gate_1', type: 'gate' }],
  userIDOverrides,
})

const wrap = (data: ExperimentOverridesResponse) => ({ data, message: 'Success' })

type StableIdField = keyof typeof stableIdArgs

const stableIdFields: StableIdField[] = ['experimentId', 'groupName', 'stableId', 'environment']

const emptyFieldCases = stableIdFields.flatMap((field): [StableIdField, string | undefined][] => [
  [field, ''],
  [field, undefined],
])

const wretchNotFoundError = () => Object.assign(new Error('raw'), { response: { _data: undefined }, status: 404 })

const mockWriteChain = () => {
  const patchJson = vi.fn()
  const deleteJson = vi.fn()
  const patchMock = vi.fn().mockReturnValue({ json: patchJson })
  const deleteMock = vi.fn().mockReturnValue({ json: deleteJson })
  const urlMock = vi.fn().mockReturnValue({ delete: deleteMock, patch: patchMock })
  apiMock.patch = patchMock
  apiMock.delete = deleteMock
  apiMock.url = urlMock
  return { deleteJson, patchJson }
}

describe('experiment-overrides handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateExperimentOverrides', () => {
    it('should successfully update experiment overrides', async () => {
      const mockOverrides: ExperimentOverridesResponse = {
        overrides: [{ groupID: 'Control', name: 'gate_1', type: 'gate' }],
        userIDOverrides: [{ environment: 'Production', groupID: 'Test', ids: ['user_123'], unitType: 'userID' }],
      }
      posterMock.mockResolvedValue({
        data: mockOverrides,
        message: 'Success',
      })

      const result = await updateExperimentOverrides({
        experimentId: 'exp_123',
        overrides: mockOverrides,
      })

      expect(result).toStrictEqual(mockOverrides)
      expect(posterMock).toHaveBeenCalledWith('/experiments/exp_123/overrides', mockOverrides)
    })

    it('should throw error when update fails', async () => {
      posterMock.mockRejectedValue(new Error('Forbidden'))

      await expect(
        updateExperimentOverrides({
          experimentId: 'exp_123',
          overrides: {} as ExperimentOverridesResponse,
        }),
      ).rejects.toThrow('Forbidden')
    })

    it('should include original error as cause', async () => {
      const originalError = new Error('Network Error')
      posterMock.mockRejectedValue(originalError)

      await expect(
        updateExperimentOverrides({
          experimentId: 'exp_123',
          overrides: {} as ExperimentOverridesResponse,
        }),
      ).rejects.toMatchObject({
        cause: originalError,
        message: 'Network Error',
      })
    })
  })

  describe('deleteExperimentOverrides', () => {
    it('should successfully delete experiment overrides', async () => {
      const mockOverrides: ExperimentOverridesResponse = {
        overrides: [],
        userIDOverrides: [],
      }

      const mockJsonAfterDelete = vi.fn().mockResolvedValue({
        data: mockOverrides,
        message: 'Deleted',
      })
      const mockDelete = vi.fn().mockReturnValue({ json: mockJsonAfterDelete })
      const mockJsonBeforeDelete = vi.fn().mockReturnValue({ delete: mockDelete })
      const mockUrl = vi.fn().mockReturnValue({ json: mockJsonBeforeDelete })

      apiMock.url = mockUrl
      apiMock.json = mockJsonBeforeDelete
      apiMock.delete = mockDelete

      const result = await deleteExperimentOverrides({
        experimentId: 'exp_123',
        overrides: { userIDOverrides: [] },
      })

      expect(result).toStrictEqual(mockOverrides)
      expect(mockUrl).toHaveBeenCalledWith('/experiments/exp_123/overrides')
    })

    it('should throw error when delete fails', async () => {
      const mockJsonAfterDelete = vi.fn().mockRejectedValue(new Error('Not Found'))
      const mockDelete = vi.fn().mockReturnValue({ json: mockJsonAfterDelete })
      const mockJsonBeforeDelete = vi.fn().mockReturnValue({ delete: mockDelete })
      const mockUrl = vi.fn().mockReturnValue({ json: mockJsonBeforeDelete })

      apiMock.url = mockUrl
      apiMock.json = mockJsonBeforeDelete
      apiMock.delete = mockDelete

      await expect(
        deleteExperimentOverrides({
          experimentId: 'nonexistent',
          overrides: {},
        }),
      ).rejects.toThrow('Not Found')
    })

    it('should include original error as cause on delete failure', async () => {
      const originalError = new Error('Server Error')
      const mockJsonAfterDelete = vi.fn().mockRejectedValue(originalError)
      const mockDelete = vi.fn().mockReturnValue({ json: mockJsonAfterDelete })
      const mockJsonBeforeDelete = vi.fn().mockReturnValue({ delete: mockDelete })
      const mockUrl = vi.fn().mockReturnValue({ json: mockJsonBeforeDelete })

      apiMock.url = mockUrl
      apiMock.json = mockJsonBeforeDelete
      apiMock.delete = mockDelete

      await expect(
        deleteExperimentOverrides({
          experimentId: 'exp_123',
          overrides: {},
        }),
      ).rejects.toMatchObject({
        cause: originalError,
        message: 'Server Error',
      })
    })
  })

  describe('removeStableIdFromExperimentGroup', () => {
    it('should send one single-ID DELETE with the exact path and query, and return the data', async () => {
      const { deleteJson } = mockWriteChain()
      const after = state(entry('Test A', [OTHER_ID]))
      deleteJson.mockResolvedValue(wrap(after))

      const result = await removeStableIdFromExperimentGroup(stableIdArgs)

      expect(result).toStrictEqual(after)
      expect(apiMock.url).toHaveBeenCalledTimes(1)
      expect(apiMock.url).toHaveBeenCalledWith(
        '/experiments/exp%2Fa%20b/overrides/userID/tester-stable-id?groupID=Test%20B&unitType=stableID&environment=staging',
      )
      expect(apiMock.delete).toHaveBeenCalledTimes(1)
      expect(apiMock.delete).toHaveBeenCalledWith()
      expect(apiMock.patch).not.toHaveBeenCalled()
    })

    it('should encode the Stable ID and the environment', async () => {
      const { deleteJson } = mockWriteChain()
      deleteJson.mockResolvedValue(wrap(state()))

      await removeStableIdFromExperimentGroup({ ...stableIdArgs, environment: 'my env', stableId: 'id/1 2' })

      expect(apiMock.url).toHaveBeenCalledWith(
        '/experiments/exp%2Fa%20b/overrides/userID/id%2F1%202?groupID=Test%20B&unitType=stableID&environment=my%20env',
      )
    })

    it('should wrap a failure and keep the original error as the cause', async () => {
      const { deleteJson } = mockWriteChain()
      const originalError = Object.assign(new Error('Not Found'), { status: 404 })
      deleteJson.mockRejectedValue(originalError)

      await expect(removeStableIdFromExperimentGroup(stableIdArgs)).rejects.toMatchObject({
        cause: originalError,
        message: 'Not Found',
      })
    })

    it('should apply handleApiError to a wretch-shaped failure and keep it as the cause', async () => {
      const { deleteJson } = mockWriteChain()
      const originalError = wretchNotFoundError()
      deleteJson.mockRejectedValue(originalError)

      const error = await removeStableIdFromExperimentGroup(stableIdArgs).catch((error_: unknown) => error_)

      expect((error as Error).message).toBe('The requested resource was not found.')
      expect((error as Error).cause).toBe(originalError)
      expect(((error as Error).cause as { status: number }).status).toBe(404)
    })

    it.each(emptyFieldCases)(
      'should throw the input message and send no request when %s is %j',
      async (field, value) => {
        mockWriteChain()

        await expect(removeStableIdFromExperimentGroup({ ...stableIdArgs, [field]: value })).rejects.toThrow(
          INPUT_MESSAGE,
        )
        expect(apiMock.url).not.toHaveBeenCalled()
      },
    )
  })

  describe('forceStableIdIntoExperimentGroup', () => {
    it('should PATCH an encoded path with a body that holds only the Tester ID', async () => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test B', [STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))

      await forceStableIdIntoExperimentGroup(stableIdArgs)

      expect(apiMock.url).toHaveBeenCalledTimes(1)
      expect(apiMock.url).toHaveBeenCalledWith(EXPERIMENT_PATH)
      expect(apiMock.patch).toHaveBeenCalledTimes(1)
      expect(apiMock.patch.mock.calls[0]).toStrictEqual([
        {
          overrides: [],
          userIDOverrides: [{ environment: ENVIRONMENT, groupID: 'Test B', ids: [STABLE_ID], unitType: 'stableID' }],
        },
      ])
    })

    it('should send no DELETE and return the result when only the target group has the Tester ID', async () => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(
        entry('Test A', [OTHER_ID]),
        entry('Test B', [OTHER_ID_TWO, STABLE_ID]),
        entry('Test C', [OTHER_ID_TWO]),
      )
      patchJson.mockResolvedValue(wrap(afterPatch))

      const result = await forceStableIdIntoExperimentGroup(stableIdArgs)

      expect(result).toStrictEqual(afterPatch)
      expect(apiMock.delete).not.toHaveBeenCalled()
      expect(apiMock.url).toHaveBeenCalledTimes(1)
    })

    it('should remove the Tester ID from the old group with one single-ID DELETE and return its response', async () => {
      const { deleteJson, patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [OTHER_ID, STABLE_ID]), entry('Test B', [OTHER_ID_TWO, STABLE_ID]))
      const afterDelete = state(entry('Test A', [OTHER_ID]), entry('Test B', [OTHER_ID_TWO, STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))
      deleteJson.mockResolvedValue(wrap(afterDelete))

      const result = await forceStableIdIntoExperimentGroup(stableIdArgs)

      expect(result).toStrictEqual(afterDelete)
      expect(apiMock.patch).toHaveBeenCalledTimes(1)
      expect(apiMock.delete).toHaveBeenCalledTimes(1)
      expect(apiMock.url).toHaveBeenCalledTimes(2)
      expect(apiMock.url).toHaveBeenNthCalledWith(1, EXPERIMENT_PATH)
      expect(apiMock.url).toHaveBeenNthCalledWith(
        2,
        '/experiments/exp%2Fa%20b/overrides/userID/tester-stable-id?groupID=Test%20A&unitType=stableID&environment=staging',
      )
    })

    it('should send the PATCH before the DELETE and mention no other ID in any request', async () => {
      const { deleteJson, patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [OTHER_ID, STABLE_ID]), entry('Test B', [OTHER_ID_TWO, STABLE_ID]))
      const afterDelete = state(entry('Test A', [OTHER_ID]), entry('Test B', [OTHER_ID_TWO, STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))
      deleteJson.mockResolvedValue(wrap(afterDelete))

      await forceStableIdIntoExperimentGroup(stableIdArgs)

      const [patchOrder] = apiMock.patch.mock.invocationCallOrder
      const [deleteOrder] = apiMock.delete.mock.invocationCallOrder
      const sent = JSON.stringify([apiMock.url.mock.calls, apiMock.patch.mock.calls])
      expect(patchOrder).toBeLessThan(deleteOrder)
      expect(sent).not.toContain(OTHER_ID)
      expect(sent).not.toContain(OTHER_ID_TWO)
    })

    it('should remove the Tester ID from each old group one at a time, in response order', async () => {
      const { deleteJson, patchJson } = mockWriteChain()
      const afterPatch = state(
        entry('Test C', [STABLE_ID]),
        entry('Test A', [STABLE_ID]),
        entry('Test C', [STABLE_ID]),
        entry('Test B', [STABLE_ID]),
      )
      const afterFirstDelete = state(entry('Test A', [STABLE_ID]), entry('Test B', [STABLE_ID]))
      const afterSecondDelete = state(entry('Test B', [STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))
      deleteJson.mockResolvedValueOnce(wrap(afterFirstDelete)).mockResolvedValueOnce(wrap(afterSecondDelete))

      const result = await forceStableIdIntoExperimentGroup(stableIdArgs)

      expect(result).toStrictEqual(afterSecondDelete)
      expect(apiMock.delete).toHaveBeenCalledTimes(2)
      expect(apiMock.url).toHaveBeenNthCalledWith(
        2,
        '/experiments/exp%2Fa%20b/overrides/userID/tester-stable-id?groupID=Test%20C&unitType=stableID&environment=staging',
      )
      expect(apiMock.url).toHaveBeenNthCalledWith(
        3,
        '/experiments/exp%2Fa%20b/overrides/userID/tester-stable-id?groupID=Test%20A&unitType=stableID&environment=staging',
      )
    })

    it.each([
      ['environment null', { environment: null }],
      ['environment undefined', { environment: undefined }],
      ['another environment', { environment: 'production' }],
      ['unit type userID', { unitType: 'userID' }],
      ['unit type null', { unitType: null }],
      ['unit type undefined', { unitType: undefined }],
    ])('should send no DELETE when the Tester ID in another group has %s', async (_label, overrides) => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [STABLE_ID], overrides), entry('Test B', [STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))

      const result = await forceStableIdIntoExperimentGroup(stableIdArgs)

      expect(result).toStrictEqual(afterPatch)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it('should throw when the PATCH response does not have the Tester ID in the target group', async () => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [OTHER_ID]), entry('Test B', [OTHER_ID_TWO]))
      patchJson.mockResolvedValue(wrap(afterPatch))

      await expect(forceStableIdIntoExperimentGroup(stableIdArgs)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it('should confirm before any clean-up: the ID only in another same-bucket group means no DELETE', async () => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [STABLE_ID]), entry('Test B', [OTHER_ID_TWO]))
      patchJson.mockResolvedValue(wrap(afterPatch))

      await expect(forceStableIdIntoExperimentGroup(stableIdArgs)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.url).toHaveBeenCalledTimes(1)
      expect(apiMock.patch).toHaveBeenCalledTimes(1)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it.each([
      ['no userIDOverrides', { data: { overrides: [] }, message: 'Success' }],
      ['userIDOverrides that is not an array', { data: { overrides: [], userIDOverrides: {} }, message: 'Success' }],
      ['no data', { message: 'Success' }],
      ['null data', { data: null, message: 'Success' }],
      [
        'a target entry without ids',
        {
          data: state(entry('Test A', [STABLE_ID]), {
            environment: ENVIRONMENT,
            groupID: 'Test B',
            unitType: 'stableID',
          } as unknown as UserIDOverride),
          message: 'Success',
        },
      ],
      [
        'a target entry whose ids is not an array',
        {
          data: state(entry('Test A', [STABLE_ID]), {
            environment: ENVIRONMENT,
            groupID: 'Test B',
            ids: STABLE_ID,
            unitType: 'stableID',
          } as never),
          message: 'Success',
        },
      ],
    ])('should throw the confirm message and send no DELETE when the PATCH response has %s', async (_label, body) => {
      const { patchJson } = mockWriteChain()
      patchJson.mockResolvedValue(body)

      await expect(forceStableIdIntoExperimentGroup(stableIdArgs)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it('should treat another-group entries without an ids array as holding no IDs', async () => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(
        { environment: ENVIRONMENT, groupID: 'Test A', unitType: 'stableID' } as unknown as UserIDOverride,
        entry('Test B', [STABLE_ID]),
      )
      patchJson.mockResolvedValue(wrap(afterPatch))

      const result = await forceStableIdIntoExperimentGroup(stableIdArgs)

      expect(result).toStrictEqual(afterPatch)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it('should throw the confirm message when a clean-up DELETE response has no data', async () => {
      const { deleteJson, patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [STABLE_ID]), entry('Test B', [STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))
      deleteJson.mockResolvedValue({ message: 'Success' })

      await expect(forceStableIdIntoExperimentGroup(stableIdArgs)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.delete).toHaveBeenCalledTimes(1)
    })

    it('should apply handleApiError to a wretch-shaped PATCH failure and keep it as the cause', async () => {
      const { patchJson } = mockWriteChain()
      const originalError = wretchNotFoundError()
      patchJson.mockRejectedValue(originalError)

      const error = await forceStableIdIntoExperimentGroup(stableIdArgs).catch((error_: unknown) => error_)

      expect((error as Error).message).toBe('The requested resource was not found.')
      expect((error as Error).cause).toBe(originalError)
      expect(((error as Error).cause as { status: number }).status).toBe(404)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it('should throw when the Tester ID in the target group is in another environment', async () => {
      const { patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test B', [STABLE_ID], { environment: 'production' }))
      patchJson.mockResolvedValue(wrap(afterPatch))

      await expect(forceStableIdIntoExperimentGroup(stableIdArgs)).rejects.toThrow(NOT_CONFIRMED)
    })

    it('should throw when the DELETE response still has the Tester ID in the old group', async () => {
      const { deleteJson, patchJson } = mockWriteChain()
      const afterPatch = state(entry('Test A', [STABLE_ID]), entry('Test B', [STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))
      deleteJson.mockResolvedValue(wrap(afterPatch))

      await expect(forceStableIdIntoExperimentGroup(stableIdArgs)).rejects.toThrow(NOT_CONFIRMED)
      expect(apiMock.delete).toHaveBeenCalledTimes(1)
    })

    it('should keep the original error as the cause and send no DELETE when the PATCH fails', async () => {
      const { patchJson } = mockWriteChain()
      const originalError = Object.assign(new Error('Server Error'), { status: 500 })
      patchJson.mockRejectedValue(originalError)

      const error = await forceStableIdIntoExperimentGroup(stableIdArgs).catch((error_: unknown) => error_)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Server Error')
      expect((error as Error).cause).toBe(originalError)
      expect(apiMock.delete).not.toHaveBeenCalled()
    })

    it('should let a failed clean-up DELETE propagate unwrapped once and make no more calls', async () => {
      const { deleteJson, patchJson } = mockWriteChain()
      const originalError = Object.assign(new Error('Rate limit'), { status: 429 })
      const afterPatch = state(entry('Test A', [STABLE_ID]), entry('Test C', [STABLE_ID]), entry('Test B', [STABLE_ID]))
      patchJson.mockResolvedValue(wrap(afterPatch))
      deleteJson.mockRejectedValue(originalError)

      const error = await forceStableIdIntoExperimentGroup(stableIdArgs).catch((error_: unknown) => error_)

      expect((error as Error).message).toBe('Rate limit')
      expect((error as Error).cause).toBe(originalError)
      expect(apiMock.patch).toHaveBeenCalledTimes(1)
      expect(apiMock.delete).toHaveBeenCalledTimes(1)
      expect(apiMock.url).toHaveBeenCalledTimes(2)
    })

    it.each(emptyFieldCases)(
      'should throw the input message and send no request when %s is %j',
      async (field, value) => {
        mockWriteChain()

        await expect(forceStableIdIntoExperimentGroup({ ...stableIdArgs, [field]: value })).rejects.toThrow(
          INPUT_MESSAGE,
        )
        expect(apiMock.url).not.toHaveBeenCalled()
      },
    )
  })
})
