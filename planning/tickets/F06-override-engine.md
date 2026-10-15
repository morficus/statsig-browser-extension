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
- **Proposed calls (WL-016):** add with `PATCH /experiments/{id}/overrides` or `PATCH /layers/{id}/overrides` (`op: "add"`), with a body holding only the Tester's ID and empty conditional arrays. Remove with the documented, idempotent single-ID deletes `DELETE …/overrides/userID/{userID}`. Never use the POST (replace) or bulk DELETE calls. The experiment shape uses `groupID` (the group **name**) and `unitType`. The layer shape uses `groupName`, `idType`, and `experimentName`.
- Statsig limits writes to about 1,800 per 15 minutes per project, so Clear all (F08-T2) must not flood the API.

## Tasks

### F06-T1: Force the Tester into a group (experiment not in a layer)

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F00-T1, F00-T3
- **Description:** A handler like `forceStableIdIntoGroup({ experimentId, groupName, stableId, environment })`. Use the call F00-T3 proved safe; WL-016 proposes `PATCH` with only this ID and `overrides: []`. If the ID is in another group for the same experiment and environment (found by a GET), remove it there with the single-ID DELETE first, so it ends up in one group only (REQ-OVR-010). Decide the order (remove then add, or add then remove) and log it. Removing first means a failure leaves the Tester in no group, never in two.
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
- **Description:** WL-007, WL-016. If the experiment's `layerID` isn't null, write the override at the layer level as Statsig requires (REQ-OVR-008): `PATCH /layers/{layerID}/overrides` with `{ op: "add", conditionalOverrides: [], idOverrides: [{ groupName, ids: [stableId], idType: "stableID", environment, experimentName }] }`, with the same safety rules as T1. Add `layerID` and `status` to the `Experiment` type, plus the layer override types.
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
- **Description:** A handler like `clearStableIdOverride(record)` that deletes only the Tester's Stable ID, through `DELETE /experiments/{id}/overrides/userID/{stableId}?groupID=…&unitType=stableID&environment=…` or `DELETE /layers/{layerID}/overrides/userID/{stableId}?groupName=…&experimentName=…&idType=stableID&environment=…` (WL-016). Both are documented as idempotent and touch one bucket only. Pass the exact environment from the record, because leaving it out targets the all-environments bucket. URL-encode the path and query values. If Q4 says to restrict the base modal, move its delete to this call too.
- **Acceptance criteria:**
  - [ ] Only the single-ID DELETE paths are used, with the record's group, ID type, and environment (unit tested)
  - [ ] A 200 for an ID that's already gone counts as success, and a 404 for a missing experiment or layer drops the record
- **Verification:** `pnpm vitest run src/handlers src/hooks`
- **Files likely touched:** `src/handlers/experiment-overrides.ts`, `src/handlers/layer-overrides.ts`, `src/hooks/use-overrides-section-logic.ts` (if Q4 says so)

### F06-T4: Override record

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** REQ-OVR-012, WL-008. A typed storage item for override records: `experimentId`, `experimentName`, `layerId?`, `groupName`, `environment`, `stableId`, and `createdAt`. The group name is the override key for both APIs (WL-016), so store it exactly as sent. Add pure helpers to add or replace (one record per experiment, Stable ID, and environment), remove, and list. Replace the unused `currentOverridesStorage` and update the reset in `use-settings-storage.ts`.
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
