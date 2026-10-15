# Brief: F04-T4 Audit key handling, remote code, and telemetry

slug: f04-t4-audit
status: done (fb187a4, cee1114)
agent: f04-audit (Sonnet, isolated worktree)

## Decision

Before Testers get this extension, we prove (with grep evidence) that the Console Key never leaks and that the
extension runs no remote code and sends no telemetry. Then we fix any gap. Requirements (spec §6.2):

- **REQ-SEC-002**: the key lives only in `browser.storage.local`.
- **REQ-SEC-003**: the key never goes to page storage (`localStorage`/`sessionStorage` of a web page), cookies, the
  DOM of a web page, a content script, or `console.*`. That includes error messages that echo request headers or a
  response body. WL-017: Statsig's documented `401` body contains `Key: console-...`, so any path that shows or logs a
  raw API error body can leak the key.
- **REQ-SEC-004**: saved keys show only their first characters in the UI.
- **REQ-SEC-006**: no `eval`, no `new Function`, no string `setTimeout`/`setInterval`, no remotely loaded script.
- **REQ-SEC-009**: no analytics or telemetry calls; fonts are bundled (`@fontsource`), not loaded from a CDN.

Ticket: `planning/tickets/F04-console-api-hardening.md` (F04-T4). Context: `planning/WORKLOG.md` WL-017, WL-040.

## Owns

```
oxlint.config.ts
src/lib/utils.ts
src/lib/utils.test.ts
src/lib/tabs.ts
src/lib/tabs.test.ts
src/handlers/initial-login.ts
src/handlers/initial-login.test.ts        (create if missing)
entrypoints/content.ts
entrypoints/statsig-detector.ts
src/tests/unit/content.test.ts
src/tests/unit/statsig-detector.test.ts
src/components/sheets/settings/StatsigKeysSettings.tsx
src/components/sheets/settings/StatsigKeysSettings.test.tsx
```

Other agents are editing, in parallel: `entrypoints/background.ts`, `src/lib/fetcher.ts`, `src/lib/api-config.ts`
(one agent), and `src/lib/storage.ts`, `src/lib/projects.ts`, `src/store/**`, `src/hooks/use-projects.ts`,
`src/hooks/use-settings-storage.ts`, `src/components/modals/AuthForm.tsx`,
`src/components/sheets/settings/AddProjectForm.tsx`, `src/components/sheets/settings/ProjectRow.tsx`, and the
override UIs (another agent). **If you find a gap in a file you don't own, do not edit it.** Record it in your audit
file with `path:line`, what leaks or breaks, and the exact fix you propose. The lead routes it.

## Intent

Base commit: before anything else run `git log -1 --format=%H`. It must be
`e409c450eba01a8a1625e36f36082f43447da17a`. If it isn't, stop and report. Then run `pnpm install --frozen-lockfile`.

1. **Audit.** Write `.agents/scratch/f04-t4-audit/audit.md`, one section per requirement above. For each: the exact
   grep commands you ran (over `src`, `entrypoints`, `public`, `wxt.config.ts`, `index.html`/`*.html`, and the built
   `.output/chrome-mv3` after `pnpm build:chrome`), the relevant hits with `path:line`, and a verdict: `pass` or
   `gap`. Things to cover at least:
   - every read of `apiKeyStorage` / `projectsStorage` / `.apiKey` and where the value flows;
   - every `console.` call that could print a key, headers, a request config, or a raw error/response body;
   - every place an API error message reaches the UI: `handleApiError` in `src/lib/utils.ts`, the wretch error path
     in `src/lib/fetcher.ts`, `src/handlers/initial-login.ts`, and the `onError` in `AuthForm.tsx`. For each, can the
     raw `401` body (with `Key: console-...`) reach the screen or the console?
   - every message the content scripts or the MAIN-world detector send or receive: does any carry the key?
   - every place a key is shown in the UI, and how much of it;
   - `eval`, `new Function`, `Function(`, string timers, `import(` of a URL, `<script src=http`, remote `@import`,
     `fonts.googleapis`, `cdn`, analytics/telemetry SDK names (`gtag`, `segment`, `sentry`, `posthog`, `mixpanel`,
     `amplitude`, `datadog`), `navigator.sendBeacon`; and the built manifest's `content_security_policy`.
2. **Lint rules.** In `oxlint.config.ts`, turn on as `'error'`: `no-eval`, `no-new-func`, and `no-implied-eval` if
   oxlint supports it (check `pnpm exec oxlint --rules`). Only the rules; don't touch other settings. Prove they work:
   temporarily add a file with `eval('1')` and `new Function('return 1')`, run `pnpm lint`, record the errors in
   `checks.json`, then delete the file.
3. **Fix gaps in files you own**, each with a unit test that fails before the fix. In particular, if any path you own
   can pass a raw API error body or `error.message` from a failed request to the UI or `console.*`, map it to a fixed
   message instead. Use the existing messages in `handleApiError` where one fits. If you need new user-facing copy,
   **stop and ask**; don't write it.
4. **Saved keys (REQ-SEC-004).** Find where saved keys are displayed. If one shows more than a short prefix and it's
   in a file you own, fix it so it shows the first 12 characters followed by `…`. If it's in a file you don't own
   (likely `ProjectRow.tsx`), record it as a gap for the lead.

Must not:

- Change behavior beyond closing a gap you documented.
- Add dependencies.
- Touch `planning/` (the lead writes the WORKLOG entry from your audit file).

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f04-t4-audit/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f04-t4-audit/checks.json`. Save screenshots to
  `.agents/scratch/f04-t4-audit/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

- `pnpm type-check`
- `pnpm lint`
- the temporary `eval` / `new Function` lint proof (step 2)
- `pnpm format:check` (already flags `new-feature-spec.md`; not yours, ignore that one hit and say so)
- `pnpm vitest run --exclude '.claude/**'`
- `pnpm knip`
- `pnpm build:chrome`

No screenshots. Write `checks.json` with one entry per check.

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

## Audit summary
<one line per requirement: REQ id — pass | gap — evidence path:line. Then each gap in a file you don't own, with the proposed fix.>

## Deviations
<where you did something other than what the brief said, and why — or "none">

## Left undone
<anything in the brief you didn't do, and why — or "nothing">
```

Also give the absolute path of your worktree and of `audit.md`.
