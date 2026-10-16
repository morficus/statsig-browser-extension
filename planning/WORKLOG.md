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

### WL-030 · 2026-10-15 · Discovery · Review of F02-T1, F02-T2, F02-T4: no guard bypass; Storage list corrected

**Tickets:** F02-T1, F02-T2, F02-T4 · corrects WL-029 (Permissions doc)

An Opus review probed `isIntakeSiteUrl` with userinfo tricks, IDN and punycode look-alikes, full-width and ideographic dots, percent-encoding, `..` segments, backslashes, whitespace, `blob:`, `filesystem:`, and `view-source:`. It found no URL that passes the guard without being an Intake Site assessment URL. Every trick either normalizes to the real Intake URL or is rejected. The path check is a policy, not a security boundary: every page on `app.talkiatry.com` shares the origin of `/assessment`. Scheme, host, and port are the real boundary, and they match exactly.

- **Trailing dot.** `https://app.talkiatry.com./assessment` is rejected, which is stricter than Chrome. Like the port rule in WL-027, it fails closed.
- **Doc fix.** WL-029 said the Storage section lists what `src/lib/storage.ts` stores. But `storage.ts` isn't the only store: `src/store/use-ui-preferences-store.ts` persists the UI preferences, and each project holds its own Console API key, client SDK keys, and gate hashes (`src/lib/projects.ts:4-14`). The doc now lists both.
- **Follow-ups (brief `f02-review-fixes`).** Replace `URL.parse` with `new URL()` inside `try`, because `URL.parse` throws on Chrome before 126. Add the bypass probes as regression tests. Add `e2e/manifest.e2e.ts`, which checks the **built** manifest against an allow-list. The unit tests check only the WXT config and the two named entrypoints, so a new `*.content.ts` with `<all_urls>` would pass them.
- **Merge gate.** The doc's claim that the extension reads only Intake pages becomes true with F02-T3. Don't merge the branch without it.

### WL-031 · 2026-10-15 · Discovery · F02-T3 results, and two guard follow-ups for F05

**Tickets:** F02-T3, F05-T1, F05-T2, F09-T1 · REQ-SET-014 · T-SET-1

- **Guard coverage.** Every `scripting.executeScript` call (`src/handlers/get-user-details.ts`) and every `tabs.sendMessage` call (`fetchUser` and `retryDetection` in `src/hooks/use-detected-user.ts`) gets its tab from `getActiveIntakeTab()`. `getUserDetails` checks the URL again before it injects. An Opus review traced every page-access call site and found every one covered except the listener in item 2 below.
- **Popup off-site.** The body shows `NotIntakeSitePanel`. The header hides `ProjectStatus` and the "User Details" item unless the tab is an Intake page. The review found that the header contradicted the body: on a non-assessment page of a pinned origin (for example `/login`), origin pinning showed "Project 1 · this page". The login modal still opens off-site when no key is stored, because `src/hooks/use-app-initialization.ts:17-19` depends only on the stored key.
- **Tests.** The e2e fake tab is `https://app.staging.talkiatry.com/assessment`, and `mockApi(page, routes, { activeTabUrl })` can override it. The detection specs use Intake URLs. `e2e/intake-site.e2e.ts` covers the off-site panel, including the same-origin `/login` case. Final run: 734 unit tests and 69 e2e tests pass, with no `act()` warnings.
- **T-SET-1 passes.** The built manifest has only `statsigapi.net` and the Intake patterns in `host_permissions` (WL-029), the new key, and no `statsig.com` ID (WL-021). `e2e/manifest.e2e.ts` guards it.

Two review findings are deferred to F05, which touches the same code first:

1. **The second check doesn't catch a stale URL (F05-T1).** `getUserDetails` re-checks the same `tabs.query` snapshot. If the tab moves to another path on the same origin between that check and `executeScript`, the script runs in the new document. The origin is the same, the window is milliseconds, and the path check is policy, not the security boundary (WL-030). Fix it in the injector: have `getUserDetailsFromPage` also return `location.href`, and drop the result unless `isIntakeSiteUrl(href)`.
2. **The `runtime.onMessage` listener in `use-detected-user.ts` doesn't check the sender (F05-T2).** It accepts `STATSIG_USER_FOUND` and `STATSIG_DETECTED_BUT_ERROR` from any sender. This is dormant while `statsig-detector` isn't registered (WL-029). If F05 revives that path, accept messages only when `sender.tab.id` is the active Intake tab and `isIntakeSiteUrl(sender.tab.url)`.

### WL-033 · 2026-10-15 · Decision · F03 starts before the phase 0 checkpoint

**Tickets:** F03, Q2

Maurice asked to start F03 while F00-T2 to F00-T5 wait for the manual checks. F03 (no automatic updates, `CLAUDE.md`, CI, the flaky e2e test, and the worktree leak) uses no phase 0 result, so starting it early puts nothing at risk. As with F01 (WL-019), this exception covers F03 only. Q2 stays open for F02 and F04.

### WL-034 · 2026-10-15 · Decision · Q3: remove Dependabot

**Tickets:** F03-T1 · Q3 · REQ-SET-011 · resolves WL-012

Remove `.github/dependabot.yml` along with `renovate.json`. Spec §9 says the fork takes no automatic updates, and Dependabot does the same job as Renovate. Dependabot security alerts are a repository setting, not this file, so this change doesn't affect them.

### WL-035 · 2026-10-15 · Decision · Q6: CI keeps only the checks; publishing and the `web/` site go

**Tickets:** F03-T3 · Q6 · spec §2.1, §2.2

The fork (`morficus/statsig-browser-extension`) is public, and Actions are enabled on it. Testers load the extension unpacked (§2.1), and there is no store listing (§2.2). Maurice agreed to these changes:

- **`build.yml`: keep and adapt.** It runs on pull requests, on pushes to `main`, and on manual dispatch. It adds `pnpm type-check` and `pnpm format:check`, so CI runs the same checks as the definition of done. It drops the Codecov upload and the coverage flag. It keeps the Chrome zip artifact and the e2e job. Its token gets `contents: read` only.
- **`release.yml`, `.releaserc.json`, and the semantic-release dev dependencies: remove.** On every push to `main`, semantic-release pushed a version commit and a tag, and published a public GitHub release. Version bumps are now manual edits to `package.json`.
- **`submit.yml`: remove.** It publishes to the Chrome Web Store, which is out of scope. It ran on every `v*` tag and needed the `SUBMIT_KEYS` secret, which the fork doesn't have.
- **`pages.yml` and `web/`: remove.** The site is the Statsig-branded landing page and privacy policy for the store listing. GitHub Pages is off on the fork.
- **Codecov, SonarCloud (`sonar-project.properties`, `.sonarcloud.properties`), and `.github/release-drafter.yml`: remove.** Codecov and SonarCloud point at the upstream owner's accounts. No workflow uses release-drafter.
- **Docs:** delete `docs/publishing.md`, and remove the badges and links for the removed services from `README.md`, `CONTRIBUTING.md`, and `docs/architecture.md`. F12-T1 still owns the README rewrite, including its install steps.
- **`new-feature-spec.md`:** `oxfmt` pads its tables. That is whitespace only, and it lets the new `format:check` step pass.

### WL-036 · 2026-10-15 · Resolved · Only vitest picked up the agent worktrees (F03-T5)

**Tickets:** F03-T5 · corrects WL-024 item 2

A test file planted in `.claude/worktrees/zz-plant/` held a failing test, a lint error, a type error, and bad formatting. Only `pnpm vitest run` reported it. `oxlint.config.ts` already ignores `.claude`, and oxfmt, knip, and tsc skipped the plant. So WL-024 item 2 was right about vitest and wrong about lint. F03-T5 adds `.claude/worktrees/` to `.gitignore`, and adds `.claude/**` to the vitest `test.exclude` and `coverage.exclude` lists. With the plant in place, all five commands pass. `.claude/skills` is a symlink, and it stays tracked.

### WL-037 · 2026-10-15 · Discovery · What else changed when semantic-release and Codecov went (F03-T3)

**Tickets:** F03-T3 · WL-035

The code review of F03-T3 found these consequences, and F03-T3 fixes them:

- **`braces` is no longer installed.** Removing the 4 semantic-release dev dependencies removed 214 packages from `pnpm-lock.yaml`, `braces` 3.0.3 among them. No other package was added or changed. `CONTRIBUTING.md` listed `braces` as a security exception that "comes through release tooling". That bullet is deleted, and `node-forge` 1.4.0 is now the only exception.
- **The commit types no longer trigger releases.** `CONTRIBUTING.md` no longer says that `feat`, `fix`, and breaking changes make MINOR, PATCH, and MAJOR releases.
- **Runs on `main` are never cancelled.** `build.yml` cancels a superseded run only on pull requests (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`). So each commit on `main` keeps its own check status and zip artifact.
- **Coverage is opt-in.** `vitest.config.ts` turned coverage on when `CI` was set, only for the Codecov upload. That switch is gone. `pnpm vitest run --coverage` still works, and CI runs about 20% faster. `actionlint` passes on `build.yml`.

### WL-038 · 2026-10-15 · Resolved · The e2e tests wait for storage instead of reading it once (F03-T4)

**Tickets:** F03-T4 · resolves WL-023

Before the fix, "adds a second project, activates it and keeps its client keys" failed 1 of 20 runs. A new helper, `pollExtensionLocalValue` in `e2e/extension-runtime.ts`, wraps `expect.poll` around the storage read. All 8 storage reads that follow a UI write now use it, in `projects.e2e.ts`, `logout.e2e.ts`, and `settings.e2e.ts`. Each assertion keeps its matcher and its value. After the fix, the test passed 20 of 20 runs, and the full suite passed 62 of 62.

The code review found one more gap. In "switching back to another project" and "removes a project", the final value is the same as the value from before the add, so a poll could pass on stale data. Each test now first waits until the add is in storage.

**Risk, not fixed:** `e2e/error-handling.e2e.ts:105` and `e2e/login-flow.e2e.ts:42` read the mock's list of requests once, right after a click. No check shows the request has gone out by then. They have not been seen to fail. If they flake, use the same `expect.poll` pattern.

### WL-039 · 2026-10-15 · Discovery · `pnpm dev:chrome` failed on a fresh checkout (F03-T2)

**Tickets:** F03-T2

The F03-T2 check "every command runs as written" found that `pnpm dev:chrome` stopped with `ENOENT: open '.dev-profile/chrome-out.log'`. chrome-launcher 1.2.0 opens its log file in the profile folder before it creates the folder (`dist/chrome-launcher.js:151` and `:167`). `web-ext.config.ts` sets `chromiumProfile: '.dev-profile'`, which is gitignored, so only machines that already had the folder could run dev. `web-ext.config.ts` now creates the folder when it loads. The dev browser also opened `https://cloud.qdrant.io`, which the upstream author left in. It now opens the staging Intake Site (`https://app.staging.talkiatry.com/assessment`, spec §3). After `rm -rf .dev-profile`, `pnpm dev:chrome` opens Chrome.

The new `CLAUDE.md` gives the commands, the definition of done, the CI summary, and 10 hard rules with REQ IDs. Each rule was checked against the spec text. Each command in it was run once: all pass, including `pnpm test:e2e` (62 passed).

### WL-040 · 2026-10-15 · Resolved · CI passes on the fork without upstream secrets (F03-T3)

**Tickets:** F03-T3

`main` was pushed to the fork at `44e2829`. The push did not start a CI run. GitHub listed `build.yml` as active, but the fork had no runs after 3 minutes. A manual dispatch (`gh workflow run build.yml --ref main`) started run 38769230604. Both jobs passed: `build` in 1m11s, and `e2e` in 2m50s with 69 passed. No step needs a secret.

The run found one defect that the upstream workflow also has. The zip artifact step uploaded nothing. `actions/upload-artifact` skips hidden paths by default, and `.output/` starts with a dot. The step now sets `include-hidden-files: true`, and `if-no-files-found: error` so that a missing zip fails the run. The next run on `main` must show the `<sha>-prod-build` artifact.

The Playwright report step also found no files. This is correct on a green run. CI uses the `github` reporter, which writes no HTML report, and `test-results/` gets files only when a test fails.

**Open:** check that the next push to `main` starts a run. If it does not, enable workflows on the fork's Actions tab.

### WL-041 · 2026-10-15 · Resolved · A push to `main` starts CI, and the zip artifact uploads (F03-T3)

**Tickets:** F03-T3 · resolves the open item in WL-040

The push of `d21730b` to `main` started run 38776914845 by itself. No change on the fork's Actions tab was needed. The first push (WL-040) probably started no run because the fork had no registered workflows until that push. Both jobs passed, and the e2e job passed 69 tests. The run has the `d21730b…-prod-build` artifact (472 kB), so the `include-hidden-files` fix works.

### WL-042 · 2026-10-15 · Decision · F04 starts before phase 0; interim Q4 allowlist; Q7 key type per project

**Tickets:** F04-T1 to F04-T5, F06-T3, F07 · Q2, Q4, Q7 · REQ-SEC-007, REQ-SEC-008, REQ-SEC-010

Maurice decided the following.

- **Q2, for F04 only.** F04 starts while F00-T2 to F00-T5 wait, like F01 (WL-019). F04-T2 uses the paths from the docs (WL-016). If F00-T3 finds different paths, the allowlist is edited in one place. Q2 stays open for F02 and F03.
- **Q4, interim.** The write allowlist keeps the base experiment-modal calls (`POST` and bulk `DELETE /experiments/{id}/overrides`) for now, so the base modal works as before. When Q4 is decided (F06-T3, F07), removing them is a one-line allowlist edit. Q4 stays open.
- **Q7 resolved.** The Tester picks the key type when adding a key, and can change it later on the project. The type is stored on each project. Projects saved before this change count as `write-key`, the base behavior. Auto-detection was rejected: the Console API has no documented way to read a key's permissions, and a probe write is not acceptable.
- **Copy.**
  - Every key entry form (REQ-SEC-010): "Use your own Personal Console Key, not a shared project key."
  - Reason shown when writes are disabled (REQ-SEC-008): "Read-only key. Add a key with write access to change overrides."
  - Key type options: "Read & write" and "Read only".
- **Renumbered twice.** F04's entries collided with F02 and F03 entries on `main`, so they moved. Old F04 citations map like this: WL-026 or WL-040 → WL-042; WL-027 or WL-041 → WL-043; WL-028 or WL-042 → WL-044; WL-043 → WL-045; WL-044 → WL-046. Commit messages from before the final merge use the old numbers.
- **Defense in depth.** The background script also refuses every non-GET request while the active key type is `read-key`. The UI gating comes first.

### WL-043 · 2026-10-15 · Discovery · Key handling, remote code, and telemetry audit (F04-T4)

**Tickets:** F04-T4, F04-T3 · REQ-SEC-002, REQ-SEC-003, REQ-SEC-004, REQ-SEC-006, REQ-SEC-009 · WL-017

Audited at `e409c45`. The greps ran over `src`, `entrypoints`, `public`, `wxt.config.ts`, and the built `.output/chrome-mv3`.

- **REQ-SEC-002: pass.** The key is stored only in `local:statsig-console-api-key` and `local:statsig-projects` (`src/lib/storage.ts:9,13`). The built content script and detector contain no storage code and no key strings (`grep -rn 'statsig-console-api-key\|statsig-projects' .output/chrome-mv3`).
- **REQ-SEC-003: gaps found and fixed.**
  - Gap: wretch 3 uses the raw response body as `error.message`. `handleApiError` (`src/lib/utils.ts`) returned the body or `error.message` for any status other than 401, 403, 404, and 5xx, and for native errors. `initialLogin` showed that on screen and logged the raw error. A `401` that echoes `Key: console-...` (WL-017) could reach the screen or the console.
  - Fix: `handleApiError` now redacts every `console-[\w-]+` token to `console-…`, and every `console.*` call that logged a raw caught error now logs `handleApiError(error)` instead: `initial-login.ts`, `get-unit-id-types.ts`, `use-detected-user.ts`, `use-wxt-storage.ts`, `tabs.ts` (`fb187a4`, `cee1114`).
  - We chose redaction over fixed messages, so the API's useful 400, 409, 422, and 429 messages still show.
  - Page storage, cookies, the page DOM, and content-script messages carry no key. The only page `localStorage` access reads the page's own user object (`src/lib/get-user-details-injector.ts`).
  - Not fixed, low risk: three logs in `src/store/use-settings-store.ts` (persist, read external, initialize) log raw `browser.storage` errors. Those errors don't echo stored values.
  - Residual: hooks throw `new Error(handleApiError(error), { cause: error })`, so `cause` keeps the raw error. Nothing logs it today. React Query doesn't use `throwOnError`, so `ErrorBoundary` never receives a query error. Enabling `throwOnError` would change that.
- **REQ-SEC-004: gap, fixed in F04-T3.** `ProjectRow.tsx` showed the first 14 characters of a saved key (6 past `console-`). It now shows 12. The login and add-project forms also map mutation errors through `handleApiError`.
- **REQ-SEC-006: pass.** The source has no `eval`, `new Function`, string timers, remote `import()`, remote `<script src>`, or remote `@import`. The manifest has no `content_security_policy`, so the MV3 default applies. The only built hit is `Function('')` inside zod's eval-support probe (a dependency, in a try/catch). oxlint now errors on `no-eval`, `no-implied-eval`, and `no-new-func`. A probe file proved all three fire. Before this, only `no-eval` was on.
- **REQ-SEC-009: pass.** No analytics or telemetry names appear in the source, `pnpm-lock.yaml`, or the build (`gtag`, `segment`, `sentry`, `posthog`, `mixpanel`, `amplitude`, `datadog`, `hotjar`, `sendBeacon`, and others). The only `fetch(` is in `entrypoints/background.ts`. Fonts are bundled from `@fontsource/inter` (`entrypoints/popup/main.tsx`), and the build has no CDN or Google Fonts URLs.
- **Not in scope, noted.** The key inputs are plain text, not `type="password"`.

Grep scripts and raw output: the agent scratch folder `.agents/scratch/f04-t4-audit/` (`greps.sh`, `greps2.sh`, `audit.md`), which is gitignored.

### WL-044 · 2026-10-15 · Decision · How read-key mode looks and behaves (F04-T3)

**Tickets:** F04-T3, F07, F08 · REQ-SEC-008, REQ-GAT-001, REQ-GAT-002 · WL-013, WL-042

- **Storage.** `StatsigProject.apiKeyType` is optional (`src/lib/projects.ts`). Missing means `write-key`, so projects saved before F04-T3 keep the base behavior. The settings store writes the active project's type to `local:api_key_type` whenever it writes the active key (`src/store/use-settings-store.ts`). With no active project, it writes `write-key`. The background script reads that item to refuse writes (F04-T2). The forced reset in `use-settings-storage.ts` is gone.
- **Picking the type.** The login form, the add-project form, and each project row have a `Key type` select ("Read & write" first, the default; then "Read only"). Adding a key that already belongs to a project activates that project and keeps its stored type, as before.
- **Gating.** `useWriteAccess()` (`src/hooks/use-write-access.ts`) returns `{ canWrite, reason }`. While storage loads, it returns `canWrite: false` with no reason, so the reason doesn't flash. F07 and F08 must use it.
  - With a read key, the gate and experiment override sections show the reason once at the top.
  - Every write control is rendered but disabled: Add Manual, PASS and FAIL, the group select and Override, and every delete button, including the gate and segment rows.
  - The add forms can't be opened.
  - The environment select stays enabled, because it's a local choice, not a write.
  - `BaseOverrideContextCard` no longer takes `canEdit`.
- **Tests.** Unit tests cover the hook, the sync, the forms, the project row, and both sections. `e2e/key-type.e2e.ts` covers T-SEC-2: a read-only project disables the gate override controls, and switching to read and write enables them. `e2e/settings.e2e.ts` now finds the theme select by its section, because the new selects broke its `first()` pick.
- **Copy conflict, open.** The login form's intro still says to log in with a "**Read Only** Statsig Console API Key". That contradicts Job 2, which needs a key with write access. The copy wasn't changed in F04 and needs a decision (Q8).

### WL-045 · 2026-10-15 · Discovery · Opus review of F04: no serious bugs; five fixes, three items left

**Tickets:** F04-T1 to F04-T5, F06, F07 · REQ-SEC-001, REQ-SEC-003, REQ-SEC-007, REQ-SEC-008

The review of `e409c45..6370c8a` found no way for the key to reach another host or leave from a content script. It found no non-allowlisted write and no write control reachable with a read key.

Fixed in `06231a1`:

- The background script forwards only `Accept`, `Content-Type`, `STATSIG-API-KEY`, and `STATSIG-API-VERSION` from the caller. A header like `X-HTTP-Method-Override` can no longer change what an allowlisted call does.
- It sends the upper-cased method that the allowlist checked. Before, `patch` went on the wire in lowercase, because Fetch doesn't normalize `PATCH`.
- Re-adding a key that already belongs to a project now applies the chosen key type. Without a type argument, the stored type is kept.
- `ErrorBoundary` logs `handleApiError(error)` and the component stack, so an error `cause` that holds a raw API body can't reach the console.
- The gate delete button has the accessible name "Delete override", and the tests use it.

Left as is, on purpose:

- **Key and type are two storage writes.** `persist` writes the key and then the type, and the popup also attaches the key itself (`src/lib/fetcher.ts`). A write sent in the instant between switching to a read-only project and the type write would pass the client check. Statsig rejects writes from a read-only key anyway, so the client check is UX plus defense in depth. A fix (one storage item, or `setItems`/`getItems`, and dropping the popup-side attach) touches the project-transition logic. Revisit with F06 if needed.
- **ID path segments aren't restricted.** `{id}` and `{userID}` match any non-empty segment, including `%2F`. Restricting them to `[\w.-]+` could reject real user IDs. Only extension pages can send requests, so abusing this needs XSS in the popup.
- **Disabled flash.** While storage loads, `useWriteAccess` returns `canWrite: false`. Write-key users can see controls disabled for a moment when the popup opens. This only affects looks.

### WL-046 · 2026-10-15 · Resolved · Q8: login form intro copy

**Tickets:** F04-T5, F12-T1 · Q8 · REQ-SEC-010 · WL-044

Maurice decided that the login form should ask for a Console API key and send Testers who don't know how to create one to engineering. The intro (`src/components/modals/AuthForm.tsx`) now reads: "Before you can use this extension, log in with a **Statsig Console API Key**. If you don't know how to create one, reach out to someone from engineering for help."

The old "Read Only" wording is gone. So is the link to Project Settings → Keys & Environments: those steps describe project keys, and Testers should use a Personal Console Key. The guidance line under the input stays. The README part is F12-T1.

### WL-047 · 2026-10-15 · Decision · How phase 0 runs: one check script, a git-ignored key file, test objects only

**Tickets:** F00-T2, F00-T3, F00-T4, F00-T5 · OPEN-001, OPEN-004, OPEN-007 · REQ-OVR-009, REQ-SEC-003 · WL-016, WL-017

Maurice decided on these points:

- **One script.** `planning/phase0/f00-check.sh` runs the API checks, with one subcommand per step. Each step prints the request and the response, and checks the result itself (`PASS`, `FAIL`, or `OBSERVE`). It uses only the WL-016 calls: GET, `PATCH …/overrides` with one ID, and the single-ID `DELETE`. It never uses `POST …/overrides` or the bulk `DELETE`. Maurice runs it, and Claude records the results from its output.
- **The key goes in a file, not in Keychain.** It's in `planning/phase0/.env`. `.gitignore` already ignores `.env*`. The file isn't at the repo root, so WXT doesn't load it. The script refuses a key file that git doesn't ignore. It keeps the key out of the curl arguments, and it replaces the key with `<redacted>` in all output.
- **Test objects only.** The script writes only to experiments whose name starts with `intake_ext_phase0_` and whose status is `setup`. Maurice creates the test experiment, the test layer, and one gate override in the Console UI. A wrong result from F00-T3 can't touch a real experiment.
- **Order:** T4 first (a read-only snapshot that gives the Stable ID and the environment tier), then T3, then T2, then T5. T2 reuses the state that T3 leaves: Maurice's ID in `Test` on an experiment that isn't started. A second T4 snapshot then shows whether the SDK serves it.
- **The SDK snippet** (`planning/phase0/t4-sdk-snippet.js`) only reads. It removes the user object and replaces the Stable ID before it prints. It also tests the hash candidates (djb2, sha256 hex, sha256 base64) against the test experiment's name.

The runbook is `planning/phase0/README.md`.

### WL-048 · 2026-10-15 · Decision · The non-admin part of F00-T5 moves to the first Tester

**Tickets:** F00-T5, F00-T6, F12-T3 · OPEN-005, OPEN-008

Maurice is an admin in Statsig and has no second account. So F00-T5 can't show what a non-admin Personal Console Key is allowed to do.

- **F00-T5 keeps the admin part:** the org setting for Personal Console Keys, the real `401` body from a made-up key (WL-017), and the real `403` body from a read-only key that tries a write.
- **New task F00-T6:** a non-admin Tester creates a Personal Console Key, then adds and clears an override with it. It runs with the first Tester, before the release.
- **The checkpoints change.** The phase 0 checkpoint no longer needs the non-admin answer to OPEN-008. The phase 5 checkpoint needs it. The spec marks OPEN-005 and OPEN-008 as blocking "Release to Testers", not the build, so F06 doesn't wait for it.

### WL-049 · 2026-10-16 · Discovery · T4 baseline: the SDK values on Intake staging, before any override

**Tickets:** F00-T4, F00-T2, F05-T1, F09-T1, F09-T2 · OPEN-007, OPEN-001 · Q5 · WL-009, WL-010, WL-047

Maurice ran `planning/phase0/t4-sdk-snippet.js` on `https://app.staging.talkiatry.com/assessment` at 2026-10-16 00:37 UTC. This was before any T3 write. The sanitized output is in the git-ignored scratch folder. This repo is public, so only field names are recorded here.

- **SDK instance:** the first entry of `window.__STATSIG__.instances`. The Stable ID comes from `instance.getContext().stableID`. The environment tier is `staging`, from `getContext().options.environment.tier`.
- **Values:** `instance.getContext().values` holds them. The top-level keys are `feature_gates`, `dynamic_configs`, `layer_configs`, `time`, `has_updates`, `hash_used`, `sdkInfo`, `sdkParams`, `param_stores`, `can_record_session`, `session_recording_rate`, `recording_blocked`, `session_recording_privacy_settings`, `user`, and `evaluated_keys`. There is no `derived_fields`.
- **Hashing:** `hash_used` is `djb2`. The keys of `dynamic_configs` and `layer_configs` are djb2 hashes, as decimal strings. One hash is a key in both maps.
- **Entry fields.** These are from the first entry of each map only.
  - `dynamic_configs`: `name`, `rule_id`, `secondary_exposures`, `id_type`, `value`, `is_device_based`, `is_experiment_active`, `is_user_in_experiment`.
  - `layer_configs`: `name`, `rule_id`, `secondary_exposures`, `value`, `id_type`, `is_device_based`, `explicit_parameters`, `undelegated_secondary_exposures`.
  - Neither entry has a group-name or allocated-experiment field. The field names for the group, the layer allocation, and the override marker are still open. The second snapshot (after `t3-move`) shows a full entry for the test experiment.
- **localStorage:** there are only `statsig.session_id.<n>` and `statsig.stable_id.<n>`. **There is no `statsig.cached.evaluations.*` key.** So on staging, the values reader (F09) must use `getContext().values`. The localStorage Stable ID fallback (F05-T1) has a key to read.
- **Risk for Q5 (WL-010):** the injector's `readCachedPayloads` collects gate hashes and SDK keys from `statsig.cached.evaluations.*` for project matching. On staging, that path finds nothing. Check that the project match still works on the Intake Site before F07.
- **Test objects:** neither `intake_ext_phase0_check` (djb2 `3031949423`) nor `intake_ext_phase0_layer_check` (`2152902337`) is in the values. Neither is the layer `intake_ext_phase0_layer` (`3040071864`). The values' `time` is 00:35:46 UTC, 90 seconds before the capture, so the project config changed just before the capture. If the test objects existed by then, an experiment that isn't started isn't in the values without an override. Maurice confirms the timing, and the second snapshot completes F00-T2.

### WL-050 · 2026-10-16 · Discovery · An experiment that isn't started, with no override, isn't in the SDK values

**Tickets:** F00-T2, F09-T1, F10 · OPEN-001 · WL-049

Maurice confirmed that the test experiments and the test layer existed before the T4 baseline (WL-049). The SDK values didn't hold any of them. So when an experiment isn't started and has no override, Statsig doesn't send it to the page. That includes its layer when the layer has no started experiment.

This is half of OPEN-001. The other half is whether the SDK serves the override group after `t3-move` puts the Stable ID in `Test`.

For Job 1 (F09, F10): an experiment that isn't in the values can't be shown from them. The Console API list has to supply it, so "My groups" can show it as "not served".

### WL-051 · 2026-10-16 · Discovery · Correction: the test experiment was in the SDK values; first preflight results

**Tickets:** F00-T2, F00-T3, F00-T4, F09-T1 · OPEN-001, OPEN-007 · Corrects WL-049 (the "Test objects" item) and WL-050 · WL-047

**Correction.** The T4 baseline (WL-049) searched for the runbook's default names. Maurice's test objects have other names, so WL-049's "Test objects" item and all of WL-050 are wrong. These are the real names, from `preflight` at 2026-10-16 00:51 UTC:

| Object                     | ID                                                                       | `status` | `idType`   | `layerID`                                |
| -------------------------- | ------------------------------------------------------------------------ | -------- | ---------- | ---------------------------------------- |
| Experiment, not in a layer | `intake_ext_phase0_maurice-temp-testing`                                 | `setup`  | `userID`   | `null`                                   |
| Layer                      | `intake_ext_phase0_maurice-temp-testing` (the same ID as the experiment) |          |            |                                          |
| Experiment in the layer    | `maurice-temp-testing-xp-in-layer`                                       | `setup`  | `stableID` | `intake_ext_phase0_maurice-temp-testing` |

- `intake_ext_phase0_maurice-temp-testing` hashes to djb2 `1451326467`, the key that was in both `dynamic_configs` and `layer_configs`. **So the experiment and the layer were in the SDK values at the baseline,** with no override. Maurice says the experiment is in Statsig's "test mode", and the API reports it as `setup`.
- So an experiment in `setup` with test mode on is sent to the page on staging. Whether an experiment in `setup` without test mode is sent is still open.
- `maurice-temp-testing-xp-in-layer` (djb2 `1259935451`) isn't a key in `dynamic_configs`. Its layer is in `layer_configs`.

**API facts from `preflight`:**

- `GET /experiments/{id}` gives `layerID` as the layer's ID string. It works as the path `id` of `GET /layers/{id}/overrides`, which returned 200. PATCH and DELETE on that path are still to be confirmed (`t3-layer`).
- An ID override added in the Console shows up in `userIDOverrides` with `environment: null` (the all-environments bucket). Its `unitType` is the experiment's ID type, `userID`. A gate or segment override shows up in `overrides`.

**Decision: the layer experiment can have any name.** `f00-check.sh` no longer requires `LAYER_EXPERIMENT` to start with `intake_ext_phase0_`. Layer writes go only to `/layers/{LAYER_ID}`. `LAYER_ID` must still start with the prefix, and the layer experiment must still have that `layerID` and status `setup`. No write goes to the layer experiment directly.

**Still to fix before T3:** the experiment's ID type must be Stable ID, and it needs one gate or segment override.

### WL-052 · 2026-10-16 · Discovery · T4 before T3: the entry fields for the test experiments; `t2-layer` added

**Tickets:** F00-T2, F00-T4, F09-T1, F09-T2, F10 · OPEN-001, OPEN-007 · WL-051

Maurice ran the snippet with the real test names at 2026-10-16 00:56 UTC, before any T3 write. Preflight had passed at 00:53. By then the experiment's ID type was Stable ID, and it had one gate override: `dummy` to `Control`. The `force-control` ID override from WL-051 was gone.

**The experiment not in a layer** (`intake_ext_phase0_maurice-temp-testing`, `setup`, test mode on). Its entry in `dynamic_configs`:

- **`group_name`** holds the group (`"Control"`). This is the group field for OPEN-007.
- `rule_id` is an opaque rule ID, not `prestart`.
- `is_experiment_active: false` and `is_user_in_experiment: true`.
- `secondary_exposures` has the gate override's gate (djb2 of `dummy`, `gateValue: "false"`). So the gate override was evaluated, failed, and a later rule put the Tester in `Control`.
- The other fields are `name` (the djb2 hash), `id_type`, `value`, and `is_device_based`.

**The experiment in the layer** (`maurice-temp-testing-xp-in-layer`, `setup`). Its entry in `dynamic_configs`:

- **`rule_id: "prestart"`**, no `group_name`, and `is_user_in_experiment: false`. This is how an experiment that isn't started looks.
- `is_in_layer: true` and `explicit_parameters: []`.
- It wasn't in the values at 00:37, and it was at 00:55. Maurice is asked what changed.

**The layer** (`intake_ext_phase0_maurice-temp-testing`) in `layer_configs`: `rule_id: "default"`, `value: {}`, and no field that names an allocated experiment. Nobody is allocated yet.

**Override marker.** Still open. The snapshot after `t3-move` shows how an ID override changes `rule_id` and `group_name`.

**Decision: a `t2-layer` step.** `t3-layer` ends by deleting the Tester's ID from the layer, so the snapshot after T3 would show no layer override. The new `t2-layer` step PATCHes the Stable ID into `GROUP_B` in the layer and leaves it there. `cleanup` removes it. The layer experiment is `prestart`, so the snapshot after `t2-layer` answers the open half of OPEN-001: does an override work on an experiment that isn't started and isn't in test mode?

### WL-053 · 2026-10-16 · Resolved · OPEN-004: PATCH adds, and the single-ID DELETE removes only one ID (F00-T3)

**Tickets:** F00-T3, F06-T1, F06-T2, F06-T3, F08-T2 · OPEN-004 · REQ-OVR-009, REQ-OVR-010 · WL-016, WL-052

Maurice ran `f00-check.sh t3` at 2026-10-16 01:00 UTC and `t2-layer` at 01:01 UTC. Every check passed. Below, `<stable-id>` stands for Maurice's Stable ID on staging. `other-a` and `other-b` are the made-up IDs `phase0-other-id-a` and `phase0-other-id-b`. All ID overrides used `environment: "staging"` and `unitType`/`idType` `stableID`.

**Experiment** `intake_ext_phase0_maurice-temp-testing`. Its gate override `dummy` → `Control` (`environment: null`) was present the whole time.

| Step                   | Request                                                                                       | Status   | ID overrides after the request                      |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `t3-seed`              | `PATCH …/overrides`, `other-a` → `Control`                                                    | 200      | Control: `other-a`                                  |
| `t3-seed`              | `PATCH …/overrides`, `other-b` → `Test`                                                       | 200      | Control: `other-a` · Test: `other-b`                |
| `t3-write`             | `PATCH …/overrides`, `<stable-id>` → `Test`                                                   | 200      | Control: `other-a` · Test: `other-b`, `<stable-id>` |
| `t3-same-id-new-group` | `PATCH …/overrides`, `<stable-id>` → `Control`                                                | 200      | Control: `other-a`, `<stable-id>` · Test: `other-b` |
| `t3-delete-one`        | `DELETE …/overrides/userID/<stable-id>?groupID=Control&unitType=stableID&environment=staging` | 200      | Control: `other-a` · Test: `other-b`                |
| `t3-delete-one`        | the same DELETE again                                                                         | 200      | no change                                           |
| `t3-move` setup        | `PATCH …/overrides`, `<stable-id>` → `Control`                                                | 200      | Control: `other-a`, `<stable-id>` · Test: `other-b` |
| `t3-move`              | `DELETE …/userID/<stable-id>?groupID=Control&…`, then `PATCH`, `<stable-id>` → `Test`         | 200, 200 | Control: `other-a` · Test: `other-b`, `<stable-id>` |

Every PATCH body was `{"overrides":[],"userIDOverrides":[{"groupID":<group>,"ids":[<one id>],"environment":"staging","unitType":"stableID"}]}`.

**Layer** `intake_ext_phase0_maurice-temp-testing`, with `experimentName: "maurice-temp-testing-xp-in-layer"` on every entry. There were no conditional overrides.

| Step       | Request                                                                                                                        | Status | ID overrides after the request                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------- |
| `t3-layer` | `PATCH /layers/{layerID}/overrides` (`op: "add"`), `other-a` → `Control`                                                       | 200    | Control: `other-a`                                         |
| `t3-layer` | the same, `<stable-id>` → `Control`                                                                                            | 200    | Control: `other-a`, `<stable-id>`                          |
| `t3-layer` | `DELETE /layers/{layerID}/overrides/userID/<stable-id>?groupName=Control&experimentName=…&idType=stableID&environment=staging` | 200    | Control: `other-a`                                         |
| `t2-layer` | `PATCH`, `<stable-id>` → `Test`                                                                                                | 200    | Control: `other-a` · Test: `<stable-id>` (left for F00-T2) |

**Answers:**

- **OPEN-004: PATCH adds to the list.** It doesn't replace it. Other IDs in the same group and in other groups stayed after every PATCH.
- **`overrides: []` keeps the existing conditional overrides.** This was tested with a gate override only. Segment overrides are in the same `overrides` array, but no test covered them.
- **A PATCH moves the ID.** A PATCH for an ID that is already in another group, in the same environment and unit type, takes it out of that group. The ID never sat in two groups. A move across environments wasn't tested.
- **The single-ID DELETE removes one ID from one group.** The other IDs in that group stay. A second DELETE returns 200 and changes nothing.
- **The planned move works.** DELETE, then PATCH, leaves the ID in the new group only (REQ-OVR-010).
- **`layerID` works as the layer path `id`** for GET, PATCH, and the single-ID DELETE.
- **Every PATCH and DELETE returns the full override set** in `data`, in the same shape as the GET. That includes the DELETE (`"Experiment Overrides updated successfully."`).
- **The GET returns a gate override as `{ groupID, id, type: "gate", environment }`.** It uses `id`, not `name`. WL-016's note about `name` in the GET example doesn't match the real API, and the base `ExperimentOverride` type (with `name`) is wrong (Q4).

**What this means for F06:**

- **F06-T1.** The WL-016 calls are safe for REQ-OVR-009. Because a PATCH moves the ID on its own, a move in one environment can be one PATCH. F06-T1 decides between that and DELETE, then PATCH. Both passed. Either way, check the PATCH response for the ID in the target group only, so no extra GET is needed.
- **F06-T2.** Use the same rules for layers.
- **F06-T3 and F08-T2.** The single-ID DELETE is confirmed. Use only it to clear.

### WL-054 · 2026-10-16 · Resolved · OPEN-001 and OPEN-007: overrides work before the start; the SDK value fields (F00-T2, F00-T4)

**Tickets:** F00-T2, F00-T4, F09-T1, F09-T2, F10 · OPEN-001, OPEN-007 · REQ-ASG-003, REQ-ASG-004 · WL-049, WL-052, WL-053

Maurice ran the snippet on Intake staging at 2026-10-16 01:07 UTC, after `t3-move` and `t2-layer` (WL-053). By then the Stable ID was in `Test` for both test experiments. The fixture `src/tests/fixtures/intake-sdk-values.json` holds the entries for both snapshots, `beforeOverride` (00:56, WL-052) and `afterOverride` (01:07). It keeps only the test objects, so it holds no user data and no real experiment.

| Entry                                                                   | Before the override                                                                         | After the override                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Experiment not in a layer (`setup`, test mode on), in `dynamic_configs` | `group_name: "Control"`, `rule_id: "37WKqU3Lv4hlQW3r5ORczO"`, `is_user_in_experiment: true` | `group_name: "Test"`, `rule_id: "37WKqVINXmqQalBmGWMPSQ:stableID:id_override"`, `is_user_in_experiment: false` |
| Experiment in the layer (`setup`), in `dynamic_configs`                 | `rule_id: "prestart"`, no `group_name`                                                      | `group_name: "Test"`, `rule_id: "5v76pESymLjxak6xeaqdmP:stableID:id_override"`                                 |
| The layer, in `layer_configs`                                           | `rule_id: "default"`, no group, no allocation                                               | `group_name: "Test"`, the same `rule_id` as its experiment, `allocated_experiment_name: "1259935451"`          |

**OPEN-001: yes.** An ID override works on an experiment that isn't started. Before the override, the experiment in the layer had `rule_id: "prestart"`, and after it, the SDK served `Test`. The experiment not in a layer had test mode on, and the override replaced its rule-based `Control` with `Test`. An experiment not in a layer, not started, and without test mode wasn't tested.

**OPEN-007: the fields.**

- **Group name:** `group_name`. It's in experiment entries and in layer entries. It's missing when the user has no group (`prestart`).
- **Layer allocation:** `allocated_experiment_name` in the layer entry. It's the experiment name, hashed with `hash_used` (here djb2 `1259935451` = `maurice-temp-testing-xp-in-layer`). It's there only when the user is allocated. The experiment's own entry has `is_in_layer: true`.
- **Hash method:** `hash_used` is `djb2` on staging. All keys and `name` fields are djb2 hashes as decimal strings. `sha256` didn't appear, so its encoding wasn't recorded. The snippet computes it in hex and base64 if a later capture needs it.
- **Override marker:** `rule_id` ends with `:<idType>:id_override` (here `:stableID:id_override`). Also, `is_user_in_experiment` is `false` under an override, even when it was `true` before. So "My groups" (F10) must use `rule_id` and `group_name`, not `is_user_in_experiment`.
- **Cache time:** there's no `statsig.cached.evaluations.*` key in localStorage (WL-049), so there's no `receivedAt`. The values' top-level `time` (epoch milliseconds) is the time of the project's last config change. It changed after each Console edit and write.
- **The override shows up in the SDK at once.** The snapshot was taken six minutes after the writes, and the reload showed the override.

### WL-055 · 2026-10-16 · Discovery · The real 401 bodies: a bad key gets plain text, a read-only key gets JSON (F00-T5)

**Tickets:** F00-T5, F00-T6, F06-T5, F04-T3 · OPEN-008 · REQ-OVR-016, REQ-SEC-003 · WL-016, WL-017

Maurice ran `t5-401` at 2026-10-16 01:10 UTC and `t5-403` at 01:12 UTC, both on the test experiment.

| Step     | Key                                | Request                                               | Status | Body                                                                    |
| -------- | ---------------------------------- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `t5-401` | made up (`console-PHASE0FAKEKEY…`) | `GET /experiments/{id}/overrides`                     | 401    | `Unauthorized` (plain text, not JSON)                                   |
| `t5-403` | a real read-only Console key       | `PATCH /experiments/{id}/overrides` (the WL-016 body) | 401    | `{"message":"Read only API keys can not modify entities","status":401}` |

- **WL-017's risk didn't happen.** The real `401` doesn't echo the key, in full or in part. The documented message that holds the key wasn't seen.
- **A read-only key's write gets `401`, not `403`.** So `401` has two meanings. The mapper (F06-T5) must check the body. If the JSON `message` says the key is read only, show "key not allowed (read only)". For any other `401`, show "key not valid". The mapper must not expect a JSON body, because the bad-key `401` is plain text.
- **`403` is still not seen.** It may come from a non-admin role (F00-T6). F00-T6 records any `403` body.
- The write was refused, so the override state didn't change.

### WL-056 · 2026-10-16 · Resolved · F00-T5 is done; the phase 0 checkpoint passes

**Tickets:** F00-T5, F00-T6, F06, F09 · OPEN-005, OPEN-008 · WL-048, WL-053, WL-054, WL-055

- **Org setting.** Maurice checked in Statsig: the org allows Personal Console Keys. This is the admin's view of OPEN-005. Whether a non-admin Tester can create one and use it for overrides is F00-T6 (WL-048).
- **F00-T5 is done.** The `401` bodies are in WL-055.
- **The phase 0 checkpoint passes.** OPEN-001, OPEN-004, and OPEN-007 have results (WL-053, WL-054). So does the admin part of OPEN-008 (WL-055, this entry). The override request shapes are confirmed (WL-053). F06-T1 and F09 are no longer blocked by phase 0.
- **Still open:** F00-T6 (a non-admin key) before the release. Maurice also runs `cleanup` and deletes the test objects.

### WL-057 · 2026-10-16 · Decision · Q1, Q4, and Q5 are decided; Q2 is closed

**Tickets:** F05-T2, F06-T3, F06-T6, F07, F07-T5, F10, F11 · Q1, Q2, Q4, Q5 · REQ-OVR-009, REQ-SEC-007, REQ-GAT-001 · WL-004, WL-010, WL-042, WL-049

Maurice decided these points. Each one was Claude's recommendation.

- **Q1: one new "Intake" tab.** It's the first tab of the popup. It holds My groups (Job 1), Force me into a group (Job 2), and the active overrides. The base tabs (Gates, Experiments, Configs, Audit Logs, Cleanup) stay as they are. Screenshots gets its own tab (REQ-SHT-001).
- **Q4: the base experiment override modal becomes read-only.** It shows the overrides, but it can't add or delete. Force me (F07) and Clear (F08) cover the Tester's own overrides. The base `POST` and bulk `DELETE /experiments/{id}/overrides` leave the write allowlist (WL-042 said this is a one-line edit). This makes REQ-OVR-009 safe by design, and REQ-SEC-007 gets tighter. The gate override feature doesn't change (REQ-GAT-001). New task: F06-T6.
- **Q5: no project gate on the Intake Site.** On an Intake Site tab, the popup uses the active project and skips the SDK-key match. The extension runs only on the Intake Site (F02), and the match reads `statsig.cached.evaluations.*`, which staging doesn't have (WL-049). If no project is set up, the login form shows as before. New task: F07-T5.
- **Q2 is closed.** Phase 0 passed (WL-056), so it no longer matters who runs it or when.

Maurice also ran `cleanup` from `planning/phase0/` after T5.

### WL-058 · 2026-10-16 · Decision · F06-T1 moves the Tester with one PATCH; the build order for F05 to F07

**Tickets:** F05, F06-T1, F06-T2, F06-T3, F06-T6, F07 · REQ-OVR-009, REQ-OVR-010 · WL-053, WL-057

Maurice accepted Claude's two recommendations. Work doesn't start until Maurice says so.

**How F06-T1 moves the Tester to another group.**

- Send one `PATCH …/overrides` with only the Tester's ID, for the new group. WL-053 showed that this PATCH takes the ID out of its old group in the same environment and unit type.
- Then check the PATCH response, which holds the full override set (WL-053). The Stable ID must be in the new group only, in that environment. If it's still in another group in that environment, remove it there with the single-ID `DELETE`.
- Don't send a DELETE before the PATCH. That takes two calls, and a failure between them leaves the Tester in no group.
- F06-T2 uses the same rules for layers.

**Build order.**

1. **Wave 1, in parallel.** Each task owns different files: F05-T1 (page reader), F06-T4 (override record), F06-T5 (error messages, WL-055), F06-T6 (the read-only modal and the write allowlist), F07-T5 (no project gate on the Intake Site). Claude reads the F06-T6 allowlist change line by line.
2. **Wave 2, one after the other.** F06-T1, then F06-T2, then F06-T3. They share the handler files.
3. **Wave 3: the Intake tab UI.** F07-T1 to F07-T4, plus F05-T2. Before any UI is built, Claude brings Maurice a layout proposal. Then Claude reviews the screenshots against it.

### WL-059 · 2026-10-16 · Decision · F06 runs in two waves; a new engine file routes force and clear

**Tickets:** F06-T1 to F06-T6, F07, F08 · REQ-OVR-008, REQ-OVR-009, REQ-OVR-010, REQ-OVR-012, REQ-OVR-016 · WL-042, WL-046, WL-053, WL-055, WL-057, WL-058

Maurice said to start F06, all six tasks, with as much parallel work as possible. Claude made these decisions.

**Two waves.** WL-058 put F06-T1, T2, and T3 one after the other, because they share the handler files. The files are now split, so each task has its own files:

- F06-T1 owns `src/handlers/experiment-overrides.ts` only.
- F06-T2 owns the new `src/handlers/layer-overrides.ts` only.
- F06-T3 owns the new `src/handlers/override-engine.ts`. It sends force and clear to the layer handler or the experiment handler, and it writes the override record. The routing test from F06-T2 moves there.
- Wave A, in parallel: F06-T1, T2, T4, T5, and T6. Wave B: F06-T3, after wave A is committed.
- Claude wrote the shared types first: `ExperimentStatus`, `Experiment.layerID`, `LayerIDOverride`, and `LayerOverridesResponse` in `src/types/statsig/experiments.ts`. No wave A agent edits that file.

**The engine writes the record.**

- `forceStableIdIntoGroup` saves the record only after the write succeeds.
- `clearStableIdOverride` removes the record after a 200 or a 404. Any other error keeps the record.
- The F07 and F08 UI call only the engine.

**The layer `experimentName` is the experiment `id`.** The phase 0 script sent the same value as the experiment path id and as `experimentName` (WL-053). WL-016 calls the path id "the experiment name". The record keeps `experimentId` for the API, and `experimentName` for display. T-OVR-2 on staging (F07) confirms it.

**A move looks only in the same bucket.**

- Only entries with the exact same environment and ID type `stableID` count. An entry with `environment: null` (all environments) stays.
- In a layer, only entries with the same `experimentName` count.
- Risk: the Tester's ID can stay in another experiment of the same layer. WL-053 didn't test these cases. F07 or F08 decides what to show.
- If the PATCH succeeds but the clean-up DELETE fails, the Tester can be in two groups, with no record. WL-053 showed that the PATCH moves the ID by itself, so the clean-up is a fallback. The handler throws, and F07 shows the error. A retry repeats the PATCH (no change) and the clean-up.

**The old base handlers go last.** `updateExperimentOverrides` (POST) and `deleteExperimentOverrides` (bulk DELETE) stay until F06-T6 removes their only caller. F06-T3 deletes them. Until then, `pnpm knip` reports them as unused.

**Error copy (F06-T5, REQ-OVR-016).**

| Case                                             | Message                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `401`, any body that isn't the read-only JSON    | "The Console Key is not valid. Check the key, then try again."                               |
| `401`, JSON `message` says the key is read only  | "Read-only key. Add a key with write access to change overrides." (WL-042)                   |
| `403`                                            | "The Console Key is not allowed to do this. Ask someone from engineering for help." (WL-046) |
| `429`                                            | "Too many changes in Statsig right now. Wait a few minutes, then try again."                 |
| No network                                       | "Cannot reach Statsig. Check your network connection, then try again."                       |
| The ID isn't in the target group after the write | "Statsig did not confirm the override. Try again."                                           |

- `404`, `5xx`, and the fallback keep the base behavior.
- **No network is a distinct error.** The background script marks a failed `fetch` with `networkError: true`. `src/lib/fetcher.ts` then throws a `NetworkError`, and the mapper shows the network message for it.

### WL-060 · 2026-10-16 · Discovery · Opus review of F06 wave A: one brief defect fixed; Q9 opened

**Tickets:** F06-T1, F06-T2, F06-T4, F06-T5, F06-T6, F07, F08 · Q9 · REQ-OVR-009, REQ-OVR-010, REQ-OVR-013, REQ-OVR-016 · WL-053, WL-058, WL-059

Three Opus reviewers read wave A. Each Sonnet agent fixed its own findings.

**The brief defect (F06-T1, F06-T2).** The briefs said to send the clean-up DELETEs and check after. So if a PATCH returned 200 without the ID in the target group, the handler deleted the Tester's old override and then threw. The Tester was then in no group. WL-058 was written to stop this. A scratch probe showed it on both handlers. Now both handlers do this:

1. Send the PATCH.
2. If the PATCH response doesn't have the ID in the target group, throw "Statsig did not confirm the override. Try again." Send no DELETE.
3. Send the clean-up DELETEs.
4. Check the last response.

Also:

- A response without `data`, without the list, or with an entry without `ids` counts as "no IDs". So it gives "did not confirm", not a `TypeError`.
- The input check refuses any field that isn't a non-empty string, `undefined` and `null` too. A stored record isn't checked at run time, so `stableId: undefined` could otherwise reach `/userID/undefined`.
- Mutation checks showed that the new tests fail without each fix.

**Correction to WL-059: the 429 copy.** `handleApiError` also maps errors for the login and the list reads, where "changes" is wrong. The new copy is "Too many requests to Statsig right now. Wait a few minutes, then try again."

**Other fixes.**

- A payload `message` that isn't a string no longer skips the key redaction.
- The settings reset clears the records without subscribing to them, so the hooks that use it don't re-render on each record write.
- The test that no write is sent from the read-only modal can now fail. It clicks every button, and it checks every write method.

**F06-T6 deviations, accepted.**

- No change to `src/components/common/*` (REQ-GAT-001). The experiment list passes a no-op `onDeleteConfirm` to `SharedOverridesTable`. Its rows never call delete.
- The information-only `PageContextCard` copies about 25 lines of `BaseOverrideContextCard`. That component always shows an environment select.
- The read-only reason line is gone from the experiment section. It only explained the removed controls.

**Q9 is open (Maurice).** The settings reset runs on logout, and it clears the override records (F06-T4 said to). The overrides stay in Statsig. Then F08 can't list them or clear them (REQ-OVR-013, REQ-OVR-014). See Q9 in `README.md`.

**Risks for later tasks.**

- **F07.** TanStack Query's default `networkMode: 'online'` pauses a mutation when the browser goes offline. Then the "Cannot reach Statsig" message never shows. Set `networkMode: 'always'` on the override mutations, or show `isPaused`.
- **T-OVR-2 on staging (F07).** WL-053 tested `overrides: []` only with a gate override on an experiment. Also check that `conditionalOverrides: []` keeps a layer's conditional overrides, and that `overrides: []` keeps a segment override.
- **Accepted.** The `networkError` flag also covers a refused redirect, a CORS failure, and a failed `response.text()`.
- **Copy that suggests editing, left as is.** "Manage Experiment Overrides: {id}" is the title of a modal that nothing opens now. "Manual override only." is in a component shared with the gates (REQ-GAT-001).
- **Optional clean-up.** `useOverridesSectionLogic` still fetches the feature gates, and nothing reads them. The base code did this too.

### WL-061 · 2026-10-16 · Discovery · Final Opus review of F06: the engine runs one operation at a time; records need a project ID

**Tickets:** F06-T3, F07, F08 · Q9 · REQ-OVR-009, REQ-OVR-012, REQ-OVR-013, REQ-OVR-014 · WL-059, WL-060

An Opus reviewer read F06-T3 and the whole F06 branch. A scratch run used the real engine, handlers, fetcher, wretch, and storage, and mocked only `sendMessage`. It confirmed these points:

- The only requests are the two PATCHes and the two single-ID DELETEs.
- Every request passes the write allowlist, and every request carries only the Tester's Stable ID (REQ-OVR-009).
- Each error reaches the caller with the WL-059 or WL-060 message, and `cause.status` stays.

**Fixed in F06-T3: a race in the record writes.**

- The engine reads the records, changes them, and writes them back. Two operations at the same time lost a record. For example, `Promise.all` of two forces kept only one record.
- Now the engine runs each whole force and each whole clear one at a time. A failed operation doesn't stop the next one. This also keeps Clear all (F08-T2) to one call at a time, for the rate limit (WL-016).
- A clear now removes the stored record only if it still has the same group and layer. If the Tester forced the experiment into another group after, that newer record stays.
- The engine queue covers one extension page. F07 and F08 must also disable the override actions while one runs.
- A new integration test runs the real chain, from the engine to a mocked `sendMessage`.

**Records need a project ID (F08), whatever Q9 decides.** `ProjectPicker` changes the active project without a logout. A clear, or the F08 check, for a record from project A then goes out with project B's key. It probably gets a 404, and the engine then drops the record while the override stays in A. WL-053 didn't record the 404 case, so this is plausible, not seen. F08 adds `projectId` to the record and skips records from a project that isn't active.

**Left as is, with a note.**

- **The write succeeds, but saving the record fails.** `forceStableIdIntoGroup` throws the storage error, and the override is live with no record. F07 shows it as a failure with a retry. The retry sends the same PATCH (no change) and saves the record. A clear in the same case heals on a retry, because the DELETE is idempotent.
- **A stored `layerId: ''`** counts as "not in a layer", the same as on force. The engine never writes one, so it can only come from damaged storage.

### WL-064 · 2026-10-16 · Discovery · F05-T1 results: the lookup order, the tier, and the `href` guard

**Tickets:** F05-T1 · REQ-OVR-004, REQ-OVR-007, REQ-SET-014 · §7 rule 3 · WL-028, WL-031

- **Lookup order.** The page reader tries the SDK steps first, in the same order as before: `getStableID()`, `getContext().stableID`, the `firstInstance` context, `_stableID`, `identity.stableID`. Each step accepts only a string that isn't blank after trimming. If a step fails, the next step runs. Then the reader takes the first `localStorage` key that starts with `statsig.stable_id.` and has a usable value. It parses the value as JSON, or uses the raw value if that fails, then trims it. It never reads the cookie. The result says `sdk` or `localStorage`.
- **No SDK instance.** Before, the reader returned `null`. Now it returns the `localStorage` ID, with no context, keys, or tier. It returns `null` only when it finds nothing.
- **Tier.** The reader returns `getContext().options.environment.tier` only if it is a non-empty string.
- **Throwing accessors.** Each read runs in its own `try`/`catch`. A throwing SDK accessor drops only its own field, and the `localStorage` fallback still runs.
- **`href` guard (WL-031, item 1, closed).** The page reports `window.location.href`. `getUserDetails` drops the result unless that URL is an Intake Site URL, and it doesn't pass `href` on. The Opus review showed that a page can replace `globalThis` and fake `globalThis.location`. A page can't replace `window.location`.
- **Sanitized fields.** The page's own scripts can change what the SDK returns. So `getUserDetails` keeps `stableId` only with a known source and a non-blank string, and keeps the tier only as a non-empty string.
- **Self-contained check (§7 rule 3).** A unit test now runs the serialized function in a fresh `vm` context with only page globals. Before, a module-level reference passed every test and failed only in Chrome. The review also showed that an `es2017` build target turns object spreads into a module-level helper, and the function then returns `null` in Chrome. Don't lower the build target.
- **Contract.** `PageStableId` is in `src/types/statsig/sdk.ts`. `UserDetails` has `stableId` and `environmentTier`.

### WL-065 · 2026-10-16 · Decision · F05-T2: a typed-in Stable ID goes to session storage per origin; the fallback layout

**Tickets:** F05-T2, F07-T2 · REQ-OVR-005, REQ-OVR-009, REQ-OVR-011 · T-OVR-6 · WL-057, WL-058

Maurice decided these points. Each one was Claude's recommendation.

- **Storage.** A typed-in ID goes to `browser.storage.session`, with one key per origin of the Intake tab (`manual-stable-id:<origin>`). Chrome destroys the popup each time it closes, so popup state would lose the ID after each forced reload (REQ-OVR-011). `storage.local` would keep an old ID after the SDK makes a new one. Chrome clears session storage when it restarts. Staging and production keep separate IDs. The `storage` permission covers it, so no new permission is needed.
- **A detected ID always wins.** The typed-in ID is used only while the page read finds nothing.
- **Layout.** First an alert box with the error and Try again. Then the Stable ID field with Use this ID, and a hint that says where to find the ID. After a valid entry, one line says that the typed-in ID is in use, with Clear. The component is `StableIdFallback`. It ships on its own, and F07-T2 places it in the Intake tab. This layout is agreed for F05-T2 only. The rest of the Intake tab still needs its layout proposal (WL-058).
- **One source for forcing.** F07 gets the Stable ID from `useTesterStableId()` and from nowhere else.

### WL-066 · 2026-10-16 · Discovery · Opus reviews of F05; the listener check; notes for F07 and F09

**Tickets:** F05-T1, F05-T2, F07-T2, F07-T4, F09 · REQ-OVR-009, REQ-GAT-001 · WL-029, WL-031

- **Listener (WL-031, item 2, closed).** F05 doesn't revive the content-script path, but the sender check is small, so it is in. The `runtime.onMessage` listener in `use-detected-user.ts` ignores other message types before any tab query. It accepts a message only when `sender.tab` is an Intake Site page and is the active Intake tab, and only while the hook is still mounted. The check proves which tab sent the message, not which script in the page. Page scripts can still send `STATSIG_USER_FOUND` through the content script's `postMessage` relay. Forcing doesn't read that store, so Job 2 isn't affected.
- **Fixed after the review.** A background read of the typed-in ID could overwrite a Save or a Clear in the query cache. After Clear, the hook could still return the cleared ID. The hook now cancels that read before it writes the cache. A new test switches from the staging origin to the production origin while the hook is mounted, so a later change can't leak one origin's ID to the other (REQ-OVR-009). The component moves focus after each state change and announces its errors.
- **For F07.** `useTesterStableId` keeps the last read while `isRefetching` is true. The page query has a fixed key and the default 5-minute stale time, so it doesn't see a tab or origin change by itself. Force only when `isLoading` and `isRefetching` are false. Call `refetch()` just before a write, or check the origin of `getActiveIntakeTab()` again. `TesterStableIdSource` isn't exported yet. Export it when F07 needs it.
- **Gate panel (REQ-GAT-001).** With no SDK instance on the page, `useUserDetails` now returns `{ stableID }` from `localStorage` instead of `{}`. So the gate override panel shows its pass and fail actions for that ID. The add and delete calls don't change. Recorded only.
- **`statsig-detector` (dormant).** It now gets a result when the page has no SDK yet but `localStorage` has a Stable ID. It would post `context: undefined` and stop polling too early. It isn't registered (WL-029). If F09 or a later task registers it, make it wait for `result.context`.
- **Risk: more than one `statsig.stable_id.*` key.** The reader takes the first usable key in index order. It doesn't tie the key to the page's SDK key. One origin normally has one SDK key, so it has one key. This isn't checked on the real Intake Site. If it matters, prefer the key whose suffix matches the hash of the page's SDK key.
- **Checks.** 1072 unit tests pass in 114 files. `pnpm type-check`, `pnpm lint`, `pnpm format:check`, and `pnpm knip` are clean. The e2e suite passes, 70 of 70. That includes the 6 detection specs, which inject the reader in Chrome.
