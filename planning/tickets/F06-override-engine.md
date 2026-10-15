# F06: Override engine

| Field      | Value                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Status     | Todo                                                                                               |
| Phase      | 2: Job 2                                                                                           |
| Spec       | REQ-OVR-006, REQ-OVR-008, REQ-OVR-009 (critical), REQ-OVR-010, REQ-OVR-012, REQ-OVR-016 · OPEN-004 |
| Depends on | F00-T1, F00-T3, F04-T1, F04-T2                                                                     |
| Blocks     | F07, F08                                                                                           |

## Goal

Handlers and storage with no UI. They put the Tester's Stable ID into exactly one group of one experiment or layer, take it out again, and record what was done, **without changing any other ID's override**.

## Notes

- The base add is a read-modify-write that POSTs the full list (WL-003). The base delete sends every ID in the row (WL-004). Neither is safe enough for REQ-OVR-009 as written. The design here must follow what F00-T1 and F00-T3 confirm.
- Statsig limits writes to about 1,800 per 15 minutes per project, so Clear all (F08-T2) must not flood the API.

## Tasks

### F06-T1: Force the Tester into a group (experiment not in a layer)

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F00-T1, F00-T3
- **Description:** A handler like `forceStableIdIntoGroup({ experimentId, groupId, stableId, environment })`. Use the call F00-T3 proved safe (most likely a partial update with only this ID). If the ID is in another group for the same experiment and environment, move it so it ends up in one group only (REQ-OVR-010).
- **Acceptance criteria:**
  - [ ] Unit tests: the request body has only the Tester's ID, and other IDs in a mocked current state are untouched
  - [ ] Unit tests: moving from group A to group B leaves the ID in B only
  - [ ] ID type `stableID`, environment as passed in
- **Verification:** `pnpm vitest run src/handlers`
- **Files likely touched:** `src/handlers/experiment-overrides.ts`, `src/handlers/experiment-overrides.test.ts`, `src/types/statsig/experiments.ts`

### F06-T2: Layer-level overrides

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F06-T1, F00-T1
- **Description:** WL-007. Read the experiment's layer field (F00-T1). If the experiment is in a layer, write the override at the layer level as Statsig requires (REQ-OVR-008), with the same safety rules as T1. Add the layer fields to the types.
- **Acceptance criteria:**
  - [ ] An experiment in a layer goes to the layer endpoint, and one that isn't goes to the experiment endpoint (unit tested)
  - [ ] The same "only my ID" tests as T1, for layers
- **Verification:** `pnpm vitest run src/handlers`; T-OVR-2 on staging in F07
- **Files likely touched:** `src/handlers/layer-overrides.ts` (new), its tests, `src/types/statsig/experiments.ts`

### F06-T3: Clear the Tester's override (only their ID)

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F06-T1, F06-T2, Q4
- **Description:** A handler like `clearStableIdOverride(record)` that deletes only the Tester's Stable ID at the experiment or layer level. It must be idempotent: clearing an override that's already gone counts as success. If Q4 says to restrict the base modal, apply the same fix to its delete.
- **Acceptance criteria:**
  - [ ] The DELETE body has only the Tester's ID (unit tested against a row with several IDs)
  - [ ] Treats "not found" as success
- **Verification:** `pnpm vitest run src/handlers src/hooks`
- **Files likely touched:** `src/handlers/experiment-overrides.ts`, `src/handlers/layer-overrides.ts`, `src/hooks/use-overrides-section-logic.ts` (if Q4 says so)

### F06-T4: Override record

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** REQ-OVR-012, WL-008. A typed storage item for override records: `experimentId`, `experimentName`, `layerId?`, `groupId`, `groupName`, `environment`, `stableId`, and `createdAt`. Add pure helpers to add or replace (one record per experiment, Stable ID, and environment), remove, and list. Replace the unused `currentOverridesStorage` and update the reset in `use-settings-storage.ts`.
- **Acceptance criteria:**
  - [ ] Unit tests for add, replace (forcing a second group replaces the record), remove, and the reset
  - [ ] Stored only in `browser.storage.local`
- **Verification:** `pnpm vitest run src/lib`
- **Files likely touched:** `src/lib/storage.ts`, `src/lib/override-record.ts` (new), its test, `src/hooks/use-settings-storage.ts`

### F06-T5: Specific error messages for write failures

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** REQ-OVR-016. Map 401 (key not valid), 403 (key not allowed), 429 (rate limit), and a network failure to specific messages, plus a generic fallback. Extend `handleApiError` or add a typed mapper next to it. Check that the background script's network-error path reaches the mapper as a distinct case.
- **Acceptance criteria:**
  - [ ] Unit tests for each of the 4 cases and the fallback
  - [ ] T-OVR-5: an invalid key shows "key not valid"
- **Verification:** `pnpm vitest run src/lib/utils.test.ts`
- **Files likely touched:** `src/lib/utils.ts`, `src/lib/utils.test.ts`, maybe `src/lib/fetcher.ts`
