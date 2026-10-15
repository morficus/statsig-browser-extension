# Brief: F02-T1 Intake Site URL config module

slug: f02-t1-intake-site-module
status: done
agent: f02-t1-intake-site-module (Sonnet, main tree, branch `f02-intake-site-scoping`)

## Decision

The extension may touch only the Intake Site (spec REQ-SET-007 to REQ-SET-009, REQ-SET-014). The two Intake Site
URL patterns must be defined **once** (REQ-SET-008) and used everywhere else: the manifest `host_permissions`, both
content-script `matches`, and the runtime "is this tab an Intake Site?" check. The product owner may widen the patterns
later, so the runtime check must be **derived from the pattern strings**, not hard-coded hostnames. Change the
constant, and the manifest and the runtime check both follow.

`wxt.config.ts` will import this module (that's F02-T2, not you). WXT loads its config in Node, so the module must
have **no imports at all**: no `wxt/*`, no `@/` alias, no `browser` global, no npm packages.

Ticket: `planning/tickets/F02-intake-site-scoping.md` (F02-T1). Later tasks (F02-T2, F02-T3) wire the module in. You
only create it.

## Owns

```
src/lib/intake-site.ts         (new)
src/lib/intake-site.test.ts    (new)
```

## Intent

### `src/lib/intake-site.ts`

Exports exactly these three names, nothing else:

```ts
export const INTAKE_SITE_MATCHES = [
  'https://app.talkiatry.com/assessment*',
  'https://app.staging.talkiatry.com/assessment*',
] as const

export function matchesUrlPattern(url: URL, pattern: string): boolean

export function isIntakeSiteUrl(url: string | null | undefined): boolean
```

**`matchesUrlPattern(url, pattern)`** is a small Chrome match-pattern matcher for the subset we use:
`<scheme>://<host><path>`.

- `scheme` is `https` or `http` and must equal `url.protocol` without the colon. Any other scheme in the pattern
  (including `*`) → the pattern is unsupported → return `false`.
- `host` is either an exact hostname (`app.talkiatry.com`), which must equal `url.hostname`, or `*.` + a hostname
  (`*.talkiatry.com`), which matches that hostname itself **and** any subdomain of it (Chrome semantics:
  `*.talkiatry.com` matches `talkiatry.com` and `a.b.talkiatry.com`, but not `eviltalkiatry.com`). A bare `*` host
  or a `*` anywhere else in the host → unsupported → `false`. Compare hostnames case-insensitively (the `URL` parser
  already lower-cases `url.hostname`; lower-case the pattern host).
- `url.port` must be `''` (the scheme's default port). A URL with an explicit non-default port never matches. This is
  deliberately stricter than Chrome; the runtime check is a security guard.
- `path` starts with `/`. Each `*` matches any run of characters (including none); every other character matches
  itself, case-sensitively. The whole path must match (anchored at both ends). Match it against
  `url.pathname + url.search`. The hash is ignored. Username and password are ignored.
- A pattern string that doesn't parse into those three parts (for example missing `://`, empty host, path not
  starting with `/`) → `false`. Never throw.
- Build the path regex by escaping every regex metacharacter except `*`, then turning `*` into `.*`.

**`isIntakeSiteUrl(url)`** returns `true` only if `url` is a non-empty string that `new URL()` parses **and** it
matches at least one entry of `INTAKE_SITE_MATCHES`. `null`, `undefined`, `''`, and unparseable strings → `false`.
Never throw.

Add one short file-header comment (2 to 4 lines) saying: this is the single source of the Intake Site URL patterns
(REQ-SET-008); the manifest and the runtime check both use it; `wxt.config.ts` imports it, so the module must stay
import-free. A one-line JSDoc on each export is enough. No other comments.

Match the repo style (look at `src/lib/djb2.ts`, `src/lib/utils.ts`): named function declarations, no default
export, no classes.

### `src/lib/intake-site.test.ts`

Vitest, co-located, same style as `src/lib/djb2.test.ts` / `src/lib/tabs.test.ts`. Use `it.each` tables where it
helps. Cover at least:

`isIntakeSiteUrl` → `true`:

- `https://app.talkiatry.com/assessment`
- `https://app.staging.talkiatry.com/assessment`
- `https://app.talkiatry.com/assessment/step-2`
- `https://app.talkiatry.com/assessment?utm_source=x&step=3`
- `https://app.talkiatry.com/assessment/step-2?x=1#section`
- `https://app.talkiatry.com/assessments` (the `*` glob matches this, same as Chrome; name the test so this is
  clearly intended)
- `https://APP.TALKIATRY.COM/assessment` (host case)

`isIntakeSiteUrl` → `false`:

- `http://app.talkiatry.com/assessment` (`http:`)
- `https://app.talkiatry.com/`, `https://app.talkiatry.com/login`, `https://app.talkiatry.com/Assessment` (path)
- `https://talkiatry.com/assessment`, `https://www.talkiatry.com/assessment`,
  `https://dev.app.talkiatry.com/assessment`, `https://app.talkiatry.com.evil.example/assessment`,
  `https://evil.example/assessment`, `https://evil.example/?next=https://app.talkiatry.com/assessment`,
  `https://evil.example/#https://app.talkiatry.com/assessment` (other hosts)
- `https://app.talkiatry.com:8443/assessment` (explicit port)
- `chrome-extension://abcdefghijklmnop/popup.html`, `about:blank`, `file:///assessment` (other schemes)
- `''`, `'not a url'`, `'app.talkiatry.com/assessment'`, `undefined`, `null` (invalid)

`matchesUrlPattern`:

- every entry of `INTAKE_SITE_MATCHES` matches its own canonical URL (the pattern with the trailing `*` removed).
  This guards against a typo in the constant.
- `*.talkiatry.com` host: matches `https://talkiatry.com/x`, `https://a.b.talkiatry.com/x`; doesn't match
  `https://eviltalkiatry.com/x`.
- path globs: `https://example.com/a*b` matches `/ab`, `/a-x-b`, not `/a-x-bc`; `https://example.com/a.b` doesn't
  match `/aXb` (dot is literal); `https://example.com/*` matches `/` and `/anything?q=1`.
- unsupported or malformed patterns return `false` without throwing: `*://example.com/*`, `https://*/*`,
  `https://ex*ample.com/*`, `<all_urls>`, `https://example.com`, `''`.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f02-t1-intake-site-module/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f02-t1-intake-site-module/checks.json`. Save screenshots to
  `.agents/scratch/f02-t1-intake-site-module/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Environment

- Work in the main tree, `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension`, on branch
  `f02-intake-site-scoping`. Another agent may be editing `docs/` at the same time. Don't touch it.
- `pnpm` is pnpm 12 via proto and works directly (WL-025).
- `.claude/worktrees/` holds stale agent worktrees that leak into lint and tests (WL-024). Always pass the exclusions
  shown below.
- `pnpm format:check` already flags `new-feature-spec.md`. That file isn't yours. Ignore that one hit and report it.

## Verify

Run:

- `pnpm vitest run src/lib/intake-site.test.ts`
- `pnpm test --run --exclude '.claude/**'` (full unit suite, nothing else broken)
- `pnpm type-check`
- `pnpm lint --ignore-pattern '.claude/**'`
- `pnpm exec oxfmt --check src/lib/intake-site.ts src/lib/intake-site.test.ts` (or `pnpm format:check` and confirm
  your two files aren't listed); run the formatter on your two files if needed
- `pnpm knip`: no new findings for `src/lib/intake-site.ts`. Before F02-T2 and F02-T3 wire it in, knip may report
  `INTAKE_SITE_MATCHES` / `isIntakeSiteUrl` as unused exports, or the file as unused. That's expected; report
  exactly what it says.
- `grep -nE "^import|require\(" src/lib/intake-site.ts` → no output.

No screenshots.

Write `.agents/scratch/f02-t1-intake-site-module/checks.json` with one entry per check.

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
