# Brief: F05-T1 page reader, Stable ID order and environment tier

slug: f05-t1-page-reader
status: agreed
agent: f05-t1

## Decision

The extension must reliably know the Tester's Stable ID and the SDK's environment tier (REQ-OVR-004, REQ-OVR-007). It reads both from the page with `scripting.executeScript`, the only detection path that works today (WL-028, WL-029). The content-script `postMessage` path stays dormant. Do not revive it.

The page is the MAIN world, so the page's own scripts can change what the SDK returns. Treat the injected result as untrusted input on the extension side.

The lead already committed the contract (do not change it):

- `src/types/statsig/sdk.ts`: `StableIdSource = 'localStorage' | 'sdk'` and `PageStableId { source; value }`.
- `src/handlers/get-user-details.ts`: `UserDetails` has `stableId?: PageStableId` and `environmentTier?: string`.

Another agent is building a hook on top of `UserDetails.stableId` and `UserDetails.environmentTier` at the same time. Keep those two fields exactly as typed.

## Owns

```
src/lib/get-user-details-injector.ts
src/lib/get-user-details-injector.test.ts
src/handlers/get-user-details.ts
src/handlers/get-user-details.test.ts
```

`src/types/statsig/sdk.ts` is read-only (the lead owns the contract). `entrypoints/statsig-detector.ts` calls the injector; it is read-only, and it must still type-check.

## Intent

### Injector: `getUserDetailsFromPage` (`src/lib/get-user-details-injector.ts`)

Spec §7 rule 3: the function stays self-contained. No imports of values and no module-level values. Type-only imports are fine. Every helper is declared inside the function.

1. **Stable ID lookup order.**
   1. The SDK instance lookups, exactly as today and in today's order: `getStableID()`, `getContext().stableID`, the `__STATSIG__.firstInstance.getContext()` fallback, `_stableID`, `identity.stableID`. Any hit is source `sdk`.
   2. If none of those gives a non-empty string, read `localStorage`. Walk the keys in index order. Take the first key that **starts with** `statsig.stable_id.` and that has a usable value. The number at the end of the key changes, so never match the full key. Source `localStorage`.
   3. Never read `document.cookie`.
2. **localStorage value.** The JS SDK writes the ID as a JSON string (for example the raw value is `"abc"` with the quotes). Parse it with `JSON.parse`. If the result is a string, use it. If `JSON.parse` throws, use the raw value. Trim the result. Skip the key if the trimmed value is empty or not a string, and go on to the next matching key. If `localStorage` throws (blocked or sandboxed), there is no localStorage ID.
3. **No SDK instance.** Today the function returns `null` when it finds no instance. Change this: if there is no instance but step 1.2 finds an ID, return a result with `user: { stableID }`, the `stableId`, and the `href`, and no `context`, `keys`, or tier. Return `null` only when there is no instance and no localStorage ID.
4. **`user.stableID`.** Set `user.stableID` to the found ID whatever its source, as today.
5. **Environment tier.** Read `context.options.environment.tier` from the `context` the function already gets (`instance.getContext()`). Use `isRecord` checks at each level. Return it as `environmentTier` only if it is a non-empty string. Otherwise leave the field out.
6. **`href`.** Return `href: globalThis.location.href` on every non-null result.
7. **Result shape.** `{ href, user, context?, keys?, stableId?, environmentTier? }`. `stableId` is `{ source, value }`. Leave optional fields out instead of setting them to `undefined`, as the function does today with `keys`.

### Handler: `getUserDetails` (`src/handlers/get-user-details.ts`)

WL-031, item 1: the second URL check re-checks the same `tabs.query` snapshot, so a same-origin navigation between the check and `executeScript` slips through. Fix it with the `href` the page reports.

1. In `readPage`, after `executeScript`, drop the whole result (return `undefined`) unless `href` is a string and `isIntakeSiteUrl(href)` is true.
2. Don't pass `href` on. `UserDetails` does not get an `href` field.
3. Sanitize the two new fields, because the page can tamper with them:
   - Keep `stableId` only if `source` is `'sdk'` or `'localStorage'` and `value` is a string that is not empty after trimming. Pass the trimmed value. Otherwise leave `stableId` out.
   - Keep `environmentTier` only if it is a non-empty string. Otherwise leave it out.
4. Keep everything else as it is: the `isReadable` check before injection, the `about:blank` handling, and the `console.error` path.

### Tests

- `get-user-details-injector.test.ts`: one test per lookup step. Include: `getStableID()` wins over localStorage; `getContext().stableID`; the `firstInstance` fallback; `_stableID`; `identity.stableID`; an empty SDK ID falls through to localStorage; a localStorage key `statsig.stable_id.123` and a different number `statsig.stable_id.98765`; a JSON-encoded value and a raw value; an empty value skips to the next matching key; a key that only contains the prefix in the middle (`x.statsig.stable_id.1`) is not matched; localStorage that throws; no instance plus a localStorage ID; no instance and no ID returns `null`; a cookie with a Stable ID is ignored. Source is `sdk` or `localStorage` in each case. Tier present, tier missing, tier not a string, `options` missing. `href` is returned. Keep all existing tests passing; update their expected objects only where the new `href` field requires it.
- `get-user-details.test.ts`: the result is dropped when `href` is not an Intake Site URL (for example `https://app.staging.talkiatry.com/login`) and when `href` is missing; it is kept for an Intake URL; `href` is not in the returned object; a tampered `stableId` (wrong source, number value, blank value) is dropped; a padded value is trimmed; a non-string or blank tier is dropped.

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

- `pnpm vitest run src/lib/get-user-details-injector.test.ts src/handlers/get-user-details.test.ts`
- `pnpm vitest run`
- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`

Other agents edit other files in the same worktree at the same time. If `type-check`, `lint`, or a test fails only in a file outside your `owns:`, wait a minute and re-run once. If it still fails there, report it and don't fix it.

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
