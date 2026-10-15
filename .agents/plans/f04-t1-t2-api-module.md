# Brief: F04-T1 + F04-T2 One API module with a host allowlist and a write allowlist

slug: f04-t1-t2-api-module
status: done (6e255cf, 5335e4d)
agent: f04-api (Sonnet, isolated worktree)

## Decision

The Console Key may only ever reach the Statsig Console API, and only the override write calls may be made
(spec REQ-SEC-001, REQ-SEC-005, REQ-SEC-007, REQ-SEC-008). Today `entrypoints/background.ts` fetches any `config.url`
it receives in an `API_REQUEST` message and attaches the key to it (WL-005). We fix that in the background script,
because it is the one place that holds the key and talks to the network. All policy (base URL, version header, which
URLs and write calls are allowed) lives in **one new module, `src/lib/api-config.ts`**, so a later move to a proxy
changes only that file (REQ-SEC-005).

Ticket: `planning/tickets/F04-console-api-hardening.md` (F04-T1, F04-T2). Context: `planning/WORKLOG.md` WL-005,
WL-014, WL-016 (the endpoint list), WL-018 (version header), WL-042 (decisions for this work).

This brief has **two phases**. Do phase 1, verify, report, and **stop**. The lead commits phase 1 and then messages you
to do phase 2 in the same worktree.

## Owns

```
src/lib/api-config.ts            (new)
src/lib/api-config.test.ts       (new)
src/lib/fetcher.ts               (only: move the base URL constant out; import it from api-config)
src/lib/fetcher.test.ts
entrypoints/background.ts
src/tests/unit/background.test.ts
```

Other agents are working in parallel on other files (`src/lib/storage.ts`, `src/lib/projects.ts`, settings store,
forms, `oxlint.config.ts`, `src/lib/utils.ts`). Do not edit them. You may **read** `apiKeyTypeStorage` from
`src/lib/storage.ts` as it exists today (`local:api_key_type`, `'write-key' | 'read-key'`, fallback `'write-key'`);
another agent will keep it in sync with the active project.

## Intent

Base commit: before anything else run `git log -1 --format=%H`. It must be
`e409c450eba01a8a1625e36f36082f43447da17a`. If it isn't, stop and report. Then run `pnpm install --frozen-lockfile`.

### Phase 1: F04-T1

1. **`src/lib/api-config.ts`** (new). Exports:
   - `API_BASE_URL = 'https://statsigapi.net/console/v1'`: moved here from `src/lib/fetcher.ts`. This becomes the
     **only** place the string `statsigapi.net` appears in non-test code under `src/` and `entrypoints/`.
   - `STATSIG_API_VERSION = '20240601'`.
   - `isAllowedApiUrl(url: string): boolean`. Parse with `new URL(url)`; return `false` if parsing throws.
     Allowed only when **all** hold: the protocol and host equal the protocol and host of `API_BASE_URL`, there's no
     username or password, there's no explicit non-default port, and the pathname is exactly the base pathname or
     starts with the base pathname followed by `/`. Do **not** use a bare `url.startsWith(API_BASE_URL)`. It must
     reject `https://statsigapi.net.evil.com/...`, `https://statsigapi.net/console/v1evil`, `http://statsigapi.net/console/v1/x`,
     `https://user:pw@statsigapi.net/console/v1/x`, `https://statsigapi.net/console/v2/x`, and relative URLs.
   - A short top-of-file comment: this module is the single source of the Console API policy (REQ-SEC-005).
2. **`src/lib/fetcher.ts`**: delete its `API_BASE_URL` definition and import it from `api-config`. If other files
   import `API_BASE_URL` from `fetcher`, re-export it from `fetcher` (`export { API_BASE_URL } from './api-config'`)
   rather than editing those files. Change nothing else in `fetcher.ts`.
3. **`entrypoints/background.ts`**, `API_REQUEST` handler:
   - Check `isAllowedApiUrl(url)` **before** reading the key from storage. If it fails, do not read the key, do not
     call `fetch`, and respond `{ success: false, error: 'This request isn\'t allowed by Intake Experiment Testing.' }`
     (same response shape as the existing network-error branch).
   - On allowed requests, keep the existing key logic, and also set the header `STATSIG-API-VERSION` to
     `STATSIG_API_VERSION` unless the caller already set it.
   - Pass `redirect: 'error'` to `fetch`, so a redirect can never carry the key to another host.
   - Never log the key, the headers, or the request body.
4. **Tests.**
   - `src/lib/api-config.test.ts`: every accept/reject case listed in step 1, plus the base URL itself and a normal
     path like `${API_BASE_URL}/gates/my_gate/overrides`.
   - `src/tests/unit/background.test.ts`: a request to another host (for example `https://evil.example/x`) gets the
     error response, `fetch` is not called, and the key storage is not read. Allowed requests send
     `STATSIG-API-VERSION: 20240601` and `redirect: 'error'`. Update existing expectations that assert the exact
     `fetch` init so they include the new fields. Replace literal `https://statsigapi.net/...` strings in tests with
     `API_BASE_URL` where it's a straightforward swap.

### Phase 2: F04-T2 (only after the lead messages you)

The tree will have your phase 1 work in it (committed in the lead's branch; still uncommitted in yours). Build on it.

1. **`src/lib/api-config.ts`**: add `isAllowedApiRequest(method: string | undefined, url: string): boolean`.
   - `false` if `isAllowedApiUrl(url)` is `false`.
   - Method is case-insensitive; `undefined` means `GET`. `GET` on an allowed URL → `true`.
   - Any other method → `true` only if `(method, path)` matches the list below. `path` is the URL pathname with the
     base pathname removed. `{id}` and `{userID}` each match exactly one non-empty path segment (no `/`). Query
     strings don't affect matching. A trailing slash doesn't match.

     ```
     PATCH  /experiments/{id}/overrides
     DELETE /experiments/{id}/overrides/userID/{userID}
     PATCH  /layers/{id}/overrides
     DELETE /layers/{id}/overrides/userID/{userID}
     POST   /gates/{id}/overrides
     DELETE /gates/{id}/overrides
     POST   /experiments/{id}/overrides      # base experiment modal, kept until Q4 is decided (WL-042)
     DELETE /experiments/{id}/overrides      # base experiment modal, kept until Q4 is decided (WL-042)
     ```

     Write it as one exported, readable list (data, not a chain of `if`s), with those two comments on the last two
     entries.
   - Before writing the list, confirm from `src/handlers/gate-overrides.ts` and `src/handlers/experiment-overrides.ts`
     which exact method + path the base code sends. If any base call is not on the list above, **stop and report**;
     don't add it.
2. **`entrypoints/background.ts`**: replace the `isAllowedApiUrl` check with `isAllowedApiRequest(method, url)`, same
   refusal (no key read, no fetch, same error). Then, for a non-GET request that passed, read `apiKeyTypeStorage`; if
   it is `'read-key'`, refuse with `{ success: false, error: 'Read-only key. Add a key with write access to change overrides.' }`
   and don't fetch. GET requests must not wait on or depend on the key type.
3. **Tests.**
   - `api-config.test.ts`: each allowed entry passes; for each, a near miss is refused (wrong method, extra segment,
     missing segment, trailing slash, `PUT`). Plus `POST /gates` (no id), `POST /experiments`, `DELETE /layers/{id}`,
     `POST /audit_logs`. A test that the exact calls made by `src/handlers/gate-overrides.ts` and
     `src/handlers/experiment-overrides.ts` pass (build the URLs the same way they do).
   - `background.test.ts`: a refused write makes no `fetch` call; an allowed write with `read-key` makes no `fetch`
     call and returns the read-only error; an allowed write with `write-key` calls `fetch`; a GET with `read-key` still
     calls `fetch`.

Must not:

- Change any handler, hook, component, or the wretch setup beyond the constant import.
- Add dependencies.
- Change user-facing copy other than the two error strings given verbatim above.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f04-t1-t2-api-module/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f04-t1-t2-api-module/checks.json`. Save screenshots to
  `.agents/scratch/f04-t1-t2-api-module/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

Run in your worktree after each phase:

- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check` (it already flags `new-feature-spec.md`; that file isn't yours, ignore that one hit and say so)
- `pnpm vitest run --exclude '.claude/**'`
- `pnpm knip`
- `pnpm build:chrome`
- `grep -rn "statsigapi.net" src entrypoints --exclude='*.test.*' --exclude-dir=tests` → exactly one hit, in
  `src/lib/api-config.ts`.

No screenshots. Write `checks.json` with one entry per check (overwrite it in phase 2).

## Report

```
## Done
<one line>

## Files changed
<path> — <what changed>   (list every changed or added file; the lead copies exactly these)

## Checks
<contents of checks.json>

## Screenshots
none

## Deviations
<where you did something other than what the brief said, and why — or "none">

## Left undone
<anything in the brief you didn't do, and why — or "nothing">
```

Also give the absolute path of your worktree.
