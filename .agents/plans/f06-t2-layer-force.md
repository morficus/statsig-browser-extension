# Brief: F06-T2 Force the Tester into a group of an experiment in a layer

slug: f06-t2-layer-force
status: done (2259a12)
agent: f06-t2 (Sonnet, shared F06 worktree)

## Decision

If an experiment's `layerID` isn't null, Statsig needs the override at the layer level (REQ-OVR-008). The same safety rules as for experiments apply (REQ-OVR-009 critical, REQ-OVR-010). Phase 0 proved the layer calls on the real API (WL-053): `PATCH /layers/{layerID}/overrides` with `op: "add"` adds one ID. `DELETE /layers/{layerID}/overrides/userID/{id}` removes one ID from one group. `layerID` works as the layer path id. WL-058: one PATCH, then check the response. Only if the ID is still in another group of the same experiment and environment, remove it there with the single-ID DELETE.

WL-059: this task owns only the new layer handler file. Another agent writes the experiment handler (`src/handlers/experiment-overrides.ts`) at the same time with the same rules. A later task (F06-T3) builds `src/handlers/override-engine.ts`, which picks the layer or experiment handler (the routing test moves there) and saves the record. So this file does no routing and no storage. WL-059 also decided that the layer `experimentName` is the experiment's `id`; the caller passes it in.

Context: `planning/WORKLOG.md` WL-007, WL-016, WL-053, WL-058, WL-059.

## Owns

```
src/handlers/layer-overrides.ts        (new)
src/handlers/layer-overrides.test.ts   (new)
```

Read-only for you: `src/types/statsig/experiments.ts` (the lead already added `LayerIDOverride` and `LayerOverridesResponse`; use them), `src/lib/fetcher.ts`, `src/lib/utils.ts` (another agent is changing `handleApiError`'s messages right now, but its signature `handleApiError(error: unknown): string` stays), and `src/handlers/experiment-overrides.ts` plus its test as the style to follow.

## Intent

New file `src/handlers/layer-overrides.ts`, with these exports:

```ts
export interface LayerStableIdOverrideArgs {
  /** `Experiment.layerID`, used as the layer path id (WL-053). */
  layerId: string
  /** The experiment `id` (WL-059). */
  experimentName: string
  /** The group name, exactly as in the experiment. */
  groupName: string
  stableId: string
  /** The exact environment, for example "staging". */
  environment: string
}

export const removeStableIdFromLayerGroup = async (args: LayerStableIdOverrideArgs): Promise<LayerOverridesResponse>
export const forceStableIdIntoLayerGroup = async (args: LayerStableIdOverrideArgs): Promise<LayerOverridesResponse>
```

Declare a local (not exported) `interface ApiResponse<DataType> { data: DataType; message?: string }`, as in `experiment-overrides.ts`. Use the `api` export from `@/src/lib/fetcher`. Use a module constant `const STABLE_ID_TYPE = 'stableID'` (exact case).

**Input check (both functions).** If any of the five fields is the empty string `''`, throw `new Error('A layer, an experiment, a group, a Stable ID, and an environment are needed.')` before any request. Don't trim.

**Error wrapping (both functions).** Wrap every API failure as `throw new Error(handleApiError(error), { cause: error })`. `cause` must be the original error object, unchanged, because the engine reads `cause.status` (for a 404). Don't wrap an error twice: when `forceStableIdIntoLayerGroup` calls `removeStableIdFromLayerGroup`, let that function's already-wrapped error propagate as is.

**`removeStableIdFromLayerGroup(args)`:**

- `DELETE` to `/layers/${encodeURIComponent(layerId)}/overrides/userID/${encodeURIComponent(stableId)}?groupName=${encodeURIComponent(groupName)}&experimentName=${encodeURIComponent(experimentName)}&idType=stableID&environment=${encodeURIComponent(environment)}`. Query keys in that order. Use `encodeURIComponent` (a space becomes `%20`, as the phase 0 script sent it). Don't use `URLSearchParams` (it turns a space into `+`).
- No request body: `api.url(path).delete().json<ApiResponse<LayerOverridesResponse>>()`.
- Return `result.data` (the full override set, WL-053).

**`forceStableIdIntoLayerGroup(args)`:**

1. Input check.
2. `PATCH /layers/${encodeURIComponent(layerId)}/overrides` with this body, exactly: `{ op: 'add', conditionalOverrides: [], idOverrides: [{ groupName, ids: [stableId], idType: 'stableID', environment, experimentName }] }`. Use `api.url(path).patch(body).json<ApiResponse<LayerOverridesResponse>>()`.
3. From `data.idOverrides`, find the **other groups**: entries where `environment === args.environment` **and** `idType === 'stableID'` **and** `experimentName === args.experimentName` **and** `groupName !== args.groupName` **and** `ids.includes(args.stableId)`. Strict equality only: `null`, `undefined`, another environment, another ID type, or another experiment is never a match. Take the unique `groupName`s in response order.
4. For each other group, one at a time (await each; no `Promise.all`), call `removeStableIdFromLayerGroup({ ...args, groupName: otherGroupName })`. The response of the last call becomes the current state. If a call throws, let it propagate; don't continue.
5. Check the current state. The ID must be in an entry with `groupName === args.groupName`, the same environment, `idType === 'stableID'`, and the same `experimentName`. It must be in no other group with that environment, ID type, and experiment. If not, throw `new Error('Statsig did not confirm the override. Try again.')`. Don't retry.
6. Return the current state.

Never send a POST. Never send a DELETE without `/userID/{id}` in the path. Never put any ID other than `stableId` in a request.

**Tests** (`layer-overrides.test.ts`; mock `@/src/lib/fetcher` with a hoisted `apiMock` whose `url().patch().json()` and `url().delete().json()` chains work, like `experiment-overrides.test.ts`):

- The PATCH body deep-equals the one-ID body above (with `op: 'add'` and `conditionalOverrides: []`), and the path is encoded (use `layerId: 'layer/a b'` → `/layers/layer%2Fa%20b/overrides`).
- The PATCH response holds other IDs in the target group and in other groups, plus conditional overrides, and the Tester's ID only in the target group: no DELETE is sent, and the result is returned.
- Move A → B where the PATCH response still shows the Tester's ID in A (same experiment, environment, `stableID`): exactly one DELETE, for group A, with the exact path and query. The DELETE response has the ID in B only, and that is the return value. No request mentions another ID.
- The Tester's ID in another group but with `environment: null`, another environment, `idType: 'userID'`, or another `experimentName`: no DELETE.
- The PATCH response doesn't have the ID in the target group: throws `'Statsig did not confirm the override. Try again.'`.
- The DELETE response still has the ID in A: throws the same message.
- The PATCH fails: the thrown error's `cause` is the original error, and no DELETE is sent.
- A clean-up DELETE fails: the error propagates and no more calls happen.
- `removeStableIdFromLayerGroup`: the exact path and query (a group name with a space, e.g. `'Test B'` → `groupName=Test%20B`), no body, returns `data`.
- An empty field: throws the input message, and no request is sent (one case per function is enough).

## Verify

Run:
- `pnpm vitest run src/handlers/layer-overrides.test.ts`
- `pnpm type-check` (errors in files you don't own: list them, don't fix)
- `pnpm exec oxlint src/handlers/layer-overrides.ts src/handlers/layer-overrides.test.ts`
- `pnpm exec oxfmt --check src/handlers/layer-overrides.ts src/handlers/layer-overrides.test.ts`

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

## Review fixes (Opus review, WL-060)

The first version followed steps 3 to 5 above, which had a defect: the clean-up DELETEs ran before the check. If a PATCH returns 200 without the ID in the target group, that deletes the Tester's old override and leaves them in no group. Fixed order:

1. PATCH.
2. If the PATCH response doesn't have the ID in the target bucket, throw the "did not confirm" message and send no DELETE.
3. The clean-up DELETEs.
4. The final check on the last response.

Also: a missing `data`, a missing list, or an entry without `ids` counts as "no IDs", so a malformed response gives "did not confirm", not a `TypeError`. The input check refuses any field that isn't a non-empty string (`undefined` and `null` too). The wrap tests use a wretch-shaped error, so they prove that `handleApiError` maps the message.
