# Brief: F04 review fixes

slug: f04-review-fixes
status: done (06231a1)
agent: f04-fixes (Sonnet, lead worktree, no other agent running)

## Decision

The Opus review of F04 (`e409c45..6370c8a`) found no serious bugs, but five cheap hardening and test gaps. Fix exactly
these. The other review findings are logged and deliberately not fixed. Context: `planning/WORKLOG.md` WL-040 to
WL-042.

## Owns

```
entrypoints/background.ts
src/tests/unit/background.test.ts
src/store/use-settings-store.ts
src/store/use-settings-store.test.ts
src/components/ErrorBoundary.tsx
src/components/ErrorBoundary.test.tsx
src/components/modals/manage-gate-overrides/OverrideRow.tsx
src/components/modals/manage-gate-overrides/GateOverridesSection.test.tsx
```

## Intent

Work directly in `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/gallant-bardeen-3e8f5d`
(the lead's worktree, HEAD `1e54cf0`, clean). No other agent is editing it.

1. **Send the upper-cased method.** In `background.ts`, pass the normalized method (`(method ?? 'GET').toUpperCase()`)
   to `fetch`, the same value the allowlist checked. Test: a request with `method: 'patch'` on an allowed path reaches
   `fetch` with `method: 'PATCH'`. Fix the existing lowercase-`patch` test so it asserts the method fetch received.
2. **Forward only known headers.** In `background.ts`, build the outgoing headers from scratch: copy only `Accept` and
   `Content-Type` from the caller (case-insensitive) and drop everything else. Then keep the existing key logic: use the
   caller's `STATSIG-API-KEY` if present, else the stored key, and remove quotes as today. Set `STATSIG-API-VERSION` to
   `STATSIG_API_VERSION` unless the caller sent one; if it did, keep it. First grep what headers `src/lib/fetcher.ts`
   and wretch actually send. If any other header is needed for requests to work, stop and report. Tests: an
   `X-HTTP-Method-Override` header and an arbitrary `X-Foo` header are not forwarded. `Content-Type`, `Accept`, the
   key, and the version header are.
3. **Adding an existing key applies the chosen type.** In `use-settings-store.ts` `addProject`, when the key already
   belongs to a project, keep today's behavior (activate it, pin the origin if asked) **and** set that project's
   `apiKeyType` to the type passed in. Tests: re-adding a write-key project's key with `read-key` makes it `read-key`
   and syncs `apiKeyTypeStorage`. Re-adding without a type argument doesn't change its stored type. To make that
   possible, the parameter must distinguish "not given" from `write-key`. Make it optional with no default, and keep
   `write-key` as the default only for **new** projects.
4. **ErrorBoundary log.** In `ErrorBoundary.tsx`, log `handleApiError(error)` (from `@/src/lib/utils`) and
   `errorInfo.componentStack` instead of the raw `error`/`errorInfo`, so a `cause` chain holding a raw API body can't
   reach the console. Keep the same log prefix text. Test: an error whose `cause` message contains `console-abc123`
   produces no console argument containing `abc123`.
5. **Gate delete button name and write-key test.** Give the delete button in
   `manage-gate-overrides/OverrideRow.tsx` `aria-label="Delete override"` (the same label the experiment rows use;
   check them first and match exactly). In `GateOverridesSection.test.tsx`, find delete buttons by that name instead
   of `svg.lucide-trash-2`. Add an assertion that with a write key the delete buttons are enabled.

Must not:

- Change anything else, add dependencies, or write other user-facing copy.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f04-review-fixes/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f04-review-fixes/checks.json`.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check` (only `new-feature-spec.md` is a known hit)
- `pnpm vitest run --exclude '.claude/**'`
- `pnpm knip`
- `pnpm build:chrome`
- `pnpm test:e2e` (full suite; `e2e/projects.e2e.ts:63` is known flaky, WL-023: re-run it alone once if it's the only failure)

## Report

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
