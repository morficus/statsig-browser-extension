# Brief: F05-T2 error and manual Stable ID entry

slug: f05-t2-manual-stable-id
status: agreed
agent: f05-t2

## Decision

REQ-OVR-005: if the extension can't find the Stable ID, it shows an error and lets the Tester type the ID in. T-OVR-6: with the read blocked, the error and the input show, and the typed-in ID is the one used for forcing.

Maurice decided these points (WL-060):

- **Storage.** A typed-in ID goes to `browser.storage.session`, keyed by the origin of the active Intake tab. It survives the popup closing and the tab reload after each force (REQ-OVR-011). Chrome clears it on restart, so it can't go stale for long. Staging and production keep separate IDs, because the Stable ID lives in each origin's `localStorage`. `storage` already covers `storage.session`, so no new permission.
- **A detected ID always wins** over a typed-in one. The typed-in ID is used only while the page read finds nothing. Don't delete the stored ID when detection later succeeds. Just don't use it.
- **Layout.** The "Alert + field" layout below. The component ships on its own. F07-T1 places it in the new Intake tab. Nothing renders it yet.

F05-T1 is done and committed. `getUserDetails(tab)` (`src/handlers/get-user-details.ts`) returns `UserDetails` with `stableId?: { source: 'sdk' | 'localStorage'; value }` and `environmentTier?: string`, already validated and trimmed. Build on that. Don't change it.

Forcing (F06, F07) doesn't exist yet. "Used for forcing" means: F07 gets the ID from the hook below and from nowhere else. So the hook is the contract F07 builds on. Keep its API exactly as written.

## Owns

```
src/lib/manual-stable-id.ts
src/lib/manual-stable-id.test.ts
src/hooks/use-tester-stable-id.ts
src/hooks/use-tester-stable-id.test.tsx
src/components/intake/StableIdFallback.tsx
src/components/intake/StableIdFallback.test.tsx
```

All six are new files. `src/components/intake/` is a new directory. Create it.

## Intent

### 1. `src/lib/manual-stable-id.ts`

Use `storage` from `wxt/utils/storage`, as `src/lib/storage.ts` does.

```ts
export type ManualStableIdValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'whitespace' }

/** Trims, then rejects an empty value or one with whitespace inside. */
export function validateManualStableId(raw: string): ManualStableIdValidation

export function getManualStableId(origin: string): Promise<string | undefined>
export function saveManualStableId(origin: string, value: string): Promise<void>
export function clearManualStableId(origin: string): Promise<void>
```

- Key: `session:manual-stable-id:${origin}`, one key per origin.
- `saveManualStableId` validates again. If the value is not valid, it throws an `Error` and stores nothing. It stores the trimmed value.
- `getManualStableId` returns `undefined` for a missing key and for a stored value that isn't a non-empty string.
- Whitespace means any `/\s/` character after trimming.

### 2. `src/hooks/use-tester-stable-id.ts`

```ts
export type TesterStableIdSource = 'localStorage' | 'manual' | 'sdk'

export interface TesterStableId {
  /** The ID to force with. Undefined when none is detected or typed in. */
  stableId?: string
  source?: TesterStableIdSource
  /** SDK tier (REQ-OVR-007). Undefined when the SDK reports none; F07 defaults to production. */
  environmentTier?: string
  /** The typed-in ID for this origin, whether or not it is in use. */
  manualStableId?: string
  /** The page read is still running. */
  isLoading: boolean
  /** The page read finished on an Intake tab and found no Stable ID (REQ-OVR-005). */
  isMissing: boolean
  /** The page read is running again after `refetch`. */
  isRefetching: boolean
  saveManualStableId: (value: string) => Promise<void>
  clearManualStableId: () => Promise<void>
  refetch: () => Promise<void>
}

export function useTesterStableId(): TesterStableId
```

Use `@tanstack/react-query`, as `src/hooks/use-user-details.ts` does.

- **Page query.** Key `['tester-stable-id', 'page']`. `retry: false`, `refetchOnWindowFocus: false`. The query function calls `getActiveIntakeTab()` (`src/lib/tabs.ts`). With no tab, it returns `{ hasTab: false }`. With a tab, it calls `getUserDetails(tab)` and returns `{ hasTab: true, origin, detected, environmentTier }`. `origin` is `new URL(tab.url).origin`. `detected` and `environmentTier` come from the `UserDetails`. If `getUserDetails` throws, the query errors. Treat an errored read on an Intake tab as "no ID found". Keep the origin, so the Tester can still type an ID in. To keep the origin when the read throws, catch the error inside the query function and return `{ hasTab: true, origin }`.
- **Manual query.** Key `['tester-stable-id', 'manual', origin]`, enabled only when `origin` is known. It returns `getManualStableId(origin) ?? null`, because react-query can't hold `undefined`.
- **Shared state.** `saveManualStableId(value)` calls the lib's `saveManualStableId(origin, value)`. Then it writes the trimmed value into the manual query's cache with `queryClient.setQueryData`. `clearManualStableId()` removes the stored ID and sets the cache to `null`. This way every component that calls the hook sees the same typed-in ID. Both functions reject when `origin` is unknown.
- **Resolution.** If there is a detected ID, `stableId` is its value and `source` is its source. If not, and there is a typed-in ID, `stableId` is the typed-in ID and `source` is `'manual'`. Otherwise both are `undefined`.
- **Flags.** `isLoading` is true while the page query has no data yet. `isMissing` is true when the page query has data, `hasTab` is true, and there is no detected ID. With no Intake tab, `isMissing` is false. The popup shows its own off-site panel there (F02). `isRefetching` mirrors the page query's `isRefetching`.
- **`refetch`.** Refetches the page query only.

### 3. `src/components/intake/StableIdFallback.tsx`

`export function StableIdFallback()`. No props. It calls `useTesterStableId()`.

**Render nothing (`null`)** while `isLoading`, or when `isMissing` is false.

**State A: missing, no typed-in ID.** Top to bottom:

1. An alert box: a `div` with `role="alert"`, styled with the theme's destructive tokens (for example `rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm`). Inside:
   - a `TriangleAlert` icon from `lucide-react` (check that the package is already a dependency; don't add one), plus the title **`Stable ID not found`** in medium weight;
   - the body: **`The extension can't read your Stable ID from this page. Reload the page and try again, or enter your Stable ID below.`**;
   - a `Button` (`src/components/ui/button.tsx`), variant `outline`, size `sm`, right-aligned, text **`Try again`**. It calls `refetch()`. It is disabled while `isRefetching`.
2. A `<form>` with:
   - a `Label` (`src/components/ui/label.tsx`) with the text **`Stable ID`**, tied to the input by `htmlFor`/`id`;
   - one row with an `Input` (`src/components/ui/input.tsx`) and a submit `Button` with the text **`Use this ID`**. The input has `autoComplete="off"`, `spellCheck={false}`, and no placeholder. Enter submits the form.
   - Under the row, a hint in muted small text: **`To find it, open DevTools > Application > Local Storage. Copy the value of the key that starts with `** followed by `statsig.stable_id.` inside a `<code>` element, then **`.`**
3. **Validation.** On submit, call `validateManualStableId(input)`. If it fails, don't save. Show the error under the input in destructive small text, set `aria-invalid` on the input, and link the error with `aria-describedby`:
   - `empty`: **`Enter a Stable ID.`**
   - `whitespace`: **`A Stable ID can't contain spaces.`**
   Clear the error when the Tester edits the input.
4. **Save.** If valid, `await saveManualStableId(result.value)`. While it runs, disable the submit button. If it rejects, show **`The Stable ID wasn't saved. Try again.`** in the same error slot. On success the component moves to state B.

Use plain React state for the input and the error. Don't use react-hook-form for one field.

**State B: missing, a typed-in ID is in use.**

- The line **`Using the Stable ID you entered.`**
- The ID in a `CopyableText` (`src/components/ui/copyable-text.tsx`) with a monospace value class.
- A `Button`, variant `outline`, size `sm`, text **`Clear`**. It calls `clearManualStableId()`. Then the component goes back to state A with an empty input.

Don't add any other copy, links, or icons. Use only the existing UI primitives listed above.

### Tests

- `manual-stable-id.test.ts`: validation: trims; empty and whitespace-only give `empty`; an inner space or tab gives `whitespace`. Storage: save then get per origin, two origins kept apart, clear, a non-string stored value reads as `undefined`, and save with an invalid value throws and stores nothing. Mock or fake storage the way the existing tests of `src/lib/storage.ts` users do.
- `use-tester-stable-id.test.tsx`: an `sdk` and a `localStorage` detection give that source and value; a detected ID wins over a stored typed-in ID; no detected ID plus a typed-in ID gives source `manual` (T-OVR-6); `isMissing` when the read finds nothing and when `getUserDetails` throws; no Intake tab gives `isMissing` false and save rejects; the tier passes through; save and clear update a second hook instance that shares the same `QueryClient`; `refetch` calls `getUserDetails` again.
- `StableIdFallback.test.tsx`: renders nothing while loading and when an ID is detected; state A shows the alert, the label, the input, the button, and the hint with the exact copy (T-OVR-6); both validation messages and `aria-invalid`; a padded valid entry saves the trimmed value; state B shows the ID and Clear; Clear returns to state A; Try again calls `refetch`; a failed save shows the save error. Mock `useTesterStableId` for the component tests.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields. If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables *your* changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to `.agents/scratch/<slug>/plan.md`, then build.
- Verify with the commands in the brief. Write results to `.agents/scratch/<slug>/checks.json`.
- If a check fails, fix it and re-run. Report it if it still fails; never report a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

Run (from the worktree root):

- `pnpm vitest run src/lib/manual-stable-id.test.ts src/hooks/use-tester-stable-id.test.tsx src/components/intake/StableIdFallback.test.tsx`
- `pnpm vitest run`
- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`
- `pnpm knip`. The component and hook have no caller until F07-T1, so knip may report them as unused. Report exactly what knip says. Don't add a fake caller and don't edit the knip config.

Another agent edits `src/hooks/use-detected-user.ts` and its test at the same time. If a check fails only in a file outside your `owns:`, wait a minute and re-run once. If it still fails there, report it and don't fix it.

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
