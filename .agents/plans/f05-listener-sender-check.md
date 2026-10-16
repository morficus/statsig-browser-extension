# Brief: F05 detection listener accepts only the active Intake tab

slug: f05-listener-sender-check
status: agreed
agent: f05-listener

## Decision

WL-031, item 2. The `runtime.onMessage` listener in `src/hooks/use-detected-user.ts` accepts `STATSIG_USER_FOUND` and `STATSIG_DETECTED_BUT_ERROR` from any sender. The path is dormant today (`statsig-detector` isn't registered, WL-029), and F05 doesn't revive it. The lead decided to close the hole now anyway: the fix is small, and it removes the need for every later change to re-check whether the path came back.

## Owns

```
src/hooks/use-detected-user.ts
src/hooks/use-detected-user.test.ts
```

If `use-detected-user.test.ts` doesn't exist, create it next to the hook.

## Intent

1. The listener takes the second argument, `sender` (`browser.runtime.MessageSender`).
2. Before it acts on a message, it checks the sender:
   - `sender.tab` exists, `sender.tab.id` is a number, and `isIntakeSiteUrl(sender.tab.url)` is true (`src/lib/intake-site.ts`);
   - and `sender.tab.id` is the id of the tab that `getActiveIntakeTab()` (`src/lib/tabs.ts`) returns at that moment.
   If any check fails, ignore the message. Don't log, don't change the store.
3. `getActiveIntakeTab()` is async, and the listener today is sync. Make the check async inside the listener (for example `void handle(message, sender)`). The listener must not return `true` or a promise, because it never answers with `sendResponse`.
4. Parse the message first, as today (`parseDetectionMessage`). Ignore a message that doesn't parse before you query the tab, so unrelated runtime messages don't cost a `tabs.query`.
5. Don't change `fetchUser`, `retryDetection`, `handleResponse`, or the return value of the hook.

### Tests

- A `STATSIG_USER_FOUND` message from the active Intake tab sets the detected user (and context when present) and clears the error.
- A `STATSIG_DETECTED_BUT_ERROR` message from the active Intake tab sets the error.
- Ignored, with no store change: no `sender.tab`; a tab id that isn't the active Intake tab; a non-Intake `sender.tab.url` (for example `https://example.com/`); `getActiveIntakeTab()` returns `undefined`.
- An unparseable message doesn't call `getActiveIntakeTab()`.

Mock `browser` the way existing hook tests in `src/hooks/` do. Read two of them before you write yours.

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

- `pnpm vitest run src/hooks/use-detected-user.test.ts`
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
