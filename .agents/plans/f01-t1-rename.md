# Brief: F01-T1 Rename the product

slug: f01-t1-rename
status: agreed
agent: f01-t1-rename (Sonnet, isolated worktree)

## Decision

The extension becomes "Intake Experiment Testing" (spec REQ-SET-003, REQ-SET-004). "Statsig" must not be the
product name anywhere in the shipped extension. "Statsig" stays where it names the service the extension talks to
(for example "Statsig Console API key", "Statsig project"). This task changes only the product name in the shipped
extension and `package.json`. Docs (README, CONTRIBUTING), the `web/` landing page, and CI are other tickets; leave
them alone. Ticket: `planning/tickets/F01-rebrand-chrome-only.md` (F01-T1). Decision record: `planning/WORKLOG.md`
WL-020.

Two other agents work on F01 at the same time in other worktrees. F01-T2 removes Firefox (it edits the
`browser_specific_settings` block, the `key` spread, and the `manifest: ({ browser }) =>` signature in
`wxt.config.ts`, and the `scripts` in `package.json`). F01-T3 changes the `CRX_PUBLIC_KEY` value. Do not touch any
of those parts, so the three changes merge cleanly.

## Owns

```
wxt.config.ts                         # ONLY the manifest `name`, `action.default_title`, `description` values
package.json                          # ONLY the top-level `name` and `description` values
entrypoints/popup/index.html
src/components/layout/Header.tsx
src/components/layout/Header.test.tsx
src/assets/statsig_full.png           # delete only if nothing imports it after your change
src/**                                # ONLY to change the "[Statsig Extension]" log prefix and the tests that assert it
e2e/**/*.spec.ts                      # ONLY if a spec asserts the old name, the old <title>, or the "Statsig" logo alt text
```

## Environment

The global `pnpm` on this machine can't switch to the pinned pnpm 12.11.2. Start **every** Bash command with:

```
export PATH=/private/tmp/claude-501/-Users-maurice-Dev-Workspace-talkiatry-statsig-browser-extension/c22fe54b-4f5b-4e11-83e9-d7394987bb63/scratchpad/bin:$PATH;
```

That puts a shim first on `PATH` that runs pnpm 12.11.2. Without it, `pnpm` fails with `ENOEXEC`. Don't try to fix the
global pnpm. Baseline on this branch: type-check, lint, knip, and 653 unit tests pass. `pnpm format:check` already
flags `new-feature-spec.md`; that file is not yours, so ignore that one hit and report it.

## Intent

You are in an isolated git worktree. First run `pnpm install --frozen-lockfile`.

1. **Manifest** (`wxt.config.ts`):
   - `name: 'Intake Experiment Testing'`
   - `action.default_title: 'Intake Experiment Testing'`
   - `description: 'Spot-test Statsig experiments on the Intake Site: see your groups, force yourself into a group, and take screenshots.'`
     (117 characters; Chrome's limit is 132. Use this text verbatim.)
2. **`package.json`**:
   - `"name": "intake-experiment-testing"`
   - `"description"`: the same text as the manifest description, verbatim.
   - Do not change `keywords`, `version`, `homepage`, `bugs`, `author`, `repository`, `license`, or anything else.
3. **Popup HTML** (`entrypoints/popup/index.html`): `<title>Intake Experiment Testing</title>`.
4. **Header** (`src/components/layout/Header.tsx`): replace the Statsig logo `<img src={statsigLogo} alt="Statsig" … />`
   with a text wordmark:
   `<span className="text-sm leading-none font-semibold whitespace-nowrap">Intake Experiment Testing</span>`.
   Keep the version badge and `<ProjectStatus />` exactly as they are, in the same order. Remove the now-unused
   `statsigLogo` import. If no other file in the repo (including `web/`, `e2e/`, `docs/`) imports or references
   `src/assets/statsig_full.png`, delete that file; otherwise keep it.
5. **Header test** (`src/components/layout/Header.test.tsx`): the test `renders the Statsig wordmark and version`
   becomes `renders the product name and version`. It asserts `screen.getByText('Intake Experiment Testing')` is in
   the document, `screen.queryByAltText('Statsig')` is `null`, and the version assertion stays as it is.
6. **Log prefix:** every `[Statsig Extension]` prefix in `src/` and `entrypoints/` becomes `[Intake Experiment Testing]`
   (known: `src/hooks/use-detected-user.ts`, `src/lib/tabs.ts`, `src/lib/tabs.test.ts`; grep for others). Update
   tests that assert the old prefix.
7. Any e2e spec that asserts the old name, title, or logo alt text: update it to the new name. If none do, touch
   nothing in `e2e/`.

Must not:
- Change "Statsig" where it names the service (labels, API key text, Statsig project wording, API URLs).
- Touch `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/`, `web/`, `.github/`,
  `sonar-project.properties`, `planning/`, `new-feature-spec.md`.
- Touch the Firefox parts of `wxt.config.ts` / `package.json` scripts (F01-T2) or `CRX_PUBLIC_KEY` (F01-T3).

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f01-t1-rename/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f01-t1-rename/checks.json`. Save screenshots to
  `.agents/scratch/f01-t1-rename/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

Run (in your worktree):

- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test --run`
- `pnpm knip`
- `pnpm build:chrome`, then read `.output/chrome-mv3/manifest.json`: `name` and `action.default_title` are
  `Intake Experiment Testing`, `description` is the text above.
- `grep -rn "Statsig Browser Extension" src entrypoints wxt.config.ts` → no output
- `grep -rn "\[Statsig Extension\]" src entrypoints` → no output
- `git diff --stat -- LICENSE` → no output

Screenshots (saved to `.agents/scratch/f01-t1-rename/shots/`):

- `popup-header.png` — the popup at 400x600, default state (no project configured is fine), showing the header.
  Use a throwaway Playwright script under `.agents/scratch/f01-t1-rename/` that loads the built
  `.output/chrome-mv3` (see `e2e/extension-runtime.ts` for how the e2e suite loads the extension). Do not add it to
  `e2e/`. If the extension can't be loaded in this environment, say so under "Left undone".

Write `.agents/scratch/f01-t1-rename/checks.json` with one entry per check above.

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

Also give the absolute path of your worktree in the report.
