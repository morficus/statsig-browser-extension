import type { Group, HealthCheck, Metric } from './common'

/** Console API experiment statuses (WL-016). Not started is `setup`. Running is `active`. */
type ExperimentStatus =
  | 'active'
  | 'setup'
  | 'decision_made'
  | 'abandoned'
  | 'archived'
  | 'experiment_stopped'
  | 'assignment_stopped'

export interface Experiment {
  allocation: number
  createdTime: number
  creatorName: string
  description: string
  endTime: number
  groups: Group[]
  healthChecks: HealthCheck[]
  hypothesis: string
  id: string
  lastModifiedTime: number
  name: string
  startTime: number
  status: ExperimentStatus
  tags: string[]
  targetingGateID?: string
  primaryMetrics?: Metric[]
  secondaryMetrics?: Metric[]
  defaultConfidenceInterval?: string
  bonferroniCorrection?: boolean
  duration?: number
  decisionReason?: string
  owner?: {
    ownerType: string
    ownerName: string
  }
  isStale?: boolean
  idType?: string
  /** The experiment's layer, or null when it isn't in one (WL-016). Layer overrides use it as the path id (WL-053). */
  layerID?: string | null
}

export interface ExperimentOverride {
  type: 'gate' | 'segment'
  name: string
  groupID: string
}

export interface UserIDOverride {
  ids: string[]
  groupID: string
  environment?: string | null
  unitType?: string | null
}

export interface ExperimentOverridesResponse {
  overrides: ExperimentOverride[]
  userIDOverrides: UserIDOverride[]
}

/** One ID override in a layer. The shape differs from experiments: `groupName`, `idType`, `experimentName` (WL-016). */
export interface LayerIDOverride {
  groupName: string
  ids: string[]
  idType?: string | null
  environment?: string | null
  experimentName?: string | null
}

export interface LayerOverridesResponse {
  /** The extension never reads or changes these. Writes always send `[]`. */
  conditionalOverrides: unknown[]
  idOverrides: LayerIDOverride[]
}
