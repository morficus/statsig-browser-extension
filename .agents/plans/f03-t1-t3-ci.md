# Brief: F03-T1 + F03-T3 No automatic updates, and CI for the fork

slug: f03-t1-t3-ci
status: agreed
agent: f03-ci (Sonnet, shared F03 worktree)

## Decision

The fork takes no automatic updates (spec §9, REQ-SET-011), and it doesn't publish anywhere: Testers load it
unpacked (§2.1), and there is no store listing (§2.2). CI on the fork keeps only the checks, and it runs the same
checks as the definition of done in `planning/README.md`. Everything that publishes, or that depends on the upstream
owner's accounts (Codecov, SonarCloud, the Chrome Web Store, GitHub Pages), goes. Maurice agreed to this. Decision
records: `planning/WORKLOG.md` WL-034 (Q3) and WL-035 (Q6). Tickets: `planning/tickets/F03-repo-hygiene.md`
F03-T1 and F03-T3.

Other agents work at the same time. `f03-claude-md` owns `CLAUDE.md`. `f03-ignore` owns `.gitignore` and the
vitest, oxlint, and oxfmt configs. `f03-e2e` works in another worktree. Don't touch their files.

## Owns

```
renovate.json                          # delete
.github/dependabot.yml                 # delete
.github/release-drafter.yml            # delete
.github/workflows/release.yml          # delete
.github/workflows/submit.yml           # delete
.github/workflows/pages.yml            # delete
.github/workflows/build.yml            # adapt
web/**                                 # delete the whole folder
.releaserc.json                        # delete
sonar-project.properties               # delete
.sonarcloud.properties                 # delete
docs/publishing.md                     # delete
package.json                           # ONLY: remove the 4 semantic-release devDependencies named below
pnpm-lock.yaml                         # ONLY via `pnpm install`, never hand-edited
knip.jsonc                             # ONLY: semantic-release mentions
README.md                              # ONLY: the lines named below
CONTRIBUTING.md                        # ONLY: the passages named below
docs/architecture.md                   # ONLY: the lines named below
new-feature-spec.md                    # ONLY: run the formatter on it, nothing else
```

## Environment

Work in `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f03-repo-hygiene`. Run
every command from there. Don't `cd` to the main checkout. `pnpm` is 12.11.2 and works as is. `node_modules` is
installed.

Baseline on this branch: type-check, lint, and 653 unit tests (101 files) pass. `pnpm format:check` fails only on
`new-feature-spec.md`, and step 6 fixes that.

Other agents run checks in this worktree at the same time. If a check fails in a file you don't own, or a run fails
with a strange module-resolution error right after your `pnpm install`, run it once more before you report it.

## Intent

1. **Delete** each file marked "delete" above, and the whole `web/` folder (`git rm -r` is fine for deletes, but
   don't stage or commit anything else; see the hard rules).

2. **`package.json`:** remove these devDependencies and nothing else: `@semantic-release/changelog`,
   `@semantic-release/exec`, `@semantic-release/git`, `semantic-release`. Then run `pnpm install` so the lockfile
   follows. If any other package exists only to serve semantic-release (for example a `conventional-changelog-*`
   preset that no other config loads), don't remove it. List it under "Left undone" instead. Don't change the
   `version` field.

3. **`.github/workflows/build.yml`:** keep the file name, the `name:` value, the `env:` block, the `concurrency:`
   block, the pinned action SHAs, the setup-project and install-playwright composite actions, the zip artifact upload,
   and the whole `e2e` job. Change only these things:
   - `on:` gets `push: branches: [main]` next to the existing `pull_request` and `workflow_dispatch` triggers.
   - Add a top-level `permissions:` block with `contents: read` only.
   - In the `build` job, the steps in this order: checkout, Setup project, `Lint` (`pnpm lint`), `Type check`
     (`pnpm type-check`), `Format check` (`pnpm format:check`), `Test` (`pnpm vitest run --reporter=dot --silent`, with
     no `--coverage...` flag), `Build the extension` (`pnpm run zip:chrome`), and the zip artifact upload as it is now.
   - Remove the "Upload coverage reports to Codecov" step.

4. **`knip.jsonc`:** remove `semantic-release` from the comment on line 4. Remove any knip entry that only exists for
   semantic-release or `.releaserc.json`. Then `pnpm knip` must pass. If knip flags something new because of your
   deletions, fix it in `knip.jsonc` only when the fix is the removal of an entry for a deleted file. Report anything
   else.

5. **Docs.** Change only these places:
   - `README.md`: delete the Codecov badge line, the SonarCloud badge line, and the Chrome Web Store badge line
     (lines 3, 4, and 6 now). Delete the `- [Publishing](docs/publishing.md) ...` list item. If deleting the badges
     leaves two blank lines in a row, merge them into one. **Don't** change the "Install from the Chrome Web Store"
     step or any other text: F12-T1 rewrites the README.
   - `CONTRIBUTING.md` line 40: replace the sentence that starts "We use [Conventional Commits]" with this text,
     verbatim:
     `We use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages. It is **crucial** to follow these guidelines.`
   - `CONTRIBUTING.md` lines 74-75 (the two sentences about automated releases and `docs/publishing.md`): replace them
     with this paragraph, verbatim:
     `There is no automated release. CI (`.github/workflows/build.yml`) runs lint, type check, format check, unit tests, and e2e tests on every pull request and on every push to `main`. It uploads the Chrome zip as a build artifact. To release a new version, change `version` in `package.json` in a pull request.`
     If the section heading above them names semantic-release or publishing, leave the heading as it is and say so
     under "Deviations".
   - `docs/architecture.md` line 16: replace the whole `- **CI/CD**: ...` line with
     `- **CI**: GitHub Actions (`.github/workflows/build.yml`)`. Line 80: delete the `- [Publishing](publishing.md) ...`
     list item.
   - Then `git grep -n -i "publishing.md\|codecov\|sonarcloud\|semantic-release\|releaserc\|release-drafter\|dependabot\|renovate\|pages.yml\|submit.yml"`
     and exclude `planning/`, `.agents/`, `.claude/`, `CHANGELOG.md`, and `pnpm-lock.yaml`. Report every hit that
     remains, with a one-line reason why you left it. Don't edit files outside "Owns" to clear a hit.

6. **`new-feature-spec.md`:** run `pnpm exec oxfmt --write new-feature-spec.md`. That only pads the table columns.
   Check that `git diff --word-diff new-feature-spec.md` shows only whitespace and table-rule changes. If the formatter
   changes any word, revert the file and report it.

7. **T1 check:** `git ls-files pnpm-lock.yaml` lists the lockfile, and `git check-ignore pnpm-lock.yaml` matches
   nothing.

Don't touch `CHANGELOG.md` (it is history), `.github/actions/**`, `.github/copilot-instructions.md`,
`.github/agents/**`, `.github/prompts/**`, or the issue and PR templates.

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

"Never touch git state" exception for this brief: `git rm` of the files you are told to delete is allowed. Don't
`git add` anything else, and don't commit.

## Verify

Run, in this order:

- `pnpm install` (lockfile updated; exit 0)
- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check` (must exit 0 now)
- `pnpm vitest run --reporter=dot`
- `pnpm knip`
- `pnpm build:chrome`
- YAML check of `build.yml`: if `actionlint` is on `PATH`, run it. If not, parse the file with the `yaml` package
  from `node_modules`, if one is there (`node -e "..."`). Record which one you used. If neither is there, record
  "not run".
- `git ls-files pnpm-lock.yaml` and `git check-ignore pnpm-lock.yaml`
- The `git grep` from step 5

Write `.agents/scratch/f03-t1-t3-ci/checks.json` with one entry per command above.

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

Also include the full final `build.yml` after "Files changed".
