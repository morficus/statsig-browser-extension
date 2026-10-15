# Brief: F01-T2 Remove the Firefox targets

slug: f01-t2-firefox
status: done (38b68d3)
agent: f01-t2-firefox (Sonnet, isolated worktree)

## Decision

The extension targets Chrome only (spec REQ-SET-005), and no extension ID may use `statsig.com` (REQ-SET-004).
Remove every Firefox build target, manifest setting, script, release step, and Firefox mention in the tooling and
contributor docs. Keep the Chrome equivalents working exactly as they do now. Ticket:
`planning/tickets/F01-rebrand-chrome-only.md` (F01-T2). Decision record: `planning/WORKLOG.md` WL-020.

What stays out of this task: the `web/` landing page and whether `submit.yml` / CI should exist at all (that is
F03-T3, open question Q6), and the README / CONTRIBUTING rebrand (F12-T1). Here you remove only Firefox content from
those files; you don't rewrite them.

Two other agents work on F01 at the same time in other worktrees. F01-T1 changes the manifest `name`,
`action.default_title`, `description`, and the `package.json` `name`/`description`. F01-T3 changes the
`CRX_PUBLIC_KEY` value. Do not touch those. Note: F01-T1 renames the package from `statsig-browser-extension` to
`intake-experiment-testing`, and WXT names zip files after the package name. So any **explicit** zip filename in a
file you own (for example `statsig-browser-extension-{version}-chrome.zip`) must become
`intake-experiment-testing-{version}-chrome.zip`. Leave globs like `.output/*-chrome.zip` as they are.

## Owns

```
wxt.config.ts                          # ONLY: the browser_specific_settings block, the `key` spread + its comment,
                                       #       and the `manifest: ({ browser }) =>` signature
package.json                           # ONLY the `scripts` entries named below
web-ext.config.ts
.gitignore                             # ONLY the `.dev-profile-ff` line
.releaserc.json
.github/workflows/submit.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/ISSUE_TEMPLATE/bug-report.yml
docs/publishing.md
e2e/mocks.ts                           # ONLY comments/strings that mention Firefox
e2e/extension-runtime.ts               # ONLY comments/strings that mention Firefox
README.md                              # ONLY sentences, badges, links, commands that mention Firefox / AMO
CONTRIBUTING.md                        # ONLY sentences, links, commands that mention Firefox / AMO
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

1. **`wxt.config.ts`:**
   - Delete the whole `browser_specific_settings` block.
   - Replace `// Chromium-only: AMO rejects ...` and `...(browser === 'firefox' ? {} : { key: CRX_PUBLIC_KEY }),`
     with a plain `key: CRX_PUBLIC_KEY,` in the same position (between `icons` and `name`, keeping the
     alphabetical key order the file uses).
   - Change `manifest: ({ browser }) => ({ ... })` to `manifest: { ... }` (a plain object; `browser` is unused now).
   - Leave the top-of-file comments, `CRX_PUBLIC_KEY`, `name`, `default_title`, `description`, `host_permissions`,
     `permissions`, and `modules` untouched.
2. **`package.json` scripts:** remove `dev:firefox`, `build:firefox`, `zip:firefox`, `zip:all`. Keep every other
   script as is. Do not change dependencies or `pnpm.overrides` (`web-ext` stays; WXT uses it for Chrome too).
3. **`web-ext.config.ts`:** remove the `firefoxProfile` line. Keep the rest.
4. **`.gitignore`:** remove the `.dev-profile-ff` line. Nothing else.
5. **`.releaserc.json`:** `prepareCmd` becomes `pnpm zip:chrome`. Remove the Firefox zip asset. If an asset only
   exists because of the Firefox build (for example a `*-sources.zip` that only `zip:firefox` produces), remove it
   too and say so under Deviations; if unsure whether the Chrome zip also produces it, check by running
   `pnpm zip:chrome` and listing `.output/`.
6. **`.github/workflows/submit.yml`:** remove the Firefox steps, inputs, env, and secrets. Keep the workflow and its
   Chrome submission as they are. If removing Firefox leaves a step or input with nothing to do, remove it too.
7. **`.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug-report.yml`:** remove Firefox options and
   checkboxes. Keep Chrome.
8. **`docs/publishing.md`:** remove the Firefox / AMO sections, config, and secrets. Keep the Chrome content. Fix
   explicit zip filenames as described above.
9. **`e2e/mocks.ts`, `e2e/extension-runtime.ts`:** reword comments that mention Firefox so they describe Chrome only,
   keeping their meaning. No code changes unless the code itself branches on Firefox; if it does, remove the
   Firefox branch and say so under Deviations.
10. **`README.md`, `CONTRIBUTING.md`:** remove the Firefox Add-ons badge, the AMO install link, `pnpm dev:firefox`
    / `build:firefox` / `zip:firefox` instructions, and change "Chrome and Firefox" style phrases to "Chrome". Do not
    change titles, the product name, or other content.

Must not:
- Touch `web/` (F03-T3), `CHANGELOG.md`, `planning/`, `new-feature-spec.md`, `.agents/`, `pnpm-lock.yaml`.
- Touch the product-name fields (F01-T1) or the `CRX_PUBLIC_KEY` value (F01-T3).

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f01-t2-firefox/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f01-t2-firefox/checks.json`. Save screenshots to
  `.agents/scratch/f01-t2-firefox/shots/<name>.png` using the names the brief gives.
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
- `pnpm build:chrome`, then read `.output/chrome-mv3/manifest.json`: no `browser_specific_settings`, no `gecko`, no
  `@statsig.com`; `key` is present.
- `pnpm zip:chrome` succeeds.
- `grep -rniE "firefox|gecko|addons\.mozilla|\bAMO\b" --exclude-dir=node_modules --exclude-dir=.agents --exclude-dir=.output --exclude-dir=.wxt --exclude-dir=planning --exclude-dir=web --exclude=CHANGELOG.md --exclude=pnpm-lock.yaml --exclude=new-feature-spec.md .`
  → no output. If a hit remains in a file you don't own, list it under "Left undone" instead of editing it.
- `grep -n "firefox" package.json` → no output.

No screenshots for this task.

Write `.agents/scratch/f01-t2-firefox/checks.json` with one entry per check above.

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

Also give the absolute path of your worktree in the report.
