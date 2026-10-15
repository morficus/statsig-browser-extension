# F07: "Force me into this group" UI

| Field      | Value                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | Todo                                                                                                                                                  |
| Phase      | 2: Job 2                                                                                                                                              |
| Spec       | REQ-OVR-001, REQ-OVR-002, REQ-OVR-003, REQ-OVR-007, REQ-OVR-011, REQ-OVR-016, REQ-SEC-008 · T-OVR-1, T-OVR-2, T-OVR-3, T-OVR-5, T-OVR-6 · REQ-NFR-004 |
| Depends on | F05, F06, F04-T3, Q1, Q5                                                                                                                              |
| Blocks     | F10-T1 (override mark)                                                                                                                                |

## Goal

From the popup, a Tester finds an experiment, picks a group, and lands in it after the page reloads, without opening the Statsig Console.

## Tasks

### F07-T1: Experiment list for forcing

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** Q1, F00-T1 (status values)
- **Description:** A list of experiments from the Console API that includes unstarted experiments (`status: setup`) and leaves out archived ones (`status: archived`), filtered on our side as well (WL-016) (REQ-OVR-001), with search by name (REQ-OVR-002). Think about `fields=id,name,status,groups,layerID,idType` to keep the payload small. Reuse `useExperiments` (pagination) and the existing Fuse search. Q1 decides where it lives.
- **Acceptance criteria:**
  - [ ] Archived experiments are left out, and unstarted ones are included (unit tested)
  - [ ] Search by name works with all pages loaded
- **Verification:** `pnpm vitest run src/components src/hooks`
- **Files likely touched:** `src/hooks/use-experiments.ts`, `src/components/` (new or `ExperimentsTable.tsx`), `src/components/layout/MainTabs.tsx`

### F07-T2: Group actions and environment picker

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F07-T1, F05-T1, F06-T1, F06-T2, F06-T5
- **Description:** Each experiment shows its groups, and each group has "Force me into this group" (REQ-OVR-003). The environment defaults to the SDK tier, or `production` if there isn't one, and the Tester can change it (REQ-OVR-007). Disable the action with a reason for read keys (F04-T3). Show a result message for every write (REQ-OVR-016). Mark the Tester's current forced group.
- **Acceptance criteria:**
  - [ ] Picks the right handler for experiments in a layer and not in a layer
  - [ ] The environment defaults are unit tested
  - [ ] Disabled, with the reason shown, for a read key
- **Verification:** Component tests with mocked handlers
- **Files likely touched:** new components under `src/components/`, a hook for the force action

### F07-T3: Record and reload after a successful force

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F07-T2, F06-T4
- **Description:** On success, write the override record (F06-T4) and reload the active Intake Site tab (REQ-OVR-011). Reload only Intake tabs (F02-T1 check). Invalidate the overrides queries.
- **Acceptance criteria:**
  - [ ] A successful force records it and reloads the tab, and a failed one does neither (unit tested)
- **Verification:** `pnpm vitest run src/hooks`
- **Files likely touched:** the force-action hook, `src/lib/tabs.ts`

### F07-T4: E2E tests for the force flow

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F07-T3, F02-T3 (e2e fake origin)
- **Description:** REQ-NFR-004. Playwright with a mocked Console API: force a group (not in a layer), force a group in a layer, switch groups, a 401 error message, and manual Stable ID entry. Assert the recorded API calls carry only the Tester's ID.
- **Acceptance criteria:**
  - [ ] The flows above pass in `pnpm test:e2e`
- **Verification:** `pnpm test:e2e`
- **Files likely touched:** `e2e/force-group.e2e.ts` (new), `e2e/mock-data.ts`, `e2e/mocks.ts`
