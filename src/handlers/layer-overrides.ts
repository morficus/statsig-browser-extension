import type { LayerIDOverride, LayerOverridesResponse } from '@/src/types/statsig'

import { api } from '@/src/lib/fetcher'
import { handleApiError } from '@/src/lib/utils'

const STABLE_ID_TYPE = 'stableID'
const NOT_CONFIRMED_MESSAGE = 'Statsig did not confirm the override. Try again.'

interface ApiResponse<DataType> {
  data: DataType
  message?: string
}

export interface LayerStableIdOverrideArgs {
  /** `Experiment.layerID`, used as the layer path id (WL-053). */
  layerId: string
  /** The experiment `id` (WL-059). */
  experimentName: string
  /** The group name, exactly as in the experiment. */
  groupName: string
  stableId: string
  /** The exact environment, for example "staging". */
  environment: string
}

const assertArgs = ({ layerId, experimentName, groupName, stableId, environment }: LayerStableIdOverrideArgs): void => {
  // A stored record can be incomplete at run time, so check the type too. `undefined` must never reach a path.
  const fields: unknown[] = [layerId, experimentName, groupName, stableId, environment]
  if (fields.some((field) => typeof field !== 'string' || field === '')) {
    throw new Error('A layer, an experiment, a group, a Stable ID, and an environment are needed.')
  }
}

/**
 * The entries of a response. A response with no data, or with no `idOverrides` array, has no entries.
 * An item that is not an object is dropped, so a malformed response ends as "not confirmed", not as a TypeError.
 */
const getEntries = (state: Partial<LayerOverridesResponse> | null | undefined): LayerIDOverride[] => {
  const entries: unknown = state?.idOverrides
  if (!Array.isArray(entries)) {
    return []
  }
  return entries.filter((entry): entry is LayerIDOverride => typeof entry === 'object' && entry !== null)
}

/** An entry whose `ids` is not an array holds no IDs. */
const holdsId = (entry: LayerIDOverride, stableId: string): boolean =>
  Array.isArray(entry.ids) && entry.ids.includes(stableId)

/** True for an entry in the same bucket as the request: same environment, ID type, and experiment. */
const isSameBucket = (entry: LayerIDOverride, { environment, experimentName }: LayerStableIdOverrideArgs): boolean =>
  entry.environment === environment && entry.idType === STABLE_ID_TYPE && entry.experimentName === experimentName

/** The unique names of the other groups (not the target group) that hold the Tester's ID, in response order. */
const findOtherGroupNames = (
  state: Partial<LayerOverridesResponse> | null | undefined,
  args: LayerStableIdOverrideArgs,
): string[] => [
  ...new Set(
    getEntries(state)
      .filter(
        (entry) => isSameBucket(entry, args) && entry.groupName !== args.groupName && holdsId(entry, args.stableId),
      )
      .map((entry) => entry.groupName),
  ),
]

/** True when the Tester's ID is in the target bucket: the target group, with the same environment, ID type, and experiment. */
const isInTargetGroup = (
  state: Partial<LayerOverridesResponse> | null | undefined,
  args: LayerStableIdOverrideArgs,
): boolean =>
  getEntries(state).some(
    (entry) => isSameBucket(entry, args) && entry.groupName === args.groupName && holdsId(entry, args.stableId),
  )

/**
 * Remove only the Tester's Stable ID from one group of one experiment in a layer.
 * It sends the single-ID DELETE. It never sends a body.
 * @returns The full override set of the layer (WL-053).
 */
export const removeStableIdFromLayerGroup = async (
  args: LayerStableIdOverrideArgs,
): Promise<LayerOverridesResponse> => {
  assertArgs(args)
  const { layerId, experimentName, groupName, stableId, environment } = args

  const path =
    `/layers/${encodeURIComponent(layerId)}/overrides/userID/${encodeURIComponent(stableId)}` +
    `?groupName=${encodeURIComponent(groupName)}` +
    `&experimentName=${encodeURIComponent(experimentName)}` +
    `&idType=${STABLE_ID_TYPE}` +
    `&environment=${encodeURIComponent(environment)}`

  try {
    const result = await api.url(path).delete().json<ApiResponse<LayerOverridesResponse>>()
    return result.data
  } catch (error) {
    throw new Error(handleApiError(error), { cause: error })
  }
}

/** One PATCH that adds only the Tester's ID to the target group. An API failure is wrapped once, with the original error as cause. */
const addStableIdToLayerGroup = async ({
  layerId,
  experimentName,
  groupName,
  stableId,
  environment,
}: LayerStableIdOverrideArgs): Promise<LayerOverridesResponse> => {
  try {
    const result = await api
      .url(`/layers/${encodeURIComponent(layerId)}/overrides`)
      .patch({
        conditionalOverrides: [],
        idOverrides: [{ environment, experimentName, groupName, idType: STABLE_ID_TYPE, ids: [stableId] }],
        op: 'add',
      })
      .json<ApiResponse<LayerOverridesResponse>>()
    return result.data
  } catch (error) {
    throw new Error(handleApiError(error), { cause: error })
  }
}

/** Remove the Tester's ID from each other group, one at a time. An error from a removal is already wrapped. */
const removeFromOtherGroups = async (
  afterPatch: LayerOverridesResponse,
  args: LayerStableIdOverrideArgs,
): Promise<LayerOverridesResponse> => {
  let current = afterPatch
  for (const otherGroupName of findOtherGroupNames(afterPatch, args)) {
    // oxlint-disable-next-line no-await-in-loop
    current = await removeStableIdFromLayerGroup({ ...args, groupName: otherGroupName })
  }
  return current
}

/**
 * Put the Tester's Stable ID into one group of one experiment in a layer (REQ-OVR-008).
 * One PATCH adds only this ID. Then the PATCH response is checked (WL-058). If the ID is not in the target bucket,
 * the handler throws before any DELETE, so the Tester is never left in no group. If the ID is still in another group
 * of the same experiment and environment, the single-ID DELETE removes it there (REQ-OVR-010).
 * No other ID is sent in any request (REQ-OVR-009).
 * @returns The full override set of the layer after the last request.
 */
export const forceStableIdIntoLayerGroup = async (args: LayerStableIdOverrideArgs): Promise<LayerOverridesResponse> => {
  assertArgs(args)

  const afterPatch = await addStableIdToLayerGroup(args)
  if (!isInTargetGroup(afterPatch, args)) {
    throw new Error(NOT_CONFIRMED_MESSAGE)
  }

  const current = await removeFromOtherGroups(afterPatch, args)
  if (!isInTargetGroup(current, args) || findOtherGroupNames(current, args).length > 0) {
    throw new Error(NOT_CONFIRMED_MESSAGE)
  }

  return current
}
