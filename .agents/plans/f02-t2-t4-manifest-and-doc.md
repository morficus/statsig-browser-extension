# Brief: F02-T2 Narrow the manifest and content-script matches, then F02-T4 the permissions doc

slug: f02-t2-t4-manifest-and-doc
status: done
agent: f02-t2-t4-manifest-and-doc (Sonnet, main tree, branch `f02-intake-site-scoping`)

## Decision

The extension may reach only `statsigapi.net` and the Intake Site (REQ-SET-007, REQ-SET-009, REQ-SET-010). Today
`host_permissions` and both content scripts use `<all_urls>` (WL-006). Replace them with the patterns from
`src/lib/intake-site.ts` (`INTAKE_SITE_MATCHES`, built in F02-T1 and already committed), so the patterns stay defined
once (REQ-SET-008). Then rewrite `docs/permissions-justification.md` to match the built manifest (REQ-SET-013).

Two tasks, one agent, in this order: **T2 first, then T4**. T4's check is a line-by-line comparison with the manifest
T2 builds. Tickets: `planning/tickets/F02-intake-site-scoping.md` (F02-T2, F02-T4).

Another agent builds F02-T3 at the same time, in a separate git worktree. It changes `src/lib/tabs.ts`,
`src/handlers/`, `src/hooks/`, `entrypoints/popup/`, and `e2e/`. Don't touch those.

## Owns

```
wxt.config.ts                              # ONLY host_permissions + the import of INTAKE_SITE_MATCHES
entrypoints/content.ts                     # ONLY the `matches` value + the import
entrypoints/statsig-detector.ts            # ONLY the `matches` value + the import
src/tests/unit/content.test.ts             # ONLY a new matches assertion
src/tests/unit/statsig-detector.test.ts    # ONLY a new matches assertion
src/tests/unit/manifest.test.ts            # new
docs/permissions-justification.md          # T4
```

## Intent

### F02-T2

1. **`wxt.config.ts`**
   - `import { INTAKE_SITE_MATCHES } from './src/lib/intake-site'` (relative path; don't rely on the `@/` alias in
     the config file).
   - `host_permissions: ['https://statsigapi.net/*', ...INTAKE_SITE_MATCHES]`. Exactly that order: the API first,
     then the Intake patterns.
   - `permissions` stays `['storage', 'scripting', 'activeTab']`. Don't touch anything else (`key`, name, icons,
     modules, comments).
2. **`entrypoints/content.ts`** and **`entrypoints/statsig-detector.ts`**: `matches: [...INTAKE_SITE_MATCHES]`.
   Import with the `@/src/lib/intake-site` alias, the way `statsig-detector.ts` already imports
   `@/src/lib/get-user-details-injector`. Keep `runAt`, `world`, and everything else as is.
3. **Tests** (regression guards for REQ-SET-007 and REQ-SET-009):
   - In `content.test.ts` and `statsig-detector.test.ts`, add one test each asserting that the content script
     definition's `matches` equals `[...INTAKE_SITE_MATCHES]` and doesn't contain `<all_urls>`. Read how each test
     file loads the entrypoint today (WXT's `defineContentScript` returns the definition object, but the test setup
     may mock it). Use whatever reaches the real definition. If neither file can reach `matches` without restructuring
     the test, don't restructure it. Say so under Deviations.
   - New `src/tests/unit/manifest.test.ts`: import the default export of `wxt.config.ts` and assert that
     `manifest.host_permissions` equals `['https://statsigapi.net/*', ...INTAKE_SITE_MATCHES]` (so exactly 3 entries),
     that `manifest.permissions` equals `['storage', 'scripting', 'activeTab']`, and that
     `JSON.stringify(manifest)` doesn't contain `<all_urls>`. If importing `wxt.config.ts` in Vitest fails for a
     reason you can't fix inside the files you own (don't change `vitest.config.ts`), drop this file and say so under
     Deviations. The built-manifest check below still covers it.
4. **WXT gotcha to check, not assume.** WXT evaluates entrypoint options at build time. Confirm the build resolves the
   imported constant (look at the built manifest; don't trust that it compiled). If WXT can't statically resolve an
   imported `matches`, stop and report. Don't fall back to inlining the strings.

### F02-T4 (after T2 builds clean)

Rewrite `docs/permissions-justification.md` so that every `permissions` entry and every `host_permissions` entry in the
**built** `.output/chrome-mv3/manifest.json` has exactly one justification, and nothing else is justified. Keep the
existing headings and their order (activeTab, Host Permissions, Remote Code, Scripting, Storage, Single Purpose
Description, Data Usage Policy Certification) and the doc's existing tone and format. Use this copy, verbatim apart
from markdown formatting that matches the file:

- **activeTab:** "When the Tester opens the popup, the extension checks the active tab's URL. It reads the page only if
  the URL is an Intake Site page. On any other page the popup shows a message, and the extension doesn't run scripts
  in the page or send it messages."
- **Host Permissions:** a numbered list with exactly three items, in manifest order:
  1. `https://statsigapi.net/*`: keep the existing statsigapi.net justification text as it is.
  2. `https://app.talkiatry.com/assessment*`: "The production Intake Site assessment pages. The content scripts run
     only on these pages, and the extension reads the Statsig SDK state (the current user and the SDK keys) only from
     them."
  3. `https://app.staging.talkiatry.com/assessment*`: "The staging Intake Site assessment pages. Same use as the
     production pages."
- **Remote Code:** "No. All code ships in the extension package: the popup, the background script, the content
  scripts, and the function the popup injects with `scripting.executeScript`."
- **Scripting:** "The popup injects one bundled function into the Intake Site page with `scripting.executeScript`. The
  function reads the Statsig SDK state from the page: the user object, the evaluation context, and the SDK keys. It
  runs only on Intake Site pages."
- **Storage:** keep the current text, unless it names something the code doesn't store. Check it against
  `src/lib/storage.ts`. If it's wrong, don't write new copy. Report the mismatch under Left undone.
- **Single Purpose Description** and **Data Usage Policy Certification:** change only wording that says the extension
  works on any site or any web application ("any web application that uses Statsig" and the like) so that it names
  the Intake Site instead. Also check the "specific local storage keys" claim against
  `src/lib/get-user-details-injector.ts`. If it's accurate (the injector reads `statsig.cached.evaluations.*`), keep it.
  If not, report it under Left undone. Make no other copy changes there. The full rebrand pass is F12-T2.
- Remove every `<all_urls>` reference and every `storage-helper.js` reference.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f02-t2-t4-manifest-and-doc/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f02-t2-t4-manifest-and-doc/checks.json`. Save screenshots to
  `.agents/scratch/f02-t2-t4-manifest-and-doc/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Environment

- Main tree: `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension`, branch `f02-intake-site-scoping`.
- `pnpm` works directly (pnpm 12 via proto, WL-025).
- `.claude/worktrees/` holds agent worktrees, one of them live (F02-T3). They leak into lint and tests (WL-024), so
  always pass the exclusions below. Never edit anything under `.claude/`.
- `pnpm format:check` already flags `new-feature-spec.md`. Not yours. Ignore that one hit and report it.

## Verify

Run, in the main tree:

- `pnpm type-check`
- `pnpm lint --ignore-pattern '.claude/**'`
- `pnpm format:check`: only the known `new-feature-spec.md` hit. Format your files if needed.
- `pnpm test --run --exclude '.claude/**'`
- `pnpm knip`: `src/lib/intake-site.ts` exports are now used. Report anything else it says.
- `pnpm build:chrome`, then read `.output/chrome-mv3/manifest.json` and record in checks.json:
  - `host_permissions` is exactly `["https://statsigapi.net/*","https://app.talkiatry.com/assessment*","https://app.staging.talkiatry.com/assessment*"]`
  - `permissions` is exactly `["storage","scripting","activeTab"]`
  - each `content_scripts[].matches` is exactly the two Intake patterns
  - `grep -c '<all_urls>' .output/chrome-mv3/manifest.json` → `0`
  - list any other key in the manifest that holds a URL pattern (for example `web_accessible_resources`). There
    should be none. Report what you find.
- T4: `grep -nE "all_urls|storage-helper" docs/permissions-justification.md` → no output. Then compare the doc line by
  line with the built manifest: one justification per `permissions` entry and per `host_permissions` entry, nothing
  extra. Record the result as a manual check.
- Don't run `pnpm test:e2e`. The orchestrator runs it after merging F02-T3.

No screenshots.

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

Also paste the final `host_permissions`, `permissions`, and `content_scripts` blocks from the built manifest.
