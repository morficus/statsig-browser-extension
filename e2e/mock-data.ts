import {
  makeExperimentOverride,
  makeExperimentOverridesResponse,
  makeUserIDOverride,
  mockAuditLogs,
  mockDynamicConfigs,
  mockExperiments,
  mockFeatureGates,
  paginated,
} from '@/src/tests/fixtures/statsig'

import type { MockRoute } from './mocks'

export {
  emptyGateOverride as emptyOverrides,
  makeFeatureGate,
  mockAuditLogs,
  mockDynamicConfigs,
  mockExperiments,
  mockFeatureGates,
  paginated,
  single,
} from '@/src/tests/fixtures/statsig'

/** Overrides of `mockExperiments[0]`: two ID overrides in different groups, one gate, one segment. */
export const mockExperimentOverrides = makeExperimentOverridesResponse({
  overrides: [
    makeExperimentOverride({ groupID: 'control', name: 'beta_gate', type: 'gate' }),
    makeExperimentOverride({ groupID: 'variant', name: 'beta_segment', type: 'segment' }),
  ],
  userIDOverrides: [
    makeUserIDOverride({ groupID: 'control', ids: ['qa_tester_1'] }),
    makeUserIDOverride({ groupID: 'variant', ids: ['qa_tester_2', 'qa_tester_3'] }),
  ],
})

export const defaultRoutes = (): MockRoute[] => [
  { data: paginated(mockFeatureGates), urlPattern: String.raw`/gates(\?|$)` },
  { data: paginated(mockExperiments), urlPattern: String.raw`/experiments(\?|$)` },
  { data: paginated(mockDynamicConfigs), urlPattern: String.raw`/dynamic_configs(\?|$)` },
  { data: paginated(mockAuditLogs), urlPattern: String.raw`/audit_logs(\?|$)` },
]
