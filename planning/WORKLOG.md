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
