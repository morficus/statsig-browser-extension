import type { OverrideRecord } from '@/src/lib/override-record'
import type { Experiment } from '@/src/types/statsig'

import { isSameOverrideTarget, upsertOverrideRecord } from '@/src/lib/override-record'
import { overrideRecordsStorage } from '@/src/lib/storage'

import { forceStableIdIntoExperimentGroup, removeStableIdFromExperimentGroup } from './experiment-overrides'
import { forceStableIdIntoLayerGroup, removeStableIdFromLayerGroup } from './layer-overrides'

const HTTP_NOT_FOUND = 404

export interface ForceStableIdArgs {
  experiment: Pick<Experiment, 'id' | 'layerID' | 'name'>
  groupName: string
  stableId: string
  environment: string
}

/** `cleared`: the DELETE returned 200. `not-found`: the experiment or layer is gone (404). */
export type ClearOverrideResult = 'cleared' | 'not-found'

/** A layer counts only for a non-empty string. `null`, `undefined`, and `''` mean "not in a layer". */
const isLayerId = (value: unknown): value is string => typeof value === 'string' && value !== ''

/** The `status` on the `cause` of an error. The handlers wrap a wretch error as the cause. Anything else gives `undefined`. */
const getCauseStatus = (error: unknown): unknown => {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const { cause } = error as { cause?: unknown }
  if (typeof cause !== 'object' || cause === null) {
    return undefined
  }
  return (cause as { status?: unknown }).status
}

/** The end of the queue. It never rejects, so one failed operation does not block the next. */
let queueTail: Promise<void> = Promise.resolve()

const ignore = (): void => undefined

/**
 * Run one operation after every earlier operation has settled, whether it passed or failed. The whole operation
 * waits, the API call and the record write. A record write is a read, then a write of the full list, so two at the
 * same time would lose one change. The caller gets the result or the exact error of its own operation.
 */
const enqueue = <Result>(operation: () => Promise<Result>): Promise<Result> => {
  const result = queueTail.then(operation)
  queueTail = result.then(ignore, ignore)
  return result
}

/** A missing `layerId` and `''` are the same: not in a layer. */
const layerKey = (record: OverrideRecord): string => (isLayerId(record.layerId) ? record.layerId : '')

/** True for a stored record of the same target (experiment, Stable ID, environment) that has the same group and layer. */
const isSameOverride = (stored: OverrideRecord, record: OverrideRecord): boolean =>
  isSameOverrideTarget(stored, record) && stored.groupName === record.groupName && layerKey(stored) === layerKey(record)

const saveRecord = async (record: OverrideRecord): Promise<void> => {
  const records = await overrideRecordsStorage.getValue()
  await overrideRecordsStorage.setValue(upsertOverrideRecord(records, record))
}

/**
 * Remove the stored record, but only if it still has the group and the layer of the record that was cleared.
 * If the Tester forced another group since then, that newer record stays.
 */
const dropRecord = async (record: OverrideRecord): Promise<void> => {
  const records = await overrideRecordsStorage.getValue()
  const remaining = records.filter((stored) => !isSameOverride(stored, record))
  if (remaining.length !== records.length) {
    await overrideRecordsStorage.setValue(remaining)
  }
}

const forceNow = async ({
  environment,
  experiment,
  groupName,
  stableId,
}: ForceStableIdArgs): Promise<OverrideRecord> => {
  const layerId = isLayerId(experiment.layerID) ? experiment.layerID : undefined

  await (layerId === undefined
    ? forceStableIdIntoExperimentGroup({ environment, experimentId: experiment.id, groupName, stableId })
    : forceStableIdIntoLayerGroup({ environment, experimentName: experiment.id, groupName, layerId, stableId }))

  const record: OverrideRecord = {
    createdAt: Date.now(),
    environment,
    experimentId: experiment.id,
    experimentName: experiment.name,
    groupName,
    stableId,
    ...(layerId === undefined ? {} : { layerId }),
  }
  await saveRecord(record)
  return record
}

const clearNow = async (record: OverrideRecord): Promise<ClearOverrideResult> => {
  const { environment, experimentId, groupName, layerId, stableId } = record

  try {
    await (isLayerId(layerId)
      ? removeStableIdFromLayerGroup({ environment, experimentName: experimentId, groupName, layerId, stableId })
      : removeStableIdFromExperimentGroup({ environment, experimentId, groupName, stableId }))
  } catch (error) {
    if (getCauseStatus(error) !== HTTP_NOT_FOUND) {
      throw error
    }
    await dropRecord(record)
    return 'not-found'
  }

  await dropRecord(record)
  return 'cleared'
}

/**
 * Put the Tester's Stable ID into one group (REQ-OVR-008, REQ-OVR-010). An experiment in a layer is written at the
 * layer level. Any other experiment is written at the experiment level. The override record is saved only after the
 * write succeeds (REQ-OVR-012). If the write throws, the same error is thrown and the storage does not change.
 * Calls run one at a time, in the order they were made, together with {@link clearStableIdOverride}.
 * @returns The record that was saved.
 */
export const forceStableIdIntoGroup = (args: ForceStableIdArgs): Promise<OverrideRecord> =>
  enqueue(() => forceNow(args))

/**
 * Take the Tester's Stable ID out of the group in the record, and nothing else (REQ-OVR-009). It sends the single-ID
 * DELETE, with the group and the environment from the record, and the ID type `stableID`. A 200 removes the record
 * (the call is idempotent). A 404 means the experiment or layer is gone, so it removes the record too. The stored
 * record is removed only if it still has the group and the layer of this record. Any other error is thrown again as
 * it is, and the record stays. Calls run one at a time, in the order they were made, together with
 * {@link forceStableIdIntoGroup}.
 */
export const clearStableIdOverride = (record: OverrideRecord): Promise<ClearOverrideResult> =>
  enqueue(() => clearNow(record))
