# Work log

History of discoveries, decisions, risks, and resolved questions. **Append only:** add new entries at the bottom. Don't edit old entries. If an entry turns out to be wrong, add a new entry that corrects it and cites the old one.

**Entry types:** `Discovery` (a fact we learned) · `Decision` (a choice and its reason) · `Risk` (something that can go wrong) · `Resolved` (an open question that got an answer)

**Entry format:**

```markdown
### WL-NNN · YYYY-MM-DD · Type · Short title

**Tickets:** F06-T1, OPEN-004

What happened or what was learned. For a decision, give the options and why this one won.
Cite files as `path:line`.
```

---

### WL-001 · 2026-10-14 · Decision · Tracking structure

**Tickets:** all

Work is tracked in `planning/`. There is one ticket file per functionality, and each holds its tasks. `planning/README.md` has the board, what's next, and the open questions. This file is the history. Functionalities follow the spec's delivery order (§11): phase 0 (pre-build checks), then setup and hardening, Job 2, Job 1, Job 3, and release readiness.

### WL-002 · 2026-10-14 · Discovery · The repo is already the fork at the base commit

**Tickets:** F01

`origin` is `morficus/statsig-browser-extension` and `HEAD` is `97aa138`, the spec's base commit. REQ-SET-001 is already met. Most of the facts in spec §4.3 hold. The exceptions are in the entries below.

### WL-003 · 2026-10-14 · Discovery · Adding an experiment override replaces the whole list

**Tickets:** F00-T1, F00-T3, F06-T1 · OPEN-004

`use-overrides-section-logic.ts:44-64` reads the current overrides, merges the new ID in locally, and POSTs the **full** list to `/experiments/{id}/overrides`. So the base code treats POST as "replace". If two Testers write at about the same time, the second write deletes the first one's override. `docs/urls_experiments.md` lists a "partially update experiment overrides" endpoint, which is likely the safe way to add. F00-T1 must confirm the shape from the API reference, and F00-T3 must confirm the behavior.

### WL-004 · 2026-10-14 · Discovery · Deleting a row removes every ID in that group

**Tickets:** F06-T3 · Q4 · REQ-OVR-009

`use-overrides-section-logic.ts:78-86` sends `ids: toRemove.ids` to DELETE, which is every ID in that group and environment entry, not just one. The row also shows all IDs (`OverrideRow.tsx:40`). In the base modal, one delete can remove other Testers' overrides. The new "Clear" must send only the Tester's Stable ID. The base modal itself may conflict with REQ-OVR-009 (see Q4).

### WL-005 · 2026-10-14 · Discovery · The background script attaches the key to any URL

**Tickets:** F04-T1 · REQ-SEC-001, REQ-SEC-005

`entrypoints/background.ts` handles every `API_REQUEST` message by fetching `config.url` and adding the `STATSIG-API-KEY` header. It doesn't check the host. `API_BASE_URL` lives in `src/lib/fetcher.ts`, but nothing makes the background script use it.

### WL-006 · 2026-10-14 · Discovery · Both content scripts match `<all_urls>`

**Tickets:** F02-T2 · REQ-SET-009

The spec names only `entrypoints/statsig-detector.ts` (which runs in the MAIN world). `entrypoints/content.ts` (isolated world, `document_start`) also uses `matches: ['<all_urls>']`.

### WL-007 · 2026-10-14 · Discovery · No layer support in the base code

**Tickets:** F00-T1, F06-T2 · REQ-OVR-008

No source file mentions layers, and the `Experiment` type (`src/types/statsig/experiments.ts`) has no layer field. Layer-level overrides are new work. F00-T1 must find the field that links an experiment to its layer and the layer override endpoints.

### WL-008 · 2026-10-14 · Discovery · `currentOverridesStorage` is effectively unused

**Tickets:** F06-T4 · REQ-OVR-012

It's typed `{ name: string }[]`, and the only write is a reset to `[]` in `use-settings-storage.ts:24`. The override record in REQ-OVR-012 is new work. The old key can be migrated or replaced.

### WL-009 · 2026-10-14 · Discovery · The page reader doesn't cover Job 1 or the localStorage Stable ID

**Tickets:** F05-T1, F09-T1

`src/lib/get-user-details-injector.ts` gets the Stable ID only from the SDK instance (`getStableID`, `getContext().stableID`, `firstInstance`, `_stableID`, `identity`). It never reads `statsig.stable_id.*` from localStorage. Its cache reader (`readCachedPayloads`) parses `statsig.cached.evaluations.*`, but only to collect gate hashes and SDK keys for project matching. No code reads experiment or layer values, and nothing handles `sha256`.

### WL-010 · 2026-10-14 · Discovery · A project-match gate hides the popup tabs

**Tickets:** F07, F10 · Q5

`entrypoints/popup/App.tsx` renders `MainTabs` only when `usePageProject()` returns `matched`, meaning the page's SDK key belongs to a configured project or the site is pinned to one. Otherwise `PageProjectGate` asks for a key. The Intake flows have to work inside this gate or around it.

### WL-011 · 2026-10-14 · Discovery · The e2e tests fake the active-tab origin

**Tickets:** F02-T3, F07-T4, F08-T4, F10-T4

The e2e popups run as `chrome-extension://` pages. `e2e/mocks.ts:40` fakes the inspected tab's origin as `https://e2e-app.test`, and `mockApi` stubs `runtime.sendMessage` so no real Console API calls happen. Once the extension accepts only Intake Site URLs (REQ-SET-014), the e2e helpers must fake an Intake URL instead.

### WL-012 · 2026-10-14 · Discovery · Dependabot also auto-updates dependencies

**Tickets:** F03-T1 · Q3 · REQ-SET-011

The spec says to remove `renovate.json`. `.github/dependabot.yml` also opens weekly npm and GitHub Actions update PRs.

### WL-013 · 2026-10-14 · Discovery · Read-key mode is dead in the base code

**Tickets:** F04-T3 · Q7 · REQ-SEC-008

`apiKeyTypeStorage` supports `read-key`, and the override UIs check `typeApiKey === 'write-key'` (`OverridesSection.tsx:48`, `use-gate-overrides-logic.ts:86`). But nothing sets `read-key`, and `use-settings-storage.ts:14-18` resets any other value to `write-key`. Also, the type is one global value while keys are stored per project. REQ-SEC-008 needs a way to set the type, and probably a per-project type.

### WL-014 · 2026-10-14 · Discovery · The only write calls are the two override handlers

**Tickets:** F04-T2 · REQ-SEC-007

A grep for `poster`, `.post(`, `.delete(`, `.patch(`, and `.put(` finds write calls only in `src/handlers/experiment-overrides.ts` and `src/handlers/gate-overrides.ts`. This matches spec §4.3.

### WL-015 · 2026-10-14 · Risk · Screenshots: saving files and the popup's lifetime

**Tickets:** F11-T1

REQ-SET-010 allows only `storage`, `scripting`, `activeTab`, and the optional `debugger`. There's no `downloads` permission, so the background script can't save files by itself. A popup closes when it loses focus, and a three-preset full-page capture takes several seconds, so a capture driven by the popup may die halfway. F11-T1 must pick the design (for example, capture in the background and save from an extension page) before any capture code is written.

### WL-016 · 2026-10-14 · Discovery · Console API contract for overrides, layers, and experiments (F00-T1)

**Tickets:** F00-T1, F00-T3, F04-T2, F06, F07-T1, F08, F10-T2 · OPEN-004 · REQ-OVR-001, REQ-OVR-008, REQ-OVR-009, REQ-OVR-010, REQ-OVR-014

**Sources:** the API reference pages linked below and the official OpenAPI spec, `https://api.statsig.com/openapi/20240601.json` (version `20240601`, the only one). The docs don't state replace-or-add behavior in words. Where it says "suggests" below, the evidence is the endpoint name and the example payload. F00-T3 must confirm those points.

**Experiment overrides.** Path `id` is the experiment name.

| Call                                                                                                                                                   | Body or query                                       | Behavior                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`GET /experiments/{id}/overrides`](https://docs.statsig.com/api-reference/experiments/get-experiment-overrides)                                       | none                                                | Returns `{ overrides[], userIDOverrides[] }` under `data`.                                                                                                                                                                                                 |
| [`POST /experiments/{id}/overrides`](https://docs.statsig.com/api-reference/experiments/update-experiment-overrides) "Update"                          | `{ overrides[], userIDOverrides[] }`, both required | Suggests **replace** (example IDs are `updated_control_id_list`). The base code uses this (WL-003). **Don't use for forcing.**                                                                                                                             |
| [`PATCH /experiments/{id}/overrides`](https://docs.statsig.com/api-reference/experiments/partially-update-experiment-overrides) "Partially Update"     | same shape, both arrays required                    | Suggests **add** (example ID `newly_added_id`). Proposed call for forcing. Send `overrides: []`.                                                                                                                                                           |
| [`DELETE /experiments/{id}/overrides`](https://docs.statsig.com/api-reference/experiments/delete-experiment-overrides)                                 | **no request body in the docs or OpenAPI**          | Undocumented. The base code sends a body anyway (WL-004). **Don't use.**                                                                                                                                                                                   |
| [`DELETE /experiments/{id}/overrides/userID/{userID}`](https://docs.statsig.com/api-reference/experiments/delete-a-single-experiment-user-id-override) | query `groupID`*, `unitType`, `environment`         | **Documented:** removes one ID from one bucket. **Idempotent** (200 even if the ID isn't there). Other buckets stay. Returns the full override set. Leaving out `environment` targets the all-environments bucket, so pass the exact environment we wrote. |

- `userIDOverrides[]` items: `groupID`_, `ids[]`_, `environment` (nullable), `unitType` (nullable). **`groupID` is the group _name_** ("Control", "Test"; the single delete calls it "the experiment group name").
- Conditional overrides: the request body uses `id`, but the GET example uses `name`. The base `ExperimentOverride` type uses `name`. This doesn't matter as long as we always send `overrides: []`.

**Layer overrides.** Path `id` is the layer name. The shape differs from experiments: `groupName`, `idType`, `experimentName`.

| Call                                                                                                                                    | Body or query                                                        | Behavior                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`GET /layers/{id}/overrides`](https://docs.statsig.com/api-reference/layers/get-layer-overrides)                                       | none                                                                 | Returns `{ conditionalOverrides[], idOverrides[] }`.                   |
| [`POST /layers/{id}/overrides`](https://docs.statsig.com/api-reference/layers/update-layer-overrides) "Update"                          | `{ conditionalOverrides[], idOverrides[] }`                          | Suggests replace. **Don't use.**                                       |
| [`PATCH /layers/{id}/overrides`](https://docs.statsig.com/api-reference/layers/add-layer-overrides) "Add Layer Overrides"               | `{ op: "add", conditionalOverrides[], idOverrides[] }`, all required | Proposed call for forcing in a layer. Send `conditionalOverrides: []`. |
| [`DELETE /layers/{id}/overrides`](https://docs.statsig.com/api-reference/layers/delete-layer-overrides)                                 | no documented body                                                   | **Don't use.**                                                         |
| [`DELETE /layers/{id}/overrides/userID/{userID}`](https://docs.statsig.com/api-reference/layers/delete-a-single-layer-user-id-override) | query `groupName`_, `experimentName`_, `idType`, `environment`       | **Documented:** idempotent single-ID removal from one bucket.          |

- `idOverrides[]` items: `groupName`_, `ids[]`_, `idType`, `environment`, `experimentName` (all nullable).

**Experiments** ([get](https://docs.statsig.com/api-reference/experiments/get-experiment), [list](https://docs.statsig.com/api-reference/experiments/list-experiments)):

- **`layerID`** (nullable) is the experiment's layer (closes the question in WL-007). F00-T3 should confirm it works as the layer path `id`.
- `status` is one of `active`, `setup`, `decision_made`, `abandoned`, `archived`, `experiment_stopped`, `assignment_stopped`. **Not started = `setup`. Archived = `archived`.** Proposed: "running" (REQ-ASG-008) means `active`.
- `groups[]` has `name` and a nullable `id`.
- The list endpoint accepts `status` (a string or an array), `fields` (sparse fieldset, e.g. `id,name,status,groups,layerID,idType`), `ids` (up to 100), `limit` (default 10), and `page`. The docs don't say whether archived experiments are in the default list, so filter them out on our side too.

**Rate limits** ([Console API overview](https://docs.statsig.com/console-api/introduction)):

- Mutations (POST, PATCH, PUT, DELETE) share a quota of about 1,800 _attempts_ per 15 minutes per project, across all keys. There's also burst protection.
- Over either limit, the API returns `429`, and rejected attempts count toward the quota. Back off with jitter and keep retries few.
- So Clear all (F08-T2) must run one call at a time, with no immediate retries.

**Errors.** The OpenAPI spec lists only `200`/`401`/`404` (and `400` for the single deletes, when the required query is missing). `403` isn't documented per endpoint, and `429` appears only in the overview. F00-T5 should record the real `403`.

**What this means:**

1. **Force (REQ-OVR-006, REQ-OVR-010).**
   - Find the Tester's ID in other groups from a GET.
   - Remove it there with the single-ID DELETE.
   - Add it with PATCH: a body holding only `{ groupID, ids: [stableId], unitType: "stableID", environment }`.
   - Removing first means a failure leaves the Tester in no group, never in two. Decide in F06-T1.
2. **Clear (REQ-OVR-014).** Use only the single-ID DELETE, which is safe for REQ-OVR-009 by contract. The record must store the exact group name, environment, and ID type.
3. **Write allowlist (F04-T2).**
   - Ours: `PATCH /experiments/{id}/overrides`, `DELETE /experiments/{id}/overrides/userID/{userID}`, `PATCH /layers/{id}/overrides`, `DELETE /layers/{id}/overrides/userID/{userID}`.
   - Plus the base gate calls (REQ-GAT-001).
   - Plus the base experiment-modal calls (POST and bulk DELETE), depending on Q4.

### WL-017 · 2026-10-14 · Risk · The 401 response body may echo the Console Key

**Tickets:** F04-T4, F06-T5, F00-T5 · REQ-SEC-003, REQ-SEC-004

The documented `401` message is `"This endpoint only accepts an active CONSOLE key, but an invalid key was sent. Key: console-xxxXXXxxxXXXxxx"`. If the real API puts the full key there, any code that shows or logs the raw error body leaks it. `handleApiError` already maps 401 to a fixed message (`src/lib/utils.ts:15-19`). But F04-T4 must check that no other path (wretch `error.message`, `console.*`, the background error) passes the raw body through. F00-T5 should record what a real 401 says. The base mapper also doesn't handle `429` or network errors (F06-T5).

### WL-018 · 2026-10-14 · Discovery · The `STATSIG-API-VERSION` header is optional for now, but will become required

**Tickets:** F04-T1

The Console API overview says to send `STATSIG-API-VERSION: 20240601`, and that it "becomes required in the future". The base code never sends it. Add it in the single API module (F04-T1), so the change sits in one place (REQ-SEC-005).

### WL-019 · 2026-10-14 · Decision · F01 starts before the phase 0 checkpoint

**Tickets:** F01, Q2

Maurice asked to start F01 while F00-T2 to F00-T5 wait for the manual checks. F01 (rename, Chrome only, new signing key) uses no phase 0 result, so starting it early puts nothing at risk. Spec §11 orders the phases; this is a deliberate exception for F01 only. Q2 stays open for F02 to F04.

### WL-020 · 2026-10-14 · Decision · F01 scope, copy, and boundaries

**Tickets:** F01-T1, F01-T2, F01-T3, F03-T3, F12-T1 · REQ-SET-003 to REQ-SET-006

**Name and copy (F01-T1).**

- The manifest `name` and `action.default_title`, the popup `<title>`, and the header use "Intake Experiment Testing". The `package.json` name is `intake-experiment-testing`.
- The manifest and `package.json` description is "Spot-test Statsig experiments on the Intake Site: see your groups, force yourself into a group, and take screenshots." It is 117 characters, under Chrome's 132 limit.
- `keywords` don't change. They name the service and the category, not the product.
- The header's Statsig logo becomes a text wordmark, "Intake Experiment Testing". The version badge stays. A Statsig logo as the brand makes the extension look like a Statsig product (REQ-SET-004).
- The `[Statsig Extension]` log prefix becomes `[Intake Experiment Testing]`.

**Firefox removal (F01-T2).** This removes Firefox from the build, the scripts, `.releaserc.json`, and the Firefox steps in `submit.yml`. The workflow itself stays until Q6 decides it (F03-T3). In `README.md`, `CONTRIBUTING.md`, and the GitHub templates, only the Firefox content goes. The rebrand of those docs is F12-T1. `web/` is out of scope (F03-T3). The package rename changes the WXT zip file names, so explicit zip names in release docs change with it.

**Not in F01.** The `homepage`, `bugs`, and `repository` URLs in `package.json` still point to the upstream repository. F03-T3 can fix them along with the CI review.

**Private key (F01-T3).** The key pair is generated outside the repository, in the Claude session scratchpad. Maurice moves the private key to a password manager. `*.pem` is ignored.

**How the work runs.** The three tasks run in parallel. T1 and T2 each run in their own git worktree, and T3 runs in the main tree. Each task edits a different part of `wxt.config.ts`, so the merges stay clean. Briefs: `.agents/plans/f01-t*.md`.

### WL-021 · 2026-10-14 · Discovery · New Chrome signing key and extension ID (F01-T3)

**Tickets:** F01-T3 · REQ-SET-006

The new 2048-bit RSA key pair replaces the base key in `CRX_PUBLIC_KEY` (`wxt.config.ts`). The new extension ID is **`gaeiajloopaabgiminphfojiefoiggpc`**. It was computed from the public key, and Chromium loading `.output/chrome-mv3` (a Playwright script) reports the same ID. The e2e suite passes with the new key (62 tests).

The private key (PKCS#8 PEM, mode 600) is outside the repository, at `/private/tmp/claude-501/-Users-maurice-Dev-Workspace-talkiatry-statsig-browser-extension/c22fe54b-4f5b-4e11-83e9-d7394987bb63/scratchpad/f01-signing-key/intake-experiment-testing.pem`. `/private/tmp` is cleared on reboot, so Maurice must move the key to a password manager. `*.pem` is in `.gitignore`. No `.pem` file is in the tree or in the git history.

### WL-022 · 2026-10-14 · Discovery · Firefox removal results and leftovers (F01-T2)

**Tickets:** F01-T2, F03-T3, Q6 · REQ-SET-004, REQ-SET-005

`wxt.config.ts` now has a plain `manifest` object with an unconditional `key`, and no `browser_specific_settings`. The built manifest has no `gecko` and no `@statsig.com`. The Firefox scripts, the `.dev-profile-ff` profile, the Firefox release asset in `.releaserc.json`, and the Firefox steps in `submit.yml` are gone. `zip:chrome` produces only the Chrome zip, with no sources zip.

The Opus review found that `submit.yml`'s `publish_chrome` input was dead after the change: set to `false`, it ran bpp with an empty key set. The input was removed, so the workflow now always submits Chrome. The workflow can no longer drop a `firefox` entry from the `SUBMIT_KEYS` secret. If that secret still has one, bpp will try an AMO submit. F03-T3 should check this if the workflow stays (Q6).

Left for F03-T3, because these aren't about Firefox:

- `.github/ISSUE_TEMPLATE/bug-report.yml` lists Safari.
- `docs/publishing.md` has the `### GitHub Token` heading twice.
- `docs/publishing.md` says `submit.yml` runs on `release`, but it runs on `push: tags: v*`.

### WL-023 · 2026-10-14 · Risk · Flaky e2e test: "adds a second project, activates it and keeps its client keys"

**Tickets:** F03, REQ-NFR-002

`e2e/projects.e2e.ts:63` fails at random. The UI shows "2 client keys", but the test reads `chrome.storage.local` at once and sometimes gets `clientKeys: []`. The async write hasn't landed yet (`e2e/projects.e2e.ts:78-80`). This is older than F01: at `cf78d22` (before F01) it failed 2 of 12 runs. On the F01 branch it failed 1 of 8 isolated runs and once in each of two full runs, where the other 61 tests passed. The likely fix is to wait for storage with `expect.poll` instead of reading it once. Not fixed in F01.

### WL-024 · 2026-10-14 · Discovery · Local tooling: pnpm 12 switch fails, and agent worktrees leak into lint and tests

**Tickets:** F03-T2

1. `package.json` pins `packageManager: pnpm@12.11.2`. On Maurice's machine the global pnpm (10.x) tries to switch to it and fails with `ENOEXEC`. The downloaded 12.11.2 bin is a shebang-less placeholder, because its install script never ran. `node ~/Library/pnpm/.tools/pnpm/12.11.2/node_modules/pnpm/bin/pnpm.mjs` works. This session used a scratchpad shim that runs it. A lasting fix is a proper pnpm 12 install (for example `npm i -g pnpm@12.11.2`, or Corepack).
2. Claude Code agent worktrees live in `.claude/worktrees/` inside the repo, and that folder isn't gitignored. While they exist, plain `pnpm lint` and `pnpm test` pick up their copies and fail. Run the checks with `--ignore-pattern '.claude/**'` (oxlint) and `--exclude '.claude/**'` (vitest), or ignore `.claude/worktrees/` in `.gitignore`. F03-T2 should record this in `CLAUDE.md`.

### WL-025 · 2026-10-15 · Resolved · pnpm 12 is installed globally

**Tickets:** F03-T2 · corrects WL-024 item 1

Maurice installed pnpm 12. `pnpm` now resolves through proto (`~/.proto/shims/pnpm`) to 12.11.2 and runs without a shim, and `pnpm type-check` passes. Item 1 of WL-024 no longer applies. Item 2 (agent worktrees leaking into lint and tests) still stands.

### WL-026 · 2026-10-15 · Decision · F02 starts before the phase 0 checkpoint

**Tickets:** F02, Q2

Maurice asked to start F02 while F00-T2 to F00-T5 wait for the manual checks. F02 uses no phase 0 result: REQ-SET-007 fixes the Intake Site URLs, and OPEN-003 is closed. Like WL-019, this is a deliberate exception to spec §11, for F02 only. Q2 stays open for F03 and F04.

### WL-027 · 2026-10-15 · Decision · F02 design: one pattern constant, a derived matcher, one tab guard

**Tickets:** F02-T1, F02-T2, F02-T3, F05, F09, F11 · REQ-SET-007 to REQ-SET-009, REQ-SET-014

- **One constant.** `INTAKE_SITE_MATCHES` in `src/lib/intake-site.ts` holds the two patterns. `wxt.config.ts` (`host_permissions`) and both content scripts (`matches`) import it. The module has no imports, because WXT loads `wxt.config.ts` in Node.
- **Derived runtime check.** `isIntakeSiteUrl(url)` doesn't hard-code hostnames. It runs the pattern strings through a small Chrome match-pattern matcher (`matchesUrlPattern`): `http`/`https` scheme, an exact or `*.` host, and `*` path globs matched against `pathname + search`. If the product owner widens the constant, the manifest and the runtime check widen together. Two choices are deliberate. A URL with an explicit non-default port never matches, which is stricter than Chrome, because the check is a security guard. `/assessments` does match, the same as Chrome's glob. The matcher uses `URL.parse` (Chrome 126+, Node 22+; the repo needs Node 24 or later).
- **One tab guard.** Page reads get their tab from a new `getActiveIntakeTab()` in `src/lib/tabs.ts`, which returns the active tab only if its URL is an Intake Site URL. `getUserDetails` checks again just before `scripting.executeScript`. F05 and F09 add more page readers and must use the same guard.
- **Popup off-site.** The popup shows its own "Not an Intake Site page" panel before the project gate. It doesn't reuse a `PageProjectGate` state, because that panel offers to pin the current site to a project. The panel lists the pages it accepts, derived from `INTAKE_SITE_MATCHES`, so the copy follows the constant.
- **E2E.** The fake active tab becomes `https://app.staging.talkiatry.com/assessment` (was `https://e2e-app.test/`, WL-011).

### WL-028 · 2026-10-15 · Risk · Content scripts don't load on client-side navigation into `/assessment`

**Tickets:** F02-T2, F00-T4, F05, F09 · REQ-SET-009

Chrome injects declared content scripts only when a document loads at a matching URL. Suppose the Intake Site is a single-page app that reaches `/assessment` from another path on the same origin through the History API, for example from `/login`. Then `entrypoints/content.ts` is not in the page until it reloads. Today this costs nothing. `entrypoints/statsig-detector.ts` isn't registered in the manifest (WL-029), so the `postMessage` path in `content.ts` never gets a user anyway. `scripting.executeScript` is the only detection that works, and it still works after client-side navigation, because the guard checks the tab's current URL (WL-027). The risk becomes real if F05 or F09 bring back the content-script path. Check in F00-T4 on the real Intake Site whether `/assessment` loads as a full document. If it doesn't, F05 and F09 read only through `executeScript`, or the product owner widens the patterns (REQ-SET-008).

### WL-029 · 2026-10-15 · Discovery · Manifest narrowed; `statsig-detector` isn't a registered content script; `activeTab` looks redundant for now (F02-T2, F02-T4)

**Tickets:** F02-T2, F02-T4, F05, F09, F11, F12-T2 · REQ-SET-007, REQ-SET-009, REQ-SET-010, REQ-SET-013

- **Built manifest.** `host_permissions` is exactly `https://statsigapi.net/*`, `https://app.talkiatry.com/assessment*`, and `https://app.staging.talkiatry.com/assessment*`. `permissions` is `storage`, `scripting`, `activeTab`. The only `content_scripts` entry (`content.js`) matches the two Intake patterns. No key holds `<all_urls>`, and there is no `web_accessible_resources` or `externally_connectable`. `src/tests/unit/manifest.test.ts` guards the config, and the two content-script tests guard `matches`.
- **`statsig-detector` isn't registered.** WXT registers only `entrypoints/content.ts` and `*.content.ts` as content scripts. `entrypoints/statsig-detector.ts` builds as an unlisted script (`statsig-detector.js`) that nothing injects, so its `matches` has no effect. `docs/project-key-detection.md:132` already notes this. Its `matches` now holds the Intake patterns anyway, so it stays correct if F05 or F09 register it.
- **`activeTab` looks redundant until F11.** The Intake host permissions already let the popup read the tab URL and run `executeScript` on Intake tabs. On other tabs, `activeTab` only exposes the URL, and the guard treats a missing URL as "not Intake" anyway. It stays, because the ticket keeps it, REQ-SET-010 allows it, and F11's `tabs.captureVisibleTab` will need it. F11 or F12-T2 should recheck the justification.
- **Permissions doc.** `docs/permissions-justification.md` now has one justification per permission and per host pattern. It no longer mentions `<all_urls>` or `storage-helper.js`. The Storage section lists what `src/lib/storage.ts` really stores. The doc gets its final pass in F12-T2.
