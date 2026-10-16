# Brief: F06-T3 Override engine: route force and clear, keep the record

slug: f06-t3-engine
status: done (fd08521)
agent: f06-t3 (Sonnet, shared F06 worktree)

## Decision

Wave A built the parts. F06-T1 made the experiment handlers, F06-T2 made the layer handlers, and F06-T4 made the override record and its storage. This task joins them in one engine, which is the only thing the F07 and F08 UI will call (WL-059):

- **Force** sends the write to the layer when the experiment has a `layerID` (REQ-OVR-008), else to the experiment. It saves the record only after the write succeeds (REQ-OVR-012).
- **Clear** deletes only the Tester's Stable ID, with the single-ID DELETE, using the group, environment, and ID type from the record (REQ-OVR-009, REQ-OVR-014, WL-016, WL-053). A 200 (also when the ID is already gone; the call is idempotent) or a 404 (the experiment or layer is gone) removes the record. Any other error keeps it.
- The layer `experimentName` is the experiment `id` (WL-059).

The base modal is now read-only (F06-T6), so the base `updateExperimentOverrides` (POST, replaces the list) and `deleteExperimentOverrides` (bulk DELETE) have no caller. This task deletes them (WL-059).

Context: `planning/WORKLOG.md` WL-016, WL-053, WL-057, WL-058, WL-059. Read the new code first: `src/handlers/experiment-overrides.ts`, `src/handlers/layer-overrides.ts`, `src/lib/override-record.ts`, `src/lib/storage.ts`, and their tests.

## Owns

```
src/handlers/override-engine.ts               (new)
src/handlers/override-engine.test.ts          (new)
src/handlers/experiment-overrides.ts          (only: delete the two base handlers)
src/handlers/experiment-overrides.test.ts     (only: delete their tests)
src/lib/fetcher.ts                            (only: delete `poster` if nothing else uses it)
src/lib/fetcher.test.ts                       (only: delete `poster` tests in that case)
```

## Intent

**`src/handlers/override-engine.ts`** (new):

```ts
export interface ForceStableIdArgs {
  experiment: Pick<Experiment, 'id' | 'layerID' | 'name'>
  groupName: string
  stableId: string
  environment: string
}

/** `cleared`: the DELETE returned 200. `not-found`: the experiment or layer is gone (404). */
export type ClearOverrideResult = 'cleared' | 'not-found'

export const forceStableIdIntoGroup = async (args: ForceStableIdArgs): Promise<OverrideRecord>
export const clearStableIdOverride = async (record: OverrideRecord): Promise<ClearOverrideResult>
```

A layer counts only when `layerID` (or the record's `layerId`) is a non-empty string. `null`, `undefined`, and `''` mean "not in a layer".

**`forceStableIdIntoGroup(args)`:**

1. In a layer: `forceStableIdIntoLayerGroup({ layerId: experiment.layerID, experimentName: experiment.id, groupName, stableId, environment })`. Else: `forceStableIdIntoExperimentGroup({ experimentId: experiment.id, groupName, stableId, environment })`.
2. If that throws, rethrow the same error object and don't touch storage.
3. Build the record: `{ experimentId: experiment.id, experimentName: experiment.name, groupName, environment, stableId, createdAt: Date.now() }`, plus `layerId: experiment.layerID` only in a layer. When not in a layer, the record has no `layerId` key at all (not `layerId: undefined`).
4. Save it: read `overrideRecordsStorage`, apply `upsertOverrideRecord`, write it back.
5. Return the record.

**`clearStableIdOverride(record)`:**

1. With `record.layerId`: `removeStableIdFromLayerGroup({ layerId: record.layerId, experimentName: record.experimentId, groupName: record.groupName, stableId: record.stableId, environment: record.environment })`. Else: `removeStableIdFromExperimentGroup({ experimentId: record.experimentId, groupName: record.groupName, stableId: record.stableId, environment: record.environment })`.
2. Success: remove the record from storage with `removeOverrideRecord` (by its experiment, Stable ID, and environment), and return `'cleared'`.
3. The error's `cause` is an object with `status === 404`: remove the record the same way, and return `'not-found'`. Read the status defensively (`cause` can be anything).
4. Any other error: rethrow the same error object and keep the record.

Calls run one at a time. No retries.

**Delete the base handlers.** In `src/handlers/experiment-overrides.ts`, delete `updateExperimentOverrides`, `deleteExperimentOverrides`, their two args interfaces, and any import this leaves unused. Delete their tests in `experiment-overrides.test.ts`, and the mocks only they used. Then, if nothing in `src/`, `entrypoints/`, or `e2e/` uses `poster` from `src/lib/fetcher.ts`, delete it and its tests. If something still uses it, leave it.

**Tests** (`override-engine.test.ts`). Mock `./experiment-overrides` and `./layer-overrides` with `vi.mock`. Use the real `overrideRecordsStorage` on the same fake browser storage that `src/lib/storage.test.ts` uses. Use fake timers or `vi.spyOn(Date, 'now')` for `createdAt`.

- Force, not in a layer (`layerID` `null`, `undefined`, and `''`): calls the experiment handler with the exact args; the layer handler isn't called.
- Force, in a layer: calls the layer handler with `layerId` and `experimentName: experiment.id`; the experiment handler isn't called.
- Force saves exactly the record above (no `layerId` key when not in a layer), and returns it.
- Force a second group for the same experiment, Stable ID, and environment: one record, with the new group.
- Force when the handler throws: the same error, and storage doesn't change.
- Clear, not in a layer and in a layer: calls the right remove handler with the record's exact group, Stable ID, environment, and (for a layer) `experimentName: record.experimentId`.
- Clear succeeds: the record goes, other records stay, and the result is `'cleared'`.
- Clear gets an error with `cause: { status: 404 }`: the record goes, and the result is `'not-found'`.
- Clear gets an error with `cause: { status: 401 }`, `{ status: 429 }`, or a cause without a status: the same error is thrown, and the record stays.

## Verify

Run:
- `pnpm vitest run` (the whole suite; nobody else is editing now)
- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`
- `pnpm knip` (`updateExperimentOverrides` and `deleteExperimentOverrides` must not be reported; list anything else it reports)
- `grep -rn "updateExperimentOverrides\|deleteExperimentOverrides" src entrypoints e2e` (expect no output)

## Shared tree (read this first)

- Work only in `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f06-override-engine`. `cd` there first.
- Run `git log --format=%s -8`. It must include `feat: Force the Stable ID into a layer group (F06-T2)` and `feat: Add the override record and its storage (F06-T4)`. If it doesn't, stop and report. The lead may commit F06-T6 while you work; that's expected.
- Read `CLAUDE.md` (the hard rules), the ticket `planning/tickets/F06-override-engine.md`, and the `WORKLOG.md` entries this brief cites.
- One other agent makes a small test fix in `src/tests/integration/ExperimentOverrides.test.tsx` while you start. Don't edit that file. The rest of the F06-T6 work (the read-only modal) is in the tree, uncommitted or just committed: build on it, don't change it. If the full suite fails only in that test file, wait a minute and re-run.
- Don't run `pnpm install`, `pnpm lint:fix`, `pnpm format`, or any command that writes files you don't own. Format your files with `pnpm exec oxfmt --write <your files>`. Lint them with `pnpm exec oxlint <your files>`.
- Don't run `pnpm build:chrome` or `pnpm test:e2e` unless this brief says so.
- Don't edit anything under `planning/` or `.agents/plans/`. The lead owns them.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories. (Deleting a file is allowed only where this brief says so.)
- Never commit, never push, never touch git state (no stash, checkout, reset, add).
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables *your* changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/<slug>/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/<slug>/checks.json`.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Report

Reply with exactly this shape:

```
## Done
<one line>

## Files changed
<path> — <what changed>

## Checks
<contents of checks.json>

## Deviations
<where you did something other than what the brief said, and why — or "none">

## Left undone
<anything in the brief you didn't do, and why — or "nothing">
```

`checks.json` shape: `{ "slug": "<slug>", "checks": [ { "id": "...", "cmd": "...", "expected": "...", "actual": "...", "pass": true } ] }`.

## Notes from wave A (read before you build)

- Both force handlers now confirm the PATCH before any clean-up DELETE, and their input checks refuse any field that isn't a non-empty string (WL-060). The engine passes `experiment.layerID` only when it's a non-empty string.
- The handlers wrap API failures as `new Error(handleApiError(error), { cause: error })`. A wretch error keeps `status` on `cause`. That is what the 404 check reads.
- `src/handlers/experiment-overrides.test.ts` mocks `@/src/lib/fetcher` with a hoisted `apiMock`. When you delete the old handlers' tests, keep the mocks the new tests need.
