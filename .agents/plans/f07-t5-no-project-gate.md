# Brief: F07-T5 No project gate on the Intake Site

slug: f07-t5-no-project-gate
status: agreed
agent: f07-t5 (Sonnet, worktree `.claude/worktrees/f07-t5`, branch `f07-t5`)

## Decision

Q5 is decided (WL-057). On an Intake Site tab, the popup uses the active project and skips the SDK-key match. The extension runs only on the Intake Site (F02). The match reads `statsig.cached.evaluations.*`, and staging doesn't have that key (WL-049). So today the gate asks for a key on staging, and the main tabs never show.

Today, `entrypoints/popup/App.tsx` shows `NotIntakeSitePanel` on any tab that isn't an Intake Site tab (F02-T3). It shows `MainTabs` only when `useAppLogic().isPageMatched` is true, which means `usePageProject().status === 'matched'`. Otherwise it shows `PageProjectGate` (WL-010). `Header` shows `ProjectStatus` only on an Intake Site tab.

Lead decisions:

1. **The change lives in `usePageProject()`.** All its consumers (`useAppLogic`, `ProjectStatus`, `ProjectDetectionNotice`, `PageProjectGate`) then agree. `App.tsx` doesn't change.
2. **One source for "is this an Intake Site tab".** Today `useIsIntakeSite()` keeps the answer in local state, and only `useAppLogic` calls it. Move the value into `useContextStore`, the store that already holds the per-popup page facts. `useIsIntakeSite()` writes it and reads it back. `usePageProject()` reads it from the store. Don't call `useIsIntakeSite()` from `usePageProject()`. That would send one `tabs.query` per consumer, and each consumer would show its own "not resolved yet" state.
3. **A new match reason, `'intake-site'`.** The existing `'manual'` reason is in `ProjectMatchReason` too, and only `usePageProject()` uses it. Follow that pattern.
4. **The order of the rules in `usePageProject()`:**
   1. `isApiKeyLoading` → `pending`. This stays first, and it doesn't change. During a project switch, it stops the old project's cached data from showing under the new project's label (`ProjectTransition.test.tsx`).
   2. **New:** `isIntakeSite === true` and `findProject(projects, activeProjectId)` finds a project → `{ reason: 'intake-site', status: 'matched' }`. This rule wins over a manual pick. On the Intake Site, every project counts as "used on this page", so "picked by hand" would be wrong.
   3. The manual rule, unchanged.
   4. `getProjectDetection(...)`, unchanged.
   - If `isIntakeSite` is `false` or `undefined`, rules 3 and 4 apply as today. So off the Intake Site, and before the tab check resolves, nothing changes. (The popup body and `ProjectStatus` don't render then anyway.)
   - If there are projects but `activeProjectId` doesn't resolve to one, rule 2 doesn't apply. Rules 3 and 4 decide, and the gate can show. That is the only case where `PageProjectGate` can still show on the Intake Site with a project set up.
   - With no project at all, `hasProjects` is false and the status isn't `matched`. `PageProjectGate` renders nothing, and `useAppInitialization` opens the login modal, as before.
5. **Detection keeps running.** Don't remove or skip `usePageDetection()`, `useProjectMatching()`, or the injector. F05 and F09 need the page reads, and the Settings sheet still shows each project's match reason.
6. **`reset()` in the context store keeps `isIntakeSite`.** The tab doesn't change while the popup is open. Nothing calls `reset()` in production today. If a later caller clears the flag, the popup body goes blank until the popup reopens, because `useIsIntakeSite()` checks the tab once. Tests must set `isIntakeSite` themselves.
7. **e2e.** `e2e/detection.e2e.ts` runs on the faked Intake origin (WL-011). It has three tests that assert the old gate, and Q5 changes that behavior on purpose. They change as described below. No other e2e file changes.

Context: `planning/WORKLOG.md` WL-010, WL-011, WL-049, WL-057. `planning/tickets/F07-force-me-ui.md` F07-T5.

## Owns

```
src/store/use-context-store.ts
src/hooks/use-is-intake-site.ts
src/hooks/use-is-intake-site.test.tsx
src/hooks/use-page-project.ts
src/hooks/use-page-project.test.tsx          (new)
src/hooks/use-app-logic.test.tsx
src/lib/projects.ts                          (the union and the label map only)
src/components/layout/PageProjectGate.tsx    (the doc comment above `PageProjectGate` only)
src/tests/integration/ProjectTransition.test.tsx
e2e/detection.e2e.ts
```

Anything not in this list is read-only for this agent. In particular, don't edit `entrypoints/`, `src/hooks/use-app-logic.ts`, `ProjectStatus.tsx`, `ProjectDetectionNotice.tsx`, or the F05 files (`src/hooks/use-detected-user.ts`, `src/handlers/get-user-details.ts`, `src/lib/get-user-details-injector.ts`). Another branch changes the F05 files.

## Intent

### `src/store/use-context-store.ts`

- Add `isIntakeSite?: boolean` to `ContextState`, with this doc comment: `/** Whether the inspected tab is an Intake Site page; \`undefined\` until the check resolves. The tab doesn't change while the popup is open, so \`reset\` keeps it. */`
- Add the setter `setIsIntakeSite: (value: boolean) => void`. Keep the setters in their current alphabetical order.
- The initial value is `undefined`. `reset()` doesn't touch `isIntakeSite`.

### `src/hooks/use-is-intake-site.ts`

- Same export, same signature, same return type (`boolean | undefined`), same doc comment.
- Return `useContextStore((state) => state.isIntakeSite)`.
- The effect still calls `getActiveIntakeTab()` once on mount, and it keeps the `mounted` guard. When the call resolves, it calls `setIsIntakeSite(tab !== null)` from the store.

### `src/lib/projects.ts`

- `ProjectMatchReason` gets `'intake-site'`. Keep the union in alphabetical order.
- `MATCH_REASON_LABELS` gets `'intake-site': 'Used for every Intake Site page'`. Use this exact text.
- Change nothing else in this file. `matchProject` never returns `'intake-site'`.

### `src/hooks/use-page-project.ts`

- Read `isIntakeSite` from `useContextStore`.
- Apply the rules in the order of decision 4. Use plain `if` statements or a small helper inside the file if a nested ternary fails lint. The return shape doesn't change.
- Update the doc comment so it says that on an Intake Site tab, the active project counts as matched without the SDK-key match (Q5, WL-057). It also says that a project picked by hand still short-circuits the question everywhere else.

### `src/components/layout/PageProjectGate.tsx`

- Change only the doc comment above `export function PageProjectGate`. It now says that on the Intake Site, the gate shows only when projects exist but the active project can't be found (Q5, WL-057). No code change.

### Tests

**`src/hooks/use-page-project.test.tsx` (new).** Use the real stores (`useSettingsStore.setState`, `useContextStore.setState`), and reset both in `beforeEach`, `isIntakeSite: undefined` included. Use `renderHook`. Cases:

1. Intake tab, an active project, `detectedKeys: null`, `projectMatch: null` → `status: 'matched'`, `reason: 'intake-site'`, and `activeLabel` is the project label.
2. Intake tab, an active project, and detected keys that belong to no project → `matched`, `intake-site`. (Without the Intake flag this is `unknown-project`. Assert that too, in the same test or the next one.)
3. Intake tab, and `manualProjectId` equal to the active project → `reason: 'intake-site'`, not `'manual'`.
4. Intake tab, no projects → `hasProjects: false`, and `status` isn't `'matched'`.
5. Intake tab, projects exist, but `activeProjectId` isn't one of them → the status isn't `'matched'`, and the reason isn't `'intake-site'`.
6. `isIntakeSite: false`, and `isIntakeSite: undefined`, each with an active project and no keys → the same result as today's detection (`no-statsig` for `detectedKeys` with no keys, `pending` for `detectedKeys: undefined`; read `getProjectDetection` and assert what it returns).
7. Intake tab, an active project, `isApiKeyLoading: true` → `status: 'pending'` and `reason: undefined`.

**`src/hooks/use-is-intake-site.test.tsx`.** Reset `isIntakeSite` to `undefined` in `beforeEach`. Keep the existing two tests. Add one test: after the check resolves, `useContextStore.getState().isIntakeSite` has the same value as the hook.

**`src/hooks/use-app-logic.test.tsx`.** In `beforeEach`, also set `useContextStore.setState({ isIntakeSite: undefined })`, because `reset()` keeps it now. Add two tests. They use the real `usePageProject` (this file doesn't mock it):

- "shows the main tabs on an Intake Site tab with an active project and no SDK-key match": `isIntakeSite: true` in the context store, one project that is active, `detectedKeys: null`, `projectMatch: null` → `isPageMatched` is true.
- "does not match on an Intake Site tab when no project is set up": `isIntakeSite: true`, `projects: []` → `isPageMatched` is false. The login modal part of this acceptance criterion is already covered by `use-app-initialization.test.tsx` ("opens the auth modal when loading completes without an API key") and `PageProjectGate.test.tsx` ("renders nothing while no project is configured"). Don't copy those tests. Name both in your report.

**`src/tests/integration/ProjectTransition.test.tsx`.** In `beforeEach`, add `isIntakeSite: undefined` to the existing `useContextStore.setState(...)` call, so the existing tests keep their meaning. Add one test, "does not expose the previous project cached gates during a switch on an Intake Site tab". It copies the first test, with these changes: `isIntakeSite: true` and `manualProjectId: undefined` in the context store, and no `setManualProject('b')` call. Assert the same four `expect`s, the `pending` status included. If the copy is long, a small helper inside this file is fine. Don't change the existing tests.

**`e2e/detection.e2e.ts`.** Change only these three tests:

- `reports a page whose SDK key belongs to no configured project` → rename it to `uses the active project on an Intake page that none of its keys match`. Keep the seed. Assert that the header button `/Other Project · this page/iu` is visible, the `Gates` tab is visible, and the text `/belongs to another Statsig project/iu` is hidden.
- `says when the inspected page runs no Statsig SDK` → rename it to `uses the active project on an Intake page without a Statsig SDK`. Keep the seed and the blank page. Assert that the header button `/Other Project · this page/iu` is visible and the `Gates` tab is visible.
- `loads the project data once the key of the inspected site is added` → delete it. On the Intake Site with a project set up, the gate doesn't show, so this flow can't happen there now. `PageProjectGate.test.tsx` still covers the form. Remove any helper or import that only this test used.

Every other test, in every file, keeps its assertions. If an existing test that isn't named here fails, stop and report it with the failure output. Don't change it.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables *your* changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f07-t5-no-project-gate/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f07-t5-no-project-gate/checks.json`. Save screenshots to
  `.agents/scratch/f07-t5-no-project-gate/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

Repo rules from `CLAUDE.md` that apply here: use `pnpm vitest run` for one run (`pnpm test` starts watch mode). Don't add a dependency.

## Verify

Run, from the worktree root `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f07-t5`:

- `pnpm vitest run`
- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check` (if it fails on a file you own, run `pnpm exec oxfmt --write <that file>`, then check again)
- `pnpm knip`. Record the output. Before this task, it reports the F06 leftovers that WL-059 names. Report anything new.
- `pnpm test:e2e` (it builds Chrome first). Run it in the background if your tool allows, because it can take several minutes.

Screenshots: none. The UI doesn't change. Only which existing UI shows changes.

Write `.agents/scratch/f07-t5-no-project-gate/checks.json` with one entry per command above, plus one entry per test file you added or changed, with its pass count.

## Report

```
## Done
<one line>

## Files changed
<path> — <what changed>

## Checks
<contents of checks.json>

## Screenshots
none

## Deviations
<where you did something other than what the brief said, and why — or "none">

## Left undone
<anything in the brief you didn't do, and why — or "nothing">
```

## Amendment 1 (after the Opus review)

The Opus review found one defect in this brief and four fixes. This section wins over the text above.

**Correction to decision 6.** `useLogout()` calls `useContextStore.reset()` on every logout (`src/hooks/use-logout.ts`, step 4). So keeping `isIntakeSite` in `reset()` matters for "log out, then log in again on the Intake Site". No test protects it now: a mutation that clears the flag in `reset()` passed all 1082 tests.

**Decision 4, rule 2, is narrower.** On the Intake Site, the manual label wins in one case: the Tester picked the active project by hand, and the page detection positively matched a *different* project that exists. In that case the page is known to use another project. So "b · picked by hand" ("You are working on b, which this page does not use") is true, and "Used for every Intake Site page" is false. In every other case, rule 2 applies as before. That includes a manual pick with no positive match, as on staging, where detection finds nothing (WL-049).

- Rule 2 doesn't apply when all of these are true:
  - `isIntakeSite === true`.
  - `manualProjectId === activeProjectId`, and that project exists.
  - `projectMatch` isn't null or undefined.
  - `projectMatch.projectId !== activeProjectId`.
  - `findProject(projects, projectMatch.projectId)` finds a project.
- Then the manual rule applies (`reason: 'manual'`, `status: 'matched'`).
- The status is `matched` either way, so the main tabs still show. Only the header label and the tooltip change.

**Accepted, no change.** Rule 2 doesn't wait for the detection to finish. So if the page's key belongs to another configured project, the active project's data loads first. Then `useProjectMatching` switches. The review verified that the data never shows under the wrong label. Waiting for the detection would risk a gate that waits forever if the detection never settles, and Q5 removes exactly that failure.

### Fixes

Your owns list grows by these files:

```
src/store/use-context-store.test.ts
src/hooks/use-logout.test.tsx
src/components/sheets/settings/ProjectsSettings.tsx      (the one sentence below only)
src/components/sheets/settings/ProjectsSettings.test.tsx (only if a test asserts that sentence)
```

1. **Test the reset invariant.**
   - In `src/store/use-context-store.test.ts`, add "keeps isIntakeSite on reset". Set `isIntakeSite: true`, call `reset()`, and assert that it's still `true`. Also assert that a field `reset()` clears (for example `detectedUser`) is cleared.
   - In `src/hooks/use-logout.test.tsx`, add one test: after the logout callback runs, `useContextStore.getState().isIntakeSite` is unchanged. Use that file's existing setup. If it mocks the context store so that this can't be asserted, say so in your report and add only the store test.
   - Then do the mutation check yourself. Make `reset()` clear `isIntakeSite`, confirm that the new tests fail, and restore the file exactly.
2. **Narrow rule 2** in `src/hooks/use-page-project.ts`, as defined above. Keep the `resolveDetection` helper. Change its comment so it states the exception. Add these tests to `src/hooks/use-page-project.test.tsx`:
   - (a) Intake tab, projects `a` and `b`, `activeProjectId: 'b'`, `manualProjectId: 'b'`, `projectMatch: { projectId: 'a', reason: 'client-key' }` → `status: 'matched'`, `reason: 'manual'`.
   - (b) The same, but `projectMatch: null` → `reason: 'intake-site'`.
   - (c) The same as (a), but `manualProjectId: undefined` → `reason: 'intake-site'`. This is the short moment before the automatic switch.
   - (d) The same as (a), but the matched project `a` isn't in `projects` → `reason: 'intake-site'`.
   - The existing test "reports the Intake Site, not a manual pick" must still pass.
3. **e2e.** In `e2e/detection.e2e.ts`, at the end of "uses the active project on an Intake page that none of its keys match", add `await expect(popup.getByRole('row', { name: /new_checkout_flow/u })).toBeVisible()`. Keep the other assertions.
4. **Doc comment.** In `src/components/layout/PageProjectGate.tsx`, replace the paragraph you added with exactly this: `On the Intake Site the active project counts as matched (Q5, WL-057), so the key form doesn't show there while a project is set up.`
5. **Settings copy.** In `src/components/sheets/settings/ProjectsSettings.tsx`, the sentence "The extension only loads the project matching the Statsig SDK key detected on the page; selecting one manually pins the current site to it." becomes exactly: "On the Intake Site, the extension loads the active project; selecting one manually pins the current site to it." Keep "Add one Console API key per project." before it. If a test asserts the old text, change only that assertion.

Then re-run every command in **Verify**, `pnpm test:e2e` included, and rewrite `checks.json`. Report in the same format. Under **Deviations**, list anything you did differently.
