# Brief: F06-T4 Override record

slug: f06-t4-override-record
status: done (7bcdebd)
agent: f06-t4 (Sonnet, shared F06 worktree)

## Decision

The extension must record each override it sets (REQ-OVR-012). F08 lists these records, checks them against the API, and clears them, and F10 marks experiments with them. The base `currentOverridesStorage` is typed `{ name: string }[]` and only ever reset (WL-008), so we replace it. The group name is the override key for both APIs (WL-016), so it is stored exactly as sent. WL-059: the engine (F06-T3, later) saves a record after a successful force and removes it after a clear. This task builds only the type, the pure helpers, and the storage item. No API calls.

Context: `planning/WORKLOG.md` WL-008, WL-016, WL-059.

## Owns

```
src/lib/override-record.ts             (new)
src/lib/override-record.test.ts        (new)
src/lib/storage.ts
src/lib/storage.test.ts                (new)
src/hooks/use-settings-storage.ts
src/hooks/use-settings-storage.test.tsx
```

## Intent

**`src/lib/override-record.ts`** (new). Pure code only: no imports from `wxt`, storage, or the API.

```ts
/** One override that the Tester set with this extension (REQ-OVR-012). */
export interface OverrideRecord {
  /** The experiment path id. For a layer write it is also the `experimentName` (WL-059). */
  experimentId: string
  /** The experiment display name. */
  experimentName: string
  /** Set only when the override was written at the layer level. */
  layerId?: string
  /** Exactly as sent. The override key for both APIs (WL-016). */
  groupName: string
  environment: string
  stableId: string
  /** When the override was set, in epoch milliseconds. */
  createdAt: number
}

/** One record per experiment, Stable ID, and environment. */
export type OverrideRecordKey = Pick<OverrideRecord, 'environment' | 'experimentId' | 'stableId'>

export const isSameOverrideTarget = (a: OverrideRecordKey, b: OverrideRecordKey): boolean
export const upsertOverrideRecord = (records: readonly OverrideRecord[], record: OverrideRecord): OverrideRecord[]
export const removeOverrideRecord = (records: readonly OverrideRecord[], key: OverrideRecordKey): OverrideRecord[]
export const listOverrideRecords = (records: readonly OverrideRecord[]): OverrideRecord[]
```

- `isSameOverrideTarget`: true when `experimentId`, `stableId`, and `environment` are all strictly equal (case-sensitive).
- `upsertOverrideRecord`: returns a new array. If a record with the same target exists, the new record replaces it **at the same index**. Otherwise it's appended at the end. If (from older data) more than one record matches, the first is replaced and the others are dropped, so there is one record per target. Never mutate the input.
- `removeOverrideRecord`: returns a new array without every record that matches the key. Never mutate the input.
- `listOverrideRecords`: returns a new array sorted by `createdAt`, newest first. Records with the same `createdAt` keep their stored order.

**`src/lib/storage.ts`.** Delete `currentOverridesStorage` (and its key `local:statsig-current-overrides`). Add, in the same place:

```ts
/** Overrides that the Tester set with this extension (REQ-OVR-012). Extension storage only (REQ-SEC-002). */
export const overrideRecordsStorage = storage.defineItem<OverrideRecord[]>('local:statsig-override-records', {
  fallback: [],
})
```

Import the type with `import type { OverrideRecord } from '@/src/lib/override-record'`. Don't migrate or delete the old key's stored data. Change nothing else in the file.

**`src/hooks/use-settings-storage.ts`.** Replace the `currentOverridesStorage` use with `overrideRecordsStorage`. The reset still sets it to `[]`. Rename the local setter to match (`setOverrideRecords`). Change nothing else.

**Tests.**

- `override-record.test.ts`: add to an empty list; add a second target (another environment → two records); replace (forcing the same experiment, Stable ID, and environment into a second group leaves one record, with the new group and `createdAt`, at the same index); the duplicate clean-up case; remove (only the matching record goes; a key that matches nothing returns an equal array); list order (newest first, ties keep order); no helper mutates its input (freeze the input with `Object.freeze`).
- `storage.test.ts` (new): writing `overrideRecordsStorage` puts the value in `browser.storage.local` under `statsig-override-records`, and `browser.storage.sync` and `browser.storage.session` stay empty. Read how the other tests in this repo get a fake `browser` (look at `src/tests/setup.ts` and at tests that use storage) and do the same.
- `use-settings-storage.test.tsx`: update the existing tests for the rename, and test that the reset sets the records to `[]`.

## Verify

Run:
- `pnpm vitest run src/lib/override-record.test.ts src/lib/storage.test.ts src/hooks/use-settings-storage.test.tsx`
- `grep -rn "currentOverridesStorage\|statsig-current-overrides" src e2e entrypoints` (expect no output)
- `pnpm type-check` (errors in files you don't own: list them, don't fix)
- `pnpm exec oxlint <your files>`
- `pnpm exec oxfmt --check <your files>`

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
