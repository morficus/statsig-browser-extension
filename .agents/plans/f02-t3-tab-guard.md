# Brief: F02-T3 Refuse to read SDK state outside the Intake Site

slug: f02-t3-tab-guard
status: done
agent: f02-t3-tab-guard (Sonnet, isolated git worktree)

## Decision

REQ-SET-014: the extension must not read SDK state from a tab whose URL isn't an Intake Site URL. `activeTab` gives
the popup access to whatever tab the Tester clicks the icon on, so after F02-T2 narrows the manifest, the popup could
still run `scripting.executeScript` on any site. Every page read must first check the tab URL with
`isIntakeSiteUrl` from `src/lib/intake-site.ts` (F02-T1, already committed; read it). On other sites the popup shows
one clear message and reads nothing.

Design (recorded in `planning/WORKLOG.md` WL-027):

- **One guard.** A new `getActiveIntakeTab()` in `src/lib/tabs.ts` is the only way page-reading code gets a tab.
  `getUserDetails` checks again just before `executeScript`, so a future caller can't skip the check. F05 and F09 add
  more page readers later and will reuse this guard.
- **Own panel, not a project-gate state.** Off-site, the popup body shows a new `NotIntakeSitePanel` instead of
  `MainTabs` / `PageProjectGate`. It isn't a `PageProjectGate` status, because that panel offers to pin the current
  site to a project, which is wrong off-site.
- **E2E fakes an Intake URL** (WL-011). The fake active tab becomes `https://app.staging.talkiatry.com/assessment`.

Ticket: `planning/tickets/F02-intake-site-scoping.md` (F02-T3). Recon of the call sites is already done. The facts
below come from it; confirm each one in your own recon.

- `src/lib/tabs.ts`: `getActiveTab()` (returns the tab or `null`), `getActiveTabOrigin()`.
- `src/handlers/get-user-details.ts`: `getUserDetails(tabId)` runs `browser.scripting.executeScript` in the MAIN
  world. Callers: `src/hooks/use-detected-statsig-keys.ts` (`useEffect` on mount) and `src/hooks/use-user-details.ts`
  (React Query `['user-details']`, throws `'No active tab found'`).
- `src/hooks/use-detected-user.ts`: `retryDetection` and `fetchUser` call `browser.tabs.sendMessage(tab.id,
{ type: 'GET_STATSIG_USER' })`, and `fetchUser` retries with backoff.
- `entrypoints/popup/App.tsx:29` renders `isPageMatched ? <MainTabs/> : <PageProjectGate/>`. `Header` and
  `GlobalModals` always render. `isPageMatched` comes from `src/hooks/use-app-logic.ts`.
- `src/hooks/use-active-tab-origin.ts` is the style to copy for a small tab-reading hook.
- `src/components/layout/PageProjectGate.tsx` has `GatePanel` and the `GATE_COPY` icon and title map. It is the visual
  reference for the new panel.
- `e2e/mocks.ts:32-40` holds `ACTIVE_TAB_ORIGIN = 'https://e2e-app.test'` and its doc comment. `mockApi`
  (around L192-204) rewrites `tabs.query` results with `activeTabUrl = ${ACTIVE_TAB_ORIGIN}/`.
  `e2e/extension-runtime.ts:55-80` holds `seedPinnedProject`.

## Owns

```
src/lib/tabs.ts
src/lib/tabs.test.ts
src/handlers/get-user-details.ts
src/handlers/get-user-details.test.ts
src/hooks/use-detected-statsig-keys.ts
src/hooks/use-detected-statsig-keys.test.tsx
src/hooks/use-user-details.ts
src/hooks/use-user-details.test.tsx
src/hooks/use-detected-user.ts
src/hooks/use-detected-user.test.tsx
src/hooks/use-is-intake-site.ts                      (new)
src/hooks/use-is-intake-site.test.tsx                (new)
src/hooks/use-app-logic.ts
src/hooks/use-app-logic.test.tsx
src/components/layout/NotIntakeSitePanel.tsx         (new)
src/components/layout/NotIntakeSitePanel.test.tsx    (new)
entrypoints/popup/App.tsx
entrypoints/popup/App.test.tsx                       (only if it exists)
e2e/mocks.ts
e2e/extension-runtime.ts                             (comments only)
e2e/intake-site.e2e.ts                               (new)
src/**/*.test.ts(x)    ONLY to change a fake tab URL to an Intake URL in a test that fails because of the guard.
                       Nothing else in those files. List each one under Files changed.
                       NOT src/tests/unit/content.test.ts or src/tests/unit/statsig-detector.test.ts
                       (another agent owns them; they test the content scripts, not the popup).
```

Another agent works in the main tree at the same time. It changes `wxt.config.ts`, `entrypoints/content.ts`,
`entrypoints/statsig-detector.ts`, those two content-script tests, a new `src/tests/unit/manifest.test.ts`, and
`docs/permissions-justification.md`. Don't touch any of them.

## Intent

### 1. `src/lib/tabs.ts`

Add:

```ts
/** The active tab, only if it is an Intake Site page (REQ-SET-014); otherwise null. */
export async function getActiveIntakeTab(): Promise<<same tab type getActiveTab returns>>
```

It calls `getActiveTab()` and returns the tab only if `tab.id !== undefined` and `isIntakeSiteUrl(tab.url)`. Otherwise
it returns `null`. Don't change `getActiveTab()` or `getActiveTabOrigin()`. Pinning and matching keep using the
origin.

### 2. `src/handlers/get-user-details.ts`

Change the parameter from a tab id to the tab object (`getUserDetails(tab)`, using the same tab type). If
`tab.id === undefined` or `!isIntakeSiteUrl(tab.url)`, return the same "no details" value the function already
returns on failure (check what that is) **without** calling `executeScript`. Otherwise behave exactly as today with
`target: { tabId: tab.id }`.

### 3. Callers

- `use-detected-statsig-keys.ts`: get the tab with `getActiveIntakeTab()`. If it's `null`, don't call
  `getUserDetails`, and leave `detectedKeys` as is.
- `use-user-details.ts`: get the tab with `getActiveIntakeTab()`. If it's `null`, throw
  `new Error('No Intake Site tab found')` in place of `'No active tab found'`. If any test or UI string matches the
  old message, update the test. Report any UI dependency under Deviations.
- `use-detected-user.ts`: `fetchUser` and `retryDetection` get the tab with `getActiveIntakeTab()`. If it's `null`,
  return at once: no `tabs.sendMessage`, no retries or backoff timers, no `console.error` / `console.warn`. Leave the
  hook state the same as when no user is detected today. Leave the `runtime.onMessage` listener alone. After F02-T2,
  content scripts run only on Intake pages.

### 4. `src/hooks/use-is-intake-site.ts` (new)

`export function useIsIntakeSite(): boolean | undefined`. It is `undefined` until the check resolves, then `true` if
`getActiveIntakeTab()` returned a tab and `false` otherwise (including when `getActiveTab` fails). Copy the structure of
`use-active-tab-origin.ts`, including its unmount handling if it has any.

### 5. `src/hooks/use-app-logic.ts` and `entrypoints/popup/App.tsx`

`useAppLogic` also returns `isIntakeSite` from `useIsIntakeSite()`. In `App.tsx`, the body (the spot that renders
`MainTabs` / `PageProjectGate` today) becomes:

- `isIntakeSite === undefined`: render nothing in the body. `Header` and `GlobalModals` render as today.
- `isIntakeSite === false`: `<NotIntakeSitePanel />`.
- `isIntakeSite === true`: today's `isPageMatched ? <MainTabs /> : <PageProjectGate />`, unchanged.

Don't change `Header`, `GlobalModals`, the login modal flow, or `usePageProject`.

### 6. `src/components/layout/NotIntakeSitePanel.tsx` (new)

Named export `NotIntakeSitePanel`, no props. It must look like a sibling of `GatePanel` in `PageProjectGate.tsx`:
the same outer container, padding, icon size and colour treatment, and title and body typography classes. Reuse
the exact classes; don't invent a new look. Icon: `Globe` from the icon library `GATE_COPY` uses. If that library
isn't `lucide-react`, use its closest globe icon and say so under Deviations.

Copy, verbatim:

- Title (same element and level as the `GatePanel` title): `Not an Intake Site page`
- Body: `Intake Experiment Testing works only on these pages:`
- Then a `<ul>` with one `<li>` per `INTAKE_SITE_MATCHES` entry. Show each pattern with the leading `https://` and the
  trailing `*` removed (`app.talkiatry.com/assessment`, `app.staging.talkiatry.com/assessment`). Derive these from
  the constant; don't hard-code them. Use monospace small text (`font-mono` plus the small text size the panel already
  uses). Plain text, not links.
- Then: `Open one in this tab, then open the extension again.`

### 7. Unit tests

Update the existing tests for the new signatures, and change their fake tab URLs to
`https://app.staging.talkiatry.com/assessment` where a page read is expected. Add:

- `tabs.test.ts`, `getActiveIntakeTab`: returns the tab for a production and a staging Intake URL. Returns `null` for
  a non-Intake URL (`https://example.com/`), a missing `url`, a missing `id`, and no active tab.
- `get-user-details.test.ts`: `executeScript` isn't called for a non-Intake URL, a missing URL, or a missing id. It is
  called with `target: { tabId }` for an Intake URL.
- `use-detected-statsig-keys.test.tsx`: on a non-Intake tab, `executeScript` is never called and `detectedKeys`
  stays `null`.
- `use-user-details.test.tsx`: on a non-Intake tab, `executeScript` is never called and the query errors with
  `'No Intake Site tab found'`.
- `use-detected-user.test.tsx`: on a non-Intake tab, `tabs.sendMessage` is never called by `fetchUser` or
  `retryDetection`, and no retry timers fire (use fake timers to advance past the backoff).
- `use-is-intake-site.test.tsx`: `undefined` first, then `true` for an Intake tab, and `false` for a non-Intake tab
  and for no tab.
- `NotIntakeSitePanel.test.tsx`: renders the title, the body, both page strings, and the footer line.
- `use-app-logic.test.tsx` / `App.test.tsx` (whichever covers rendering): off-site renders the panel and not
  `MainTabs` / `PageProjectGate`; while loading renders neither.

### 8. E2E

- `e2e/mocks.ts`: `ACTIVE_TAB_ORIGIN = 'https://app.staging.talkiatry.com'`. The fake tab URL becomes
  `${ACTIVE_TAB_ORIGIN}/assessment`. Rewrite the doc comment so it also says the URL must be an Intake Site URL,
  because the popup reads only Intake Site tabs (REQ-SET-014). Add an optional override for the fake tab URL to
  `mockApi`, in the smallest shape that fits its existing signature. That shape is your call; report it.
- `e2e/extension-runtime.ts`: update comments only if they mention the old origin.
- New `e2e/intake-site.e2e.ts`, following the style of the existing specs. On `https://example.com/`, with a seeded
  API key, the popup shows the panel title and both page strings, and the main tabs aren't visible (use the locator
  the existing specs use for a main tab).
- The committed test must not write screenshots. Take the screenshots below with a throwaway script, or with a
  temporary line that you delete before you report.

### Must not

- Change anything about pinning, project matching, `usePageProject`, `PageProjectGate`, or the Console API.
- Add dependencies.
- Edit any file not in Owns.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f02-t3-tab-guard/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f02-t3-tab-guard/checks.json`. Save screenshots to
  `.agents/scratch/f02-t3-tab-guard/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Environment

- You are in an isolated git worktree. First check that `src/lib/intake-site.ts` exists and that `git log -1` is
  `51db627` (or a descendant of it). If not, stop and report. Then run `pnpm install --frozen-lockfile`.
- Write your scratch files (`plan.md`, `checks.json`, `shots/`) under `.agents/scratch/f02-t3-tab-guard/` **inside
  your worktree**.
- `pnpm` works directly (pnpm 12 via proto, WL-025).
- Lint and test inside the worktree root. If lint or Vitest pick up files under a `.claude/` folder, pass
  `--ignore-pattern '.claude/**'` (oxlint) or `--exclude '.claude/**'` (vitest).
- Known flaky e2e test (WL-023): "adds a second project, activates it and keeps its client keys" in
  `e2e/projects.e2e.ts`. If it fails, rerun it alone up to 3 times and report the results. Don't fix it.
- `pnpm format:check` already flags `new-feature-spec.md`. Not yours. Ignore that one hit.

## Visual work

The reference is the existing `GatePanel`. Iterate at least 3 times. Each time, compare your panel's screenshot
side by side with `reference-gate.png` (spacing, icon, type sizes, colours) and fix the differences. Do that before
you take the final screenshots. Use the popup viewport the e2e specs already use, and report its size.

Screenshots (in `.agents/scratch/f02-t3-tab-guard/shots/`):

- `reference-gate.png`: the popup on the Intake URL with a project whose key doesn't match the page, so
  `PageProjectGate` shows (see how `e2e/detection.e2e.ts` seeds `origins: []`).
- `not-intake-site.png`: the popup on `https://example.com/` with a seeded API key.
- `not-intake-site-no-key.png`: the popup on `https://example.com/` with no projects (whatever the login flow shows on
  top).
- `intake-site-main.png`: the popup on the default Intake URL with a seeded API key (main tabs visible).

## Verify

Run, inside your worktree:

- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`: only the `new-feature-spec.md` hit
- `pnpm test --run`
- `pnpm knip`
- `pnpm test:e2e`: all pass, apart from the known flaky one. Report it if it flakes.
- `grep -rnE "executeScript|tabs\.sendMessage|getActiveTab\(" src entrypoints --include=*.ts --include=*.tsx | grep -v "\.test\."`:
  paste the output. For each hit, say in one line how the guard covers it, or why it doesn't need to (for example
  `getActiveTabOrigin` reads only the origin, for pinning).

Write `.agents/scratch/f02-t3-tab-guard/checks.json` with one entry per check.

## Report

```
## Done
<one line>

## Files changed
<path> — <what changed>

## Checks
<contents of checks.json>

## Screenshots
<name> — <absolute path>

## Deviations
<where you did something other than what the brief said, and why — or "none">

## Left undone
<anything in the brief you didn't do, and why — or "nothing">
```

Also give the absolute path of your worktree and its `git log -1 --format=%h`.
