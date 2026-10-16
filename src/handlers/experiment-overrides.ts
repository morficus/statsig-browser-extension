import type { ExperimentOverridesResponse, UserIDOverride } from '@/src/types/statsig'

import { api, poster } from '@/src/lib/fetcher'
import { handleApiError } from '@/src/lib/utils'

interface UpdateExperimentOverridesArgs {
  experimentId: string
  overrides: ExperimentOverridesResponse
}

interface DeleteExperimentOverridesArgs {
  experimentId: string
  overrides: Partial<ExperimentOverridesResponse>
}

interface ApiResponse<DataType> {
  data: DataType
  message?: string
}

const STABLE_ID_UNIT_TYPE = 'stableID'

export interface ExperimentStableIdOverrideArgs {
  /** The experiment path id (WL-016 calls it the experiment name). */
  experimentId: string
  /** The group name. The API field is `groupID` (WL-016). */
  groupName: string
  stableId: string
  /** The exact environment, for example "staging". */
  environment: string
}

export const updateExperimentOverrides = async ({
  experimentId,
  overrides,
}: UpdateExperimentOverridesArgs): Promise<ExperimentOverridesResponse> => {
  try {
    const result = await poster<ApiResponse<ExperimentOverridesResponse>>(
      `/experiments/${experimentId}/overrides`,
      overrides,
    )
    return result.data
  } catch (error) {
    throw new Error(handleApiError(error), { cause: error })
  }
}

export const deleteExperimentOverrides = async ({
  experimentId,
  overrides,
}: DeleteExperimentOverridesArgs): Promise<ExperimentOverridesResponse> => {
  try {
    const result = await api
      .url(`/experiments/${experimentId}/overrides`)
      .json(overrides)
      .delete()
      .json<ApiResponse<ExperimentOverridesResponse>>()
    return result.data
  } catch (error) {
    throw new Error(handleApiError(error), { cause: error })
  }
}

const NOT_CONFIRMED_MESSAGE = 'Statsig did not confirm the override. Try again.'

const assertStableIdOverrideArgs = ({
  environment,
  experimentId,
  groupName,
  stableId,
}: ExperimentStableIdOverrideArgs): void => {
  const fields: unknown[] = [experimentId, groupName, stableId, environment]
  if (fields.some((value) => typeof value !== 'string' || value === '')) {
    throw new Error('An experiment, a group, a Stable ID, and an environment are needed.')
  }
}

/** True for an entry in the Tester's bucket: the exact environment and the `stableID` unit type. */
const isStableIdBucket = (entry: UserIDOverride, environment: string): boolean =>
  entry.environment === environment && entry.unitType === STABLE_ID_UNIT_TYPE

/**
 * The groups that hold the Tester's ID in the Tester's bucket, once each, in response order.
 * A missing `data`, a missing or non-array `userIDOverrides`, and an entry without an `ids` array count as no IDs.
 */
const getStableIdGroupNames = (
  response: ExperimentOverridesResponse | undefined,
  { environment, stableId }: ExperimentStableIdOverrideArgs,
): string[] => {
  const userIDOverrides: UserIDOverride[] = Array.isArray(response?.userIDOverrides) ? response.userIDOverrides : []
  const entries = userIDOverrides.filter(
    (entry) => isStableIdBucket(entry, environment) && Array.isArray(entry.ids) && entry.ids.includes(stableId),
  )
  return [...new Set(entries.map((entry) => entry.groupID))]
}

export const removeStableIdFromExperimentGroup = async (
  args: ExperimentStableIdOverrideArgs,
): Promise<ExperimentOverridesResponse> => {
  assertStableIdOverrideArgs(args)
  const { environment, experimentId, groupName, stableId } = args
  const path =
    `/experiments/${encodeURIComponent(experimentId)}/overrides/userID/${encodeURIComponent(stableId)}` +
    `?groupID=${encodeURIComponent(groupName)}&unitType=${STABLE_ID_UNIT_TYPE}&environment=${encodeURIComponent(environment)}`
  try {
    const result = await api.url(path).delete().json<ApiResponse<ExperimentOverridesResponse>>()
    return result.data
  } catch (error) {
    throw new Error(handleApiError(error), { cause: error })
  }
}

const addStableIdToExperimentGroup = async ({
  environment,
  experimentId,
  groupName,
  stableId,
}: ExperimentStableIdOverrideArgs): Promise<ExperimentOverridesResponse> => {
  try {
    const result = await api
      .url(`/experiments/${encodeURIComponent(experimentId)}/overrides`)
      .patch({
        overrides: [],
        userIDOverrides: [{ environment, groupID: groupName, ids: [stableId], unitType: STABLE_ID_UNIT_TYPE }],
      })
      .json<ApiResponse<ExperimentOverridesResponse>>()
    return result.data
  } catch (error) {
    throw new Error(handleApiError(error), { cause: error })
  }
}

/** The PATCH moves the ID by itself (WL-053). This clean-up is a fallback: one single-ID DELETE at a time. */
const removeStableIdFromOtherGroups = async (
  args: ExperimentStableIdOverrideArgs,
  patched: ExperimentOverridesResponse,
): Promise<ExperimentOverridesResponse> => {
  let current = patched
  const otherGroupNames = getStableIdGroupNames(patched, args).filter((groupName) => groupName !== args.groupName)
  for (const otherGroupName of otherGroupNames) {
    // oxlint-disable-next-line no-await-in-loop
    current = await removeStableIdFromExperimentGroup({ ...args, groupName: otherGroupName })
  }
  return current
}

export const forceStableIdIntoExperimentGroup = async (
  args: ExperimentStableIdOverrideArgs,
): Promise<ExperimentOverridesResponse> => {
  assertStableIdOverrideArgs(args)
  const patched = await addStableIdToExperimentGroup(args)
  // Confirm before any clean-up. If the PATCH did not place the ID, a DELETE would leave the Tester in no group (WL-058).
  if (!getStableIdGroupNames(patched, args).includes(args.groupName)) {
    throw new Error(NOT_CONFIRMED_MESSAGE)
  }
  const current = await removeStableIdFromOtherGroups(args, patched)
  const finalGroupNames = getStableIdGroupNames(current, args)
  if (finalGroupNames.length !== 1 || finalGroupNames[0] !== args.groupName) {
    throw new Error(NOT_CONFIRMED_MESSAGE)
  }
  return current
}
