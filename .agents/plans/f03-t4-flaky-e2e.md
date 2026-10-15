# Brief: F03-T4 Fix the flaky e2e test "adds a second project, activates it and keeps its client keys"

slug: f03-t4-flaky-e2e
status: agreed
agent: f03-e2e (Sonnet, own worktree `.claude/worktrees/f03-t4-e2e`)

## Decision

`e2e/projects.e2e.ts:63` fails at random. The UI shows "2 client keys", but the test reads `chrome.storage.local`
once, right away, and sometimes gets `clientKeys: []`, because the async storage write hasn't landed yet
(`e2e/projects.e2e.ts:78-80`). Details: `planning/WORKLOG.md` WL-023 (fails about 1 run in 8). The bug is in the test,
not the product: the UI already shows the right value. So fix the test. Wait for storage to hold the expected value
(`expect.poll(...)`, or `expect(async () => ...).toPass()`), and don't read it only once. Ticket:
`planning/tickets/F03-repo-hygiene.md` F03-T4.

Don't add fixed sleeps (`waitForTimeout`), and don't add retries in `playwright.config.ts`. Those hide the race and
don't fix it.

## Owns

```
e2e/**/*.e2e.ts
e2e/*.ts                               # ONLY if a shared storage-read helper is the cleanest fix (see step 3)
```

## Environment

You work in your own worktree:
`/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f03-t4-e2e` (branch
`f03-t4-flaky-e2e`). Run every command from there. Don't `cd` to the main checkout or to any other worktree. `pnpm` is
12.11.2 and works as is. `node_modules` is installed. The Playwright browsers are installed on this machine.

Another agent may run the e2e suite in a different worktree at the same time. If a test fails on a timeout that has
nothing to do with storage reads, run it once more before you report it.

## Intent

1. **Recon.** Read `e2e/projects.e2e.ts` and the helpers it uses to read extension storage. Find how the test reads
   `chrome.storage.local` (for example a helper that calls `serviceWorker.evaluate(...)`).

2. **Fix the WL-023 test.** Replace the one-time storage read that comes after the UI action with a wait for the
   expected stored value. Keep every assertion the test makes now: the same values must be checked, and each check
   must stay as strict as it is now. Use Playwright's default `expect` timeout (don't pass a custom one unless the
   default turns out to be too short, and then say so under "Deviations").

3. **Same pattern elsewhere.** Search every `e2e/**/*.e2e.ts` for storage reads that come right after a UI action
   that writes storage, and that assert on the result once. Fix each one the same way. If three or more places need
   the same wait, a small helper in the file that holds the existing storage helper is fine (for example
   `expectStorage(page, key, matcher)`). Otherwise, change each test inline. List every changed test in the report,
   and list the places you looked at and left alone because the read doesn't race a write.

4. Don't change test names, the product code, `playwright.config.ts`, or tests that have nothing to do with storage
   reads.

## Hard rules

```
- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables *your* changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/<slug>/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/<slug>/checks.json`. Save screenshots to
  `.agents/scratch/<slug>/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.
```

## Verify

Run, in your worktree:

- **Before the fix**, to measure the flake: `pnpm build:chrome`, then
  `pnpm exec playwright test e2e/projects.e2e.ts -g "adds a second project" --repeat-each=20`. Record the failure
  count. If it is 0 of 20, run it once more with `--repeat-each=40`, and record that too. (It is fine if the flake
  doesn't show; the fix is still correct by reasoning, but say so.)
- **After the fix:** `pnpm exec playwright test e2e/projects.e2e.ts -g "adds a second project" --repeat-each=20`
  must give 20 of 20 passes.
- `pnpm exec playwright test e2e/projects.e2e.ts --repeat-each=5` (all tests in the file): 0 failures.
- `pnpm exec playwright test` (the full suite, once): 0 failures.
- `pnpm type-check`, `pnpm lint`, `pnpm format:check` (`new-feature-spec.md` may still fail format:check on this
  branch; ignore that one file and say so).

Write `.agents/scratch/f03-t4-flaky-e2e/checks.json` (inside your worktree) with one entry per run above, with the
pass and fail counts.

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

Also include the final diff of each changed test (`git diff`), since it is short.
