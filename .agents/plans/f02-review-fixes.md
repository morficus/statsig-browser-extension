# Brief: F02 review fixes: guard hardening and a built-manifest test

slug: f02-review-fixes
status: done
agent: f02-review-fixes (Sonnet, main tree, branch `f02-intake-site-scoping`)

## Decision

The Opus review of F02-T1, F02-T2, and F02-T4 found no way past the URL guard. It found three gaps:

1. `isIntakeSiteUrl` uses `URL.parse`, which doesn't exist before Chrome 126. On older Chrome the guard throws a
   `TypeError` where it should return `false`. Parse with `new URL()` inside `try`/`catch` instead. Don't add
   `minimum_chrome_version`; we keep the manifest surface unchanged.
2. The guard's bypass cases have no regression tests. The reviewer probed them, and they all behave correctly today.
   Lock them in.
3. The unit tests check the WXT config object and the two named entrypoints, not the **built** manifest. A future
   `entrypoints/foo.content.ts` with `matches: ['<all_urls>']` would pass every test. Add a test that reads the built
   `.output/chrome-mv3/manifest.json` and checks it against an allow-list. It goes in `e2e/`, because
   `pnpm test:e2e` runs `pnpm build:chrome` first, so the built manifest is always fresh there.

Another agent builds F02-T3 at the same time in its own git worktree. It changes other files in `e2e/` (`mocks.ts`,
`extension-runtime.ts`, a new `intake-site.e2e.ts`) and in `src/`. Don't touch them.

## Owns

```
src/lib/intake-site.ts
src/lib/intake-site.test.ts
e2e/manifest.e2e.ts          (new)
```

## Intent

### 1. `src/lib/intake-site.ts`

Replace the `URL.parse(url)` call with a small private helper, `function parseUrl(url: string): URL | null`, that
returns `new URL(url)` or `null` if it throws. Write it so it satisfies the repo's lint rules (the original agent hit
`init-declarations`; returning from inside `try` and from `catch` avoids a `let`). Behaviour must not change. Don't
touch anything else in the file.

### 2. `src/lib/intake-site.test.ts`

Add these as `isIntakeSiteUrl` cases, in the existing table style. Group them under a describe or comment such as
"bypass attempts", so their purpose is clear.

Must return `false`:

- `https://app.talkiatry.com@evil.example/assessment` (userinfo, real host is evil.example)
- `https://app.talkiatry.com./assessment` (trailing dot; stricter than Chrome, fails closed)
- `blob:https://app.talkiatry.com/assessment`
- `view-source:https://app.talkiatry.com/assessment`
- `https://app.talkiatry.com/assessment/../login` (normalizes to `/login`)
- `https://xn--pp-8kc.talkiatry.com/assessment` (Cyrillic look-alike, punycode)
- `http://app.talkiatry.com:443/assessment`

Must return `true`:

- `https://app.talkiatry.com:443/assessment` (explicit default port normalizes away)
- `https://evil.example@app.talkiatry.com/assessment` (userinfo, real host is the Intake Site)
- `HTTPS://APP.TALKIATRY.COM/assessment`

Run each case before you add it. If any actual result differs from the expectation above, **don't** change the
expectation or the code. Leave that case out and report it under Deviations, with the real result.

### 3. `e2e/manifest.e2e.ts` (new)

A Playwright spec that needs no browser page. It reads `.output/chrome-mv3/manifest.json`; resolve the path the way
`e2e/extension-runtime.ts` finds the build output. It imports `INTAKE_SITE_MATCHES` from `src/lib/intake-site`, using
whatever import path the other e2e files use for `src/`. If none do, use a relative path. Its assertions, one
`test()` each, named so a failure says what broke:

- `host_permissions` equals `['https://statsigapi.net/*', ...INTAKE_SITE_MATCHES]` exactly (order-insensitive is
  fine).
- `permissions` equals `['storage', 'scripting', 'activeTab']` exactly (order-insensitive is fine).
- every entry of every `content_scripts[].matches` is in `INTAKE_SITE_MATCHES`, and there is at least one content
  script.
- `optional_permissions`, `optional_host_permissions`, `web_accessible_resources`, and `externally_connectable` are
  all absent.
- the manifest JSON contains none of `<all_urls>`, `*://`, `https://*/`, `http://*/`.

Add one short comment at the top: the built manifest is the source of truth for T-SET-1 and REQ-SET-007/009/010. When
F11 adds the optional `debugger` permission, this test changes with it.

Look at how `playwright.config.ts` selects spec files and projects. If a spec with no page fixture needs anything
special, do the minimum and report it.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f02-review-fixes/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f02-review-fixes/checks.json`. Save screenshots to
  `.agents/scratch/f02-review-fixes/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Environment

- Main tree: `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension`.
- Never run `pnpm format` (it rewrites files you don't own). Format only your own files:
  `pnpm exec oxfmt <your files>`.
- `.claude/worktrees/` holds other agents' worktrees. Always use `--ignore-pattern '.claude/**'` (oxlint) and
  `--exclude '.claude/**'` (vitest). Make sure Playwright doesn't pick up specs under `.claude/` either. Check its
  `testDir`, and if it would, run with an explicit path.

## Verify

- `pnpm vitest run src/lib/intake-site.test.ts`
- `pnpm test --run --exclude '.claude/**'`
- `pnpm type-check`
- `pnpm lint --ignore-pattern '.claude/**'`
- `pnpm exec oxfmt --check src/lib/intake-site.ts src/lib/intake-site.test.ts e2e/manifest.e2e.ts`
- `pnpm build:chrome && pnpm exec playwright test e2e/manifest.e2e.ts`: all pass.
- **Negative check:** temporarily add `'<all_urls>'` to `host_permissions` in `wxt.config.ts`, rebuild, and confirm
  the new spec fails. Then **revert `wxt.config.ts` exactly**: `git diff --exit-code wxt.config.ts` must exit 0. This
  is the only time you may edit `wxt.config.ts`. Rebuild and rerun the spec, and confirm it passes again.
- `grep -n "URL.parse" src/lib/intake-site.ts`: no output.

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
