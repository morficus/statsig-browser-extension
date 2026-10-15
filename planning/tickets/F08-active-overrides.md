# F08: Active overrides and badge

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | Todo                                                                       |
| Phase      | 2: Job 2                                                                   |
| Spec       | REQ-OVR-013, REQ-OVR-014, REQ-OVR-015, REQ-OVR-017 · REQ-GAT-003 · T-OVR-4 |
| Depends on | F06-T3, F06-T4, F07-T3                                                     |
| Blocks     | None                                                                       |

## Goal

Overrides don't expire, so the Tester always sees what they've forced, can clear it, and has a badge as a reminder.

## Tasks

### F08-T1: Active overrides list with a check on open

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F06-T4
- **Description:** List the override records (REQ-OVR-013). When the list opens, check each record against the Console API, and drop the records whose override is gone. Show that overrides don't expire and must be cleared by hand (REQ-OVR-017). State that gate overrides and overrides set in the Console aren't listed (REQ-GAT-003, spec §9).
- **Acceptance criteria:**
  - [ ] Stale records are removed on open (unit tested with mocked API responses)
  - [ ] The "no expiry" notice shows
  - [ ] The check doesn't send a request per record when one request per experiment or layer is enough
- **Verification:** `pnpm vitest run src/hooks src/components`
- **Files likely touched:** new component and hook, `src/lib/override-record.ts`

### F08-T2: Clear and Clear all

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F08-T1, F06-T3, F04-T3
- **Description:** "Clear" on each item, plus "Clear all" (REQ-OVR-014). Each one deletes the override (F06-T3), removes the record, then reloads the active Intake tab once. Clear all runs the deletes one after another, and on a partial failure it reports which ones failed and keeps their records. Disabled with a reason for read keys.
- **Acceptance criteria:**
  - [ ] T-OVR-4: the override is gone, the tab reloads, and the count goes down
  - [ ] Partial failures are unit tested
- **Verification:** `pnpm vitest run src/hooks src/components`
- **Files likely touched:** the active-overrides component and hook

### F08-T3: Badge count

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F06-T4
- **Description:** REQ-OVR-015. The background script watches the record storage item and sets the action badge to the count, or empty text at zero. Also set it on startup and install.
- **Acceptance criteria:**
  - [ ] Unit tests: count 0 gives an empty badge, and N gives "N"; storage changes update the badge
- **Verification:** `pnpm vitest run src/tests/unit/background.test.ts`
- **Files likely touched:** `entrypoints/background.ts`, `src/tests/unit/background.test.ts`

### F08-T4: E2E tests for clear and the badge

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F08-T2, F08-T3
- **Description:** Playwright with a mocked API: seed two records, open the list (one is stale, so it's dropped), clear one, clear all. Assert the DELETE bodies carry only the Tester's ID.
- **Acceptance criteria:**
  - [ ] The flows above pass in `pnpm test:e2e`
- **Verification:** `pnpm test:e2e`
- **Files likely touched:** `e2e/active-overrides.e2e.ts` (new), `e2e/mock-data.ts`
