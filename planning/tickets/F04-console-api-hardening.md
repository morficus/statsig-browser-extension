# F04: Console API hardening

| Field      | Value                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| Status     | Done                                                                          |
| Phase      | 1: Setup & hardening                                                          |
| Spec       | REQ-SEC-001 to REQ-SEC-010 · REQ-GAT-002 · T-SEC-1, T-SEC-2, T-SEC-3, T-GAT-1 |
| Depends on | None                                                                          |
| Blocks     | F06 (the write path), F07 and F08 (write gating)                              |

## Goal

The Console Key can only reach `statsigapi.net`, only the allowed write calls can be made, and a read-only key disables every write action with a stated reason.

## Tasks

### F04-T1: One API module with a host allowlist

- **Status:** Done (`6e255cf`)
- **Owner:** Claude
- **Size:** M
- **Depends on:** None
- **Description:** WL-005. Make the background script reject any `API_REQUEST` whose URL doesn't start with the single base URL constant, and attach the key only after that check. Also send `STATSIG-API-VERSION: 20240601` from this module (WL-018). Share the constant from one module so a later move to a proxy changes only that module (REQ-SEC-005). Today the constant is in `src/lib/fetcher.ts`, which also imports the settings store, so the background script may need the constant split into its own file.
- **Acceptance criteria:**
  - [x] A request to any other host fails, and the key isn't sent (unit tested)
  - [x] There's exactly one definition of the base URL (`grep statsigapi.net src entrypoints` finds one constant)
- **Verification:** `pnpm vitest run src/tests/unit/background.test.ts src/lib/fetcher.test.ts`
- **Files likely touched:** `entrypoints/background.ts`, `src/lib/fetcher.ts`, `src/lib/api-config.ts` (new), tests

### F04-T2: Allowlist the write calls

- **Status:** Done (`5335e4d`). Also refuses requests from content scripts and writes with a read key (WL-040)
- **Owner:** Claude
- **Size:** S
- **Depends on:** F04-T1, F00-T1 (the layer override paths)
- **Description:** REQ-SEC-007. In the same module, refuse any non-GET request whose method and path aren't on the list (WL-016):
  - `PATCH /experiments/{id}/overrides` and `DELETE /experiments/{id}/overrides/userID/{userID}`
  - `PATCH /layers/{id}/overrides` and `DELETE /layers/{id}/overrides/userID/{userID}`
  - the base gate override calls (`POST` and `DELETE /gates/{id}/overrides`)
  - the base experiment-modal calls (`POST` and bulk `DELETE /experiments/{id}/overrides`), unless Q4 removes them

  Today only the two override handlers write (WL-014). The allowlist keeps it that way.

- **Acceptance criteria:**
  - [x] Unit tests: allowed write paths pass; another POST, DELETE, or PATCH path is refused before any network call
  - [x] The gate override tests still pass (REQ-GAT-004)
- **Verification:** `pnpm vitest run src/tests/unit/background.test.ts src/handlers`
- **Files likely touched:** `entrypoints/background.ts` or `src/lib/api-config.ts`, tests

### F04-T3: Make read-key mode work, and disable writes with a reason

- **Status:** Done (`6370c8a`). See WL-042
- **Owner:** Claude
- **Size:** M
- **Depends on:** Q7 (resolved: the Tester picks the type per project, WL-040)
- **Description:** WL-013: nothing sets `read-key`, and `use-settings-storage.ts` forces `write-key`. Let the key type be set (per Q7: chosen when the key is added, or detected), stored per project if possible. Add one shared helper (for example `useWriteAccess()` returning `{ canWrite, reason }`) that the gate and experiment UIs, and later F07 and F08, all use.
- **Acceptance criteria:**
  - [x] With a read key, every write action is disabled and shows the reason (T-SEC-2)
  - [x] Gate override behavior with a write key is unchanged (REQ-GAT-001)
  - [x] Unit tests for the helper and for the removed forced reset
- **Verification:** `pnpm vitest run src/hooks src/components`; manual T-SEC-2
- **Files likely touched:** `src/lib/storage.ts`, `src/hooks/use-settings-storage.ts`, `src/hooks/use-write-access.ts` (new), `src/components/modals/manage-experiment/OverridesSection.tsx`, `src/hooks/use-gate-overrides-logic.ts`

### F04-T4: Audit key handling, remote code, and telemetry

- **Status:** Done (`fb187a4`, `cee1114`; saved-key preview and form errors in `6370c8a`). See WL-041
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** Check REQ-SEC-002, 003, 004, 006, and 009 and fix any gap. The key lives only in `browser.storage.local`. It never goes to page storage, cookies, the DOM, or `console.*`, including error messages that echo headers. Saved keys show only their first characters. There's no `eval` or `new Function` (enable the oxlint rules if they're off). There are no analytics calls, and fonts are bundled (`@fontsource`).
- **Acceptance criteria:**
  - [x] The audit results, with grep evidence, are in a `WORKLOG.md` entry
  - [x] Any gap found is fixed and tested
  - [x] oxlint blocks `eval` and `new Function`
- **Verification:** `pnpm lint`; the greps in the WL entry
- **Files likely touched:** `oxlint.config.ts`, `src/components/sheets/settings/StatsigKeysSettings.tsx`, maybe `src/lib/tabs.ts` (logs)

### F04-T5: Personal Console Key guidance in the UI

- **Status:** Done (`b086d7a`)
- **Owner:** Claude
- **Size:** XS
- **Depends on:** None
- **Description:** REQ-SEC-010. Where a key is entered (the login form, Settings, the add-project form), tell the Tester to use their own Personal Console Key and not a shared project key. The README part is in F12-T1.
- **Acceptance criteria:**
  - [x] The guidance shows on every key entry form
- **Verification:** `pnpm vitest run src/tests/unit/AuthForm.test.tsx`; manual check
- **Files likely touched:** `src/components/modals/AuthForm.tsx`, `src/components/sheets/settings/AddProjectForm.tsx`
