# Brief: F06-T6 Make the base experiment override modal read-only (Q4)

slug: f06-t6-read-only-modal
status: done (6d755b1)
agent: f06-t6 (Sonnet, shared F06 worktree)

## Decision

Q4 is decided (WL-057): the base experiment override modal becomes **read-only**. It shows the overrides, but it can't add or delete. The base add POSTs the full list, which replaces it (WL-003). The base delete sends every ID in a row (WL-004). Both can remove other Testers' overrides, which breaks REQ-OVR-009 (critical). Force me (F07) and Clear (F08) will cover the Tester's own overrides through the new handlers. Then the base `POST` and bulk `DELETE /experiments/{id}/overrides` leave the write allowlist. WL-042 said this is a one-line edit per call. REQ-SEC-007 gets tighter.

**Don't change the gate override feature** (REQ-GAT-001, §2.2). The gate modal shares components with the experiment modal (`src/components/common/*`). The gate UI, its behavior, and its tests must stay the same.

Context: `planning/WORKLOG.md` WL-003, WL-004, WL-042, WL-057, WL-058, WL-059.

## Owns

```
src/components/modals/manage-experiment/**
src/hooks/use-overrides-section-logic.ts
src/hooks/use-overrides-section-logic.utils.ts
src/hooks/use-experiment-mutations.ts          (delete)
src/hooks/use-experiment-mutations.test.tsx    (delete)
src/tests/unit/use-overrides-section-logic.utils.test.ts
src/tests/integration/ExperimentOverrides.test.tsx
src/lib/api-config.ts
src/lib/api-config.test.ts
e2e/overrides.e2e.ts
e2e/mocks.ts
e2e/mock-data.ts
```

Conditional ownership: `src/components/common/SharedOverridesTable.tsx`, `src/components/common/SharedOverridesList.tsx`, and `src/components/common/SharedOverridesTable.test.tsx`, **only** if their existing props (for example `canEdit`) can't hide the controls. Then add one optional prop whose default keeps today's behavior, so the gate callers don't change. Prefer the existing props. Say which you did under Deviations.

Not yours: `src/handlers/experiment-overrides.ts` and its test (another agent is adding new functions there now). Leave `updateExperimentOverrides` and `deleteExperimentOverrides` in that file; F06-T3 deletes them later. Also not yours: anything under `src/components/modals/manage-gate-overrides/`, the gate hooks and handlers, `src/types/`, `src/lib/utils.ts`, `src/lib/fetcher.ts`, `entrypoints/`.

## Intent

**The modal.**

- It still lists every override it lists today: the ID overrides (group, IDs, environment, unit type, as shown today) and the conditional overrides. Same loading, empty, and error states.
- Remove the add form, the "add" entry points (for example the button that opens the form, and the page-context card's add action), and every delete control (row buttons, icons, confirm dialogs).
- Remove every code path that calls `updateExperimentOverrides` or `deleteExperimentOverrides`. After this change, no file outside `src/handlers/experiment-overrides.ts` and its test imports those two functions.
- Delete files that this makes unused, if they are in your Owns list (likely `manage-experiment/AddOverrideForm.tsx`, `src/hooks/use-experiment-mutations.ts` and its test). Delete `manage-experiment/PageContextCard.tsx` too if its only job was to add an override. If it also shows information, keep that part and remove only the add action. Remove the now-unused helpers in `use-overrides-section-logic.utils.ts` (for example `getUpdatedUserIDOverrides`, `getDeletedOverrides`) and their tests, if nothing else uses them. Don't delete shared files in `src/components/common/`: the gate modal uses them.
- Remove the write-access gating (`use-write-access`) only where it guarded the removed controls.
- **No new user-facing copy.** Don't change titles or labels. If a remaining title or label suggests editing (for example "Manage overrides"), leave it, and list the exact text and file under "Left undone".

**The write allowlist** (`src/lib/api-config.ts`). Remove exactly these two lines from `ALLOWED_WRITE_CALLS`, comments included:

```ts
  { method: 'POST', path: '/experiments/{id}/overrides' }, // Base experiment modal, kept until Q4 is decided (WL-042)
  { method: 'DELETE', path: '/experiments/{id}/overrides' }, // Base experiment modal, kept until Q4 is decided (WL-042)
```

Change nothing else in that file. The remaining six calls are the four WL-016 calls plus the two gate calls.

**Tests.**

- `api-config.test.ts`: `isAllowedApiRequest` refuses `POST` and `DELETE` on `/experiments/{id}/overrides`. It still allows `PATCH /experiments/{id}/overrides`, `DELETE /experiments/{id}/overrides/userID/{userID}`, `PATCH /layers/{id}/overrides`, `DELETE /layers/{id}/overrides/userID/{userID}`, `POST /gates/{id}/overrides`, and `DELETE /gates/{id}/overrides`. Update any test that lists the whole allowlist.
- The modal (`manage-experiment/OverridesSection.test.tsx` and/or `src/tests/integration/ExperimentOverrides.test.tsx`): it lists the ID overrides and the conditional overrides from a mocked GET; it has no add control, no form inputs, and no delete control (assert that the controls the old tests used are absent); no write request is sent.
- `e2e/overrides.e2e.ts`: remove or rewrite the experiment add and delete cases so that they check the read-only list. Don't change the gate cases.
- The gate tests must pass **unchanged**: `src/tests/integration/GateOverrides.test.tsx`, `src/components/modals/manage-gate-overrides/GateOverridesSection.test.tsx`, `src/handlers/gate-overrides.test.ts`, `src/hooks/use-gate-*.test.tsx`, and the existing cases in `src/components/common/SharedOverridesTable.test.tsx`.

## Verify

Run:
- `pnpm vitest run src/lib/api-config.test.ts src/components src/tests/integration src/tests/unit/use-overrides-section-logic.utils.test.ts src/hooks src/handlers/gate-overrides.test.ts`
- `git diff --stat -- src/components/modals/manage-gate-overrides src/tests/integration/GateOverrides.test.tsx src/handlers/gate-overrides.test.ts` (expect no output)
- `grep -rn "updateExperimentOverrides\|deleteExperimentOverrides" src entrypoints e2e` (expect only `src/handlers/experiment-overrides.ts` and its test)
- `pnpm type-check` (errors in files you don't own: list them, don't fix)
- `pnpm exec oxlint <your files>` and `pnpm exec oxfmt --check <your files>`
- **You are the only agent that builds in this wave.** `pnpm build:chrome`, then `pnpm exec playwright test e2e/overrides.e2e.ts e2e/detail-sheets.e2e.ts e2e/key-type.e2e.ts`. If the build fails in a file you don't own, wait a minute and try again, up to three times. Then report it.

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
