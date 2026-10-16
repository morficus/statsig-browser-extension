# Brief: F06-T5 Specific error messages for write failures

slug: f06-t5-error-messages
status: done (e292060)
agent: f06-t5 (Sonnet, shared F06 worktree)

## Decision

Each write action must show a specific message for a bad key (401), a key without permission (403), the rate limit (429), and no network (REQ-OVR-016). Phase 0 found that `401` has two meanings (WL-055): a bad key gets the plain-text body `Unauthorized`, and a read-only key's write gets the JSON body `{"message":"Read only API keys can not modify entities","status":401}`. So the mapper must check the body, and must not expect JSON. Today a failed `fetch` in the background script comes back as a generic `TypeError`, the same as other background failures, so "no network" can't be told apart. WL-059 decided the copy and a `NetworkError` marker.

All override handlers use `handleApiError(error: unknown): string`. Keep that signature, so callers don't change. Another agent writes new handlers at the same time and relies on it.

Context: `planning/WORKLOG.md` WL-017, WL-042, WL-046, WL-055, WL-059.

## Owns

```
src/lib/utils.ts
src/lib/utils.test.ts
src/lib/fetcher.ts
src/lib/fetcher.test.ts
entrypoints/background.ts
src/tests/unit/background.test.ts
```

## Intent

**Copy (verbatim, from WL-059):**

| Case | Message |
| --- | --- |
| `401`, any body except the read-only JSON | `The Console Key is not valid. Check the key, then try again.` |
| `401`, the body is an object whose `message` is a string that matches `/read[\s-]?only/iu` | `Read-only key. Add a key with write access to change overrides.` |
| `403` | `The Console Key is not allowed to do this. Ask someone from engineering for help.` |
| `429` | `Too many changes in Statsig right now. Wait a few minutes, then try again.` |
| `NetworkError` | `Cannot reach Statsig. Check your network connection, then try again.` |

`404` (`The requested resource was not found.`), `>= 500` (`Server error. Please try again later.`), and the fallback keep their current text and behavior. The old 401 and 403 strings go.

**`src/lib/utils.ts`:**

- Add `export class NetworkError extends Error` with `name` set to `'NetworkError'`. (Follow oxlint's rules for custom errors.)
- `handleApiError(error: unknown): string`, in this order:
  1. `error instanceof NetworkError` → the network message.
  2. A wretch error (the existing `isWretchError`): map by `error.status` **even when `response._data` is empty, undefined, or a string**. `401` checks `response._data` for the read-only object (see the table). Don't `JSON.parse` anything: the background script already parsed JSON bodies into objects and left text as a string. `403`, `429`, `404`, and `>= 500` map as in the table. Any other status keeps today's behavior: the redacted `message` or `error` from an object payload, else the redacted `error.message`.
  3. Any other `Error` → the redacted `error.message` (unchanged).
  4. Anything else → `'An unknown error occurred'` (unchanged).
- Keep `redactConsoleKeys` on every server- or error-provided string, as today.

**`src/lib/fetcher.ts`:** add `networkError?: boolean` to `ExtMessageResponse`. In `customFetch`, when `!response.success` and `response.networkError === true`, throw `new NetworkError(response.error ?? 'Network error')`. Every other failure stays a `TypeError`, as today. Import `NetworkError` from `@/src/lib/utils`. Change nothing else.

**`entrypoints/background.ts`:** in the `.catch` of the `fetch` (the one that today sends `{ error: errorMessage, success: false }`), also send `networkError: true`. Nothing else changes. The URL refusal and the read-only refusal don't get the flag.

**Check the whole path.** Confirm in a test that a background `{ success: false, error: 'Failed to fetch', networkError: true }` reaches a caller of `api`/`fetcher` as an error for which `handleApiError` returns the network message. If wretch wraps the thrown error so that `instanceof NetworkError` fails, handle that in `handleApiError` (check `error.cause` too) and say so under Deviations.

**Tests.**

- `utils.test.ts`: one test per row of the table: 401 with the string body `'Unauthorized'`, 401 with no body, 401 with the read-only JSON object, 401 with an object whose `message` doesn't say read only (→ not valid), 403, 429, `NetworkError`. Keep the 404 and 5xx tests. The fallback: a status like 418 with an object `message` that holds a `console-…` key → the redacted message; a plain `Error`; a non-error value → `'An unknown error occurred'`. Update the existing tests that assert the old 401 and 403 strings.
- `fetcher.test.ts`: `networkError: true` → rejects with a `NetworkError`; `success: false` without the flag → still a `TypeError`; the end-to-end path above.
- `background.test.ts`: a rejected `fetch` → the response has `networkError: true` and `success: false`; the URL refusal and the read-only refusal don't have `networkError`.

## Verify

Run:
- `pnpm vitest run src/lib/utils.test.ts src/lib/fetcher.test.ts src/tests/unit/background.test.ts`
- `pnpm type-check` (errors in files you don't own: list them, don't fix)
- `pnpm exec oxlint <your files>`
- `pnpm exec oxfmt --check <your files>`

Don't run `pnpm build:chrome`. The lead builds after the wave lands.

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
