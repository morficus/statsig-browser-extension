# F02: Intake Site scoping

| Field      | Value                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| Status     | Done                                                                                   |
| Phase      | 1: Setup & hardening                                                                   |
| Spec       | REQ-SET-007, REQ-SET-008, REQ-SET-009, REQ-SET-010, REQ-SET-013, REQ-SET-014 · T-SET-1 |
| Depends on | None                                                                                   |
| Blocks     | F05, F09, F11 (all use the Intake URL check)                                           |

## Goal

The extension can reach only `statsigapi.net` and the two Intake Site patterns. Those patterns are defined once.

## Tasks

### F02-T1: Intake Site URL config module

- **Status:** Done (See WL-027)
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** Add one module (for example `src/lib/intake-site.ts`) that exports the match patterns (`https://app.talkiatry.com/assessment*`, `https://app.staging.talkiatry.com/assessment*`) and an `isIntakeSiteUrl(url)` helper. `wxt.config.ts` imports it too, so the module must have no runtime dependencies.
- **Acceptance criteria:**
  - [x] The patterns are defined once and used everywhere else (REQ-SET-008)
  - [x] Unit tests cover production, staging, subpaths, query strings, other hosts, `http:`, and invalid URLs
- **Verification:** `pnpm vitest run src/lib/intake-site.test.ts`
- **Files likely touched:** `src/lib/intake-site.ts` (new), `src/lib/intake-site.test.ts` (new)

### F02-T2: Narrow the manifest and the content-script matches

- **Status:** Done (See WL-029)
- **Owner:** Claude
- **Size:** S
- **Depends on:** F02-T1
- **Description:** Set `host_permissions` to `https://statsigapi.net/*` plus the Intake patterns. Set `matches` in **both** `entrypoints/content.ts` and `entrypoints/statsig-detector.ts` to the Intake patterns (WL-006). Keep `permissions` as `storage`, `scripting`, `activeTab`.
- **Acceptance criteria:**
  - [x] The built manifest has no `<all_urls>` anywhere
  - [x] `host_permissions` has exactly 3 entries
- **Verification:** `pnpm build:chrome` and read the manifest. Update `src/tests/unit/content.test.ts` and `statsig-detector.test.ts` if they assert `matches`.
- **Files likely touched:** `wxt.config.ts`, `entrypoints/content.ts`, `entrypoints/statsig-detector.ts`

### F02-T3: Refuse to read SDK state outside the Intake Site

- **Status:** Done (See WL-031)
- **Owner:** Claude
- **Size:** M
- **Depends on:** F02-T1
- **Description:** REQ-SET-014. `activeTab` grants access to any tab the user clicks on, so check the tab URL before every `scripting.executeScript` call and message to the page. On other sites, return a clear "not an Intake Site" state. Change the e2e helpers to fake an Intake URL instead of `https://e2e-app.test` (WL-011).
- **Acceptance criteria:**
  - [x] No `executeScript` call runs when the active tab isn't an Intake URL (unit tested)
  - [x] The popup shows one clear message on other sites
  - [x] The existing e2e tests pass with the new fake origin
- **Verification:** `pnpm vitest run src/handlers src/hooks`; `pnpm test:e2e`
- **Files likely touched:** `src/handlers/get-user-details.ts`, `src/hooks/use-detected-statsig-keys.ts`, `src/lib/tabs.ts`, `e2e/mocks.ts`, tests

### F02-T4: Update the permissions doc

- **Status:** Done (See WL-029)
- **Owner:** Claude
- **Size:** XS
- **Depends on:** F02-T2
- **Description:** Rewrite `docs/permissions-justification.md` to match the new manifest. Remove the `<all_urls>` reasoning and the stale `storage-helper.js` references. The doc gets a final pass in F12-T2, after `debugger` is added.
- **Acceptance criteria:**
  - [x] Each manifest permission and host pattern has exactly one justification, and nothing else is listed
- **Verification:** Compare the doc line by line with the built manifest.
- **Files likely touched:** `docs/permissions-justification.md`
