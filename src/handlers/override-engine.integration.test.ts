import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { OverrideRecord } from '@/src/lib/override-record'

import { API_BASE_URL } from '@/src/lib/api-config'
import { overrideRecordsStorage } from '@/src/lib/storage'
import { useSettingsStore } from '@/src/store/use-settings-store'

import { clearStableIdOverride, forceStableIdIntoGroup } from './override-engine'

// The engine, the real handlers, and the real `api` (wretch) in `src/lib/fetcher.ts` run here.
// Only the message to the background script is mocked. Storage is the real fake browser storage.
const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}))

vi.mock(import('wxt/browser'), async (importOriginal) => ({
  ...(await importOriginal()),
  browser: {
    runtime: {
      sendMessage: sendMessageMock,
    },
  } as any,
}))

const NOW = 1_700_000_000_000
const STABLE_ID = 'tester-stable-id'
const OTHER_ID = 'someone-elses-id'
const ENVIRONMENT = 'staging'

const experimentRecord: OverrideRecord = {
  createdAt: NOW,
  environment: ENVIRONMENT,
  experimentId: 'exp_1',
  experimentName: 'Experiment One',
  groupName: 'Test B',
  stableId: STABLE_ID,
}

const otherRecord: OverrideRecord = { ...experimentRecord, experimentId: 'exp_2', experimentName: 'Experiment Two' }

/** What the background script sends back for a response from Statsig. */
const backgroundResponse = (status: number, data: unknown) => ({
  response: {
    data,
    headers: typeof data === 'string' ? { 'content-type': 'text/plain' } : { 'content-type': 'application/json' },
    status,
    statusText: String(status),
  },
  success: true,
})

interface BackgroundMessage {
  config: { body?: unknown; method: string; url: string }
  type: string
}

/** The single message that went to the background script, with the body parsed. */
const sentRequest = () => {
  expect(sendMessageMock).toHaveBeenCalledTimes(1)
  const [[message]] = sendMessageMock.mock.calls as [[BackgroundMessage]]
  const { body, method, url } = message.config
  return { body: typeof body === 'string' ? JSON.parse(body) : body, method, type: message.type, url }
}

describe('override-engine with the real handlers and the real api', () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    fakeBrowser.reset()
    useSettingsStore.setState({ apiKey: '' })
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  it('forces an experiment that is not in a layer: one PATCH with only the Tester ID, then saves the record', async () => {
    sendMessageMock.mockResolvedValue(
      backgroundResponse(200, {
        data: {
          overrides: [],
          userIDOverrides: [
            { environment: ENVIRONMENT, groupID: 'Test B', ids: [OTHER_ID, STABLE_ID], unitType: 'stableID' },
          ],
        },
        message: 'Success',
      }),
    )

    const result = await forceStableIdIntoGroup({
      environment: ENVIRONMENT,
      experiment: { id: 'exp_1', layerID: null, name: 'Experiment One' },
      groupName: 'Test B',
      stableId: STABLE_ID,
    })

    expect(sentRequest()).toStrictEqual({
      body: {
        overrides: [],
        userIDOverrides: [{ environment: ENVIRONMENT, groupID: 'Test B', ids: [STABLE_ID], unitType: 'stableID' }],
      },
      method: 'PATCH',
      type: 'API_REQUEST',
      url: `${API_BASE_URL}/experiments/exp_1/overrides`,
    })
    expect(result).toStrictEqual(experimentRecord)
    await expect(overrideRecordsStorage.getValue()).resolves.toStrictEqual([experimentRecord])
  })

  it('forces an experiment in a layer: one PATCH to the layer with the experiment id, then saves the record', async () => {
    sendMessageMock.mockResolvedValue(
      backgroundResponse(200, {
        data: {
          conditionalOverrides: [],
          idOverrides: [
            {
              environment: ENVIRONMENT,
              experimentName: 'exp_1',
              groupName: 'Test B',
              idType: 'stableID',
              ids: [STABLE_ID],
            },
          ],
        },
        message: 'Success',
      }),
    )

    const result = await forceStableIdIntoGroup({
      environment: ENVIRONMENT,
      experiment: { id: 'exp_1', layerID: 'layer_1', name: 'Experiment One' },
      groupName: 'Test B',
      stableId: STABLE_ID,
    })

    expect(sentRequest()).toStrictEqual({
      body: {
        conditionalOverrides: [],
        idOverrides: [
          {
            environment: ENVIRONMENT,
            experimentName: 'exp_1',
            groupName: 'Test B',
            idType: 'stableID',
            ids: [STABLE_ID],
          },
        ],
        op: 'add',
      },
      method: 'PATCH',
      type: 'API_REQUEST',
      url: `${API_BASE_URL}/layers/layer_1/overrides`,
    })
    expect(result).toStrictEqual({ ...experimentRecord, layerId: 'layer_1' })
    await expect(overrideRecordsStorage.getValue()).resolves.toStrictEqual([
      { ...experimentRecord, layerId: 'layer_1' },
    ])
  })

  it('clears with a 404: sends the single-ID DELETE, drops the record, and returns not-found', async () => {
    await overrideRecordsStorage.setValue([experimentRecord, otherRecord])
    sendMessageMock.mockResolvedValue(backgroundResponse(404, { message: 'Experiment not found' }))

    await expect(clearStableIdOverride(experimentRecord)).resolves.toBe('not-found')

    expect(sentRequest()).toStrictEqual({
      body: undefined,
      method: 'DELETE',
      type: 'API_REQUEST',
      url: `${API_BASE_URL}/experiments/exp_1/overrides/userID/${STABLE_ID}?groupID=Test%20B&unitType=stableID&environment=${ENVIRONMENT}`,
    })
    await expect(overrideRecordsStorage.getValue()).resolves.toStrictEqual([otherRecord])
  })

  it('does not save a record when a force gets a plain-text 401, and throws the key-not-valid message with the status as the cause', async () => {
    sendMessageMock.mockResolvedValue(backgroundResponse(401, 'Unauthorized'))

    const error: unknown = await forceStableIdIntoGroup({
      environment: ENVIRONMENT,
      experiment: { id: 'exp_1', layerID: null, name: 'Experiment One' },
      groupName: 'Test B',
      stableId: STABLE_ID,
    }).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('The Console Key is not valid. Check the key, then try again.')
    expect(((error as Error).cause as { status: number }).status).toBe(401)
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    await expect(fakeBrowser.storage.local.get(null)).resolves.toStrictEqual({})
  })
})
