/** One override that the Tester set with this extension (REQ-OVR-012). */
export interface OverrideRecord {
  /** The experiment path id. For a layer write it is also the `experimentName` (WL-059). */
  experimentId: string
  /** The experiment display name. */
  experimentName: string
  /** Set only when the override was written at the layer level. */
  layerId?: string
  /** Exactly as sent. The override key for both APIs (WL-016). */
  groupName: string
  environment: string
  stableId: string
  /** When the override was set, in epoch milliseconds. */
  createdAt: number
}

/** One record per experiment, Stable ID, and environment. */
export type OverrideRecordKey = Pick<OverrideRecord, 'environment' | 'experimentId' | 'stableId'>

/** True when both keys point at the same experiment, Stable ID, and environment. Case-sensitive. */
export const isSameOverrideTarget = (left: OverrideRecordKey, right: OverrideRecordKey): boolean =>
  left.experimentId === right.experimentId && left.stableId === right.stableId && left.environment === right.environment

/**
 * Add a record, or replace the record for the same target at the same index.
 * If older data holds more than one record for the target, the first is replaced and the others are dropped.
 */
export const upsertOverrideRecord = (records: readonly OverrideRecord[], record: OverrideRecord): OverrideRecord[] => {
  const result: OverrideRecord[] = []
  let replaced = false

  for (const existing of records) {
    if (!isSameOverrideTarget(existing, record)) {
      result.push(existing)
    } else if (!replaced) {
      result.push(record)
      replaced = true
    }
  }

  if (!replaced) {
    result.push(record)
  }

  return result
}

/** Remove every record for the target. */
export const removeOverrideRecord = (records: readonly OverrideRecord[], key: OverrideRecordKey): OverrideRecord[] =>
  records.filter((record) => !isSameOverrideTarget(record, key))

/** Newest first. Records with the same `createdAt` keep their stored order. */
export const listOverrideRecords = (records: readonly OverrideRecord[]): OverrideRecord[] =>
  records.toSorted((first, second) => second.createdAt - first.createdAt)
