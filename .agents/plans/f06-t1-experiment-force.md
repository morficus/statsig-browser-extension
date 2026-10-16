# Brief: F06-T1 Force the Tester into an experiment group (not in a layer)

slug: f06-t1-experiment-force
status: agreed
agent: f06-t1 (Sonnet, shared F06 worktree)

## Decision

The Tester's Stable ID must go into exactly one group of an experiment, and no other ID may change (REQ-OVR-006, REQ-OVR-009 critical, REQ-OVR-010). Phase 0 proved the calls on the real API (WL-053): `PATCH …/overrides` **adds** the one ID and moves it out of its old group in the same environment. The single-ID `DELETE …/overrides/userID/{id}` removes one ID from one group and is idempotent. WL-058 decided the move: one PATCH, then check the response. Only if the ID is still in another group in that environment, remove it there with the single-ID DELETE. No DELETE before the PATCH.

WL-059: this task owns only the experiment handler file. A later task (F06-T3) builds `src/handlers/override-engine.ts`, which picks the layer or experiment handler and saves the record. So this file does no routing and no storage.

Context: `planning/WORKLOG.md` WL-003, WL-016, WL-053, WL-058, WL-059.

## Owns

```
src/handlers/experiment-overrides.ts
src/handlers/experiment-overrides.test.ts
```

Read-only for you: `src/types/statsig/experiments.ts` (the lead already wrote the types), `src/lib/fetcher.ts`, `src/lib/utils.ts` (another agent is changing `handleApiError`'s messages right now, but its signature `handleApiError(error: unknown): string` stays).

## Intent

**Keep `updateExperimentOverrides` and `deleteExperimentOverrides` and their existing tests exactly as they are.** F06-T3 deletes them later (WL-059).

Add these exports to `src/handlers/experiment-overrides.ts`:

```ts
export interface ExperimentStableIdOverrideArgs {
  /** The experiment path id (WL-016 calls it the experiment name). */
  experimentId: string
  /** The group name. The API field is `groupID` (WL-016). */
  groupName: string
  stableId: string
  /** The exact environment, for example "staging". */
  environment: string
}

export const removeStableIdFromExperimentGroup = async (args: ExperimentStableIdOverrideArgs): Promise<ExperimentOverridesResponse>
export const forceStableIdIntoExperimentGroup = async (args: ExperimentStableIdOverrideArgs): Promise<ExperimentOverridesResponse>
```

Use the module's existing `ApiResponse<T>` interface and the `api` export from `@/src/lib/fetcher`. Use a module constant `const STABLE_ID_UNIT_TYPE = 'stableID'` (exact case).

**Input check (both functions).** If any of the four fields is the empty string `''`, throw `new Error('An experiment, a group, a Stable ID, and an environment are needed.')` before any request. Don't trim.

**Error wrapping (both functions).** Wrap every API failure exactly like the base handlers: `throw new Error(handleApiError(error), { cause: error })`. `cause` must be the original error object, unchanged, because the engine reads `cause.status` (for a 404). Don't wrap an error twice: when `forceStableIdIntoExperimentGroup` calls `removeStableIdFromExperimentGroup`, let that function's already-wrapped error propagate as is.

**`removeStableIdFromExperimentGroup(args)`:**

- `DELETE` to `/experiments/${encodeURIComponent(experimentId)}/overrides/userID/${encodeURIComponent(stableId)}?groupID=${encodeURIComponent(groupName)}&unitType=stableID&environment=${encodeURIComponent(environment)}`. Query keys in that order. Use `encodeURIComponent` (a space becomes `%20`, as the phase 0 script sent it). Don't use `URLSearchParams` (it turns a space into `+`).
- No request body: `api.url(path).delete().json<ApiResponse<ExperimentOverridesResponse>>()`.
- Return `result.data` (the full override set, WL-053).

**`forceStableIdIntoExperimentGroup(args)`:**

1. Input check.
2. `PATCH /experiments/${encodeURIComponent(experimentId)}/overrides` with this body, exactly: `{ overrides: [], userIDOverrides: [{ groupID: groupName, ids: [stableId], environment, unitType: 'stableID' }] }`. Use `api.url(path).patch(body).json<ApiResponse<ExperimentOverridesResponse>>()`.
3. From `data.userIDOverrides`, find the **other groups**: entries where `environment === args.environment` **and** `unitType === 'stableID'` **and** `groupID !== args.groupName` **and** `ids.includes(args.stableId)`. Strict equality only: an entry with `environment: null`, `undefined`, another environment, or another unit type is never a match. Take the unique `groupID`s in response order.
4. For each other group, one at a time (await each; no `Promise.all`), call `removeStableIdFromExperimentGroup({ ...args, groupName: otherGroupID })`. The response of the last call becomes the current state. If a call throws, let it propagate; don't continue.
5. Check the current state. The ID must be in an entry with `groupID === args.groupName`, the same environment, and `unitType === 'stableID'`. It must be in no other group with that environment and unit type. If not, throw `new Error('Statsig did not confirm the override. Try again.')`. Don't retry.
6. Return the current state.

Never send a POST. Never send a DELETE without `/userID/{id}` in the path. Never put any ID other than `stableId` in a request.

**Tests** (`experiment-overrides.test.ts`; keep the existing tests; add `patch` to the hoisted `apiMock` and make the chain work for `url().patch().json()` and `url().delete().json()`):

- The PATCH body deep-equals the one-ID body above, and the path is encoded (use `experimentId: 'exp/a b'` → `/experiments/exp%2Fa%20b/overrides`).
- The PATCH response holds other IDs in the target group and in other groups, and the Tester's ID only in the target group: no DELETE is sent, and the result is returned.
- Move A → B where the PATCH response still shows the Tester's ID in A (same environment, `stableID`): exactly one DELETE, for group A, with the exact path and query. The DELETE response has the ID in B only, and that is the return value. No request mentions another ID.
- The Tester's ID in another group but with `environment: null`, with another environment, or with `unitType: 'userID'`: no DELETE.
- The PATCH response doesn't have the ID in the target group: throws `'Statsig did not confirm the override. Try again.'`.
- The DELETE response still has the ID in A: throws the same message.
- The PATCH fails: the thrown error's `cause` is the original error, and no DELETE is sent.
- A clean-up DELETE fails: the error propagates and no more calls happen.
- `removeStableIdFromExperimentGroup`: the exact path and query (a group name with a space, e.g. `'Test B'` → `groupID=Test%20B`), no body, returns `data`.
- An empty field: throws the input message, and no request is sent (one case per function is enough).

## Verify

Run:
- `pnpm vitest run src/handlers/experiment-overrides.test.ts`
- `pnpm type-check` (errors in files you don't own: list them, don't fix)
- `pnpm exec oxlint src/handlers/experiment-overrides.ts src/handlers/experiment-overrides.test.ts`
- `pnpm exec oxfmt --check src/handlers/experiment-overrides.ts src/handlers/experiment-overrides.test.ts`

## Shared tree (read this first)

- Work only in `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f06-override-engine`. `cd` there first.
- Run `git log -1 --format=%s`. It must be `docs(planning): Plan F06 in two waves and split the handler files (WL-059)`. If it isn't, stop and report.
- Read `CLAUDE.md` (the hard rules), the ticket `planning/tickets/F06-override-engine.md`, and the `WORKLOG.md` entries this brief cites.
- Other agents edit other files in this same tree at the same time. While they work, `pnpm type-check`, `pnpm lint`, or the full `pnpm vitest run` can show errors in files you don't own. Don't fix them. List them in your report. Your own files must be clean.
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
