# Brief: F03-T5 Keep agent worktrees out of git, lint, format, and tests

slug: f03-t5-worktree-ignore
status: agreed
agent: f03-ignore (Sonnet, shared F03 worktree)

## Decision

Claude Code puts agent worktrees in `.claude/worktrees/<name>/` inside the repo. Each one is a full copy of the repo.
That folder isn't ignored, so in the main checkout `pnpm lint` and `pnpm vitest run` pick up the copies and fail
(`planning/WORKLOG.md` WL-024 item 2). Fix it in the config, so the plain commands work in the main checkout while
worktrees exist. Ticket: `planning/tickets/F03-repo-hygiene.md` F03-T5.

Ignore only `.claude/worktrees/`. The rest of `.claude/` (for example `.claude/skills/`) is tracked and must stay
tracked.

Other agents work at the same time. `f03-ci` owns `package.json`, `pnpm-lock.yaml`, `knip.jsonc`, and the CI files.
`f03-claude-md` owns `CLAUDE.md`. Don't touch their files. If knip needs a config change, don't make it; report it
under "Left undone" with the exact change.

## Owns

```
.gitignore
vitest.config.ts
oxlint.config.ts
.oxfmtrc.json
tsconfig.*.json                        # ONLY if tsc picks up the planted files; most likely no change
```

## Environment

Work in `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f03-repo-hygiene`. Run
every command from there. Don't `cd` to the main checkout. `pnpm` is 12.11.2 and works as is. `node_modules` is
installed. This worktree has no `.claude/worktrees/` folder of its own, so you plant one for the test (step 2).

Baseline: type-check, lint, and 653 unit tests pass. `pnpm format:check` fails only on `new-feature-spec.md`, which
another agent is fixing. Ignore that one hit. Other agents run checks in this worktree at the same time. If a run fails
in a file you don't own, run it once more before you report it.

## Intent

1. **`.gitignore`:** add these lines after the `.agents/scratch/` block, verbatim:

   ```
   # Claude Code agent worktrees. Each is a full copy of the repository.
   .claude/worktrees/
   ```

2. **Plant a test fixture.** Create `.claude/worktrees/zz-plant/src/plant.test.ts`. It needs a failing vitest test
   (`expect(1).toBe(2)`), an unused variable that oxlint flags, a type error (`const n: number = 'x'`), and bad
   formatting that oxfmt flags (for example a line indented by 7 spaces, and double semicolons). Also create
   `.claude/worktrees/zz-plant/package.json` with `{ "name": "zz-plant" }`, so knip sees it as a copy.

3. **Run each tool with the plant in place**, and record whether it reports the plant:
   `pnpm lint`, `pnpm format:check`, `pnpm vitest run --reporter=dot`, `pnpm knip`, `pnpm type-check`.

4. **Fix each tool that reports the plant**, in its own config:
   - vitest (`vitest.config.ts`): add `'.claude/**'` to `test.exclude`, merged with vitest's defaults
     (`configDefaults.exclude` from `vitest/config`), so the default excludes stay. If the config already sets
     `exclude`, add the entry to it. Do the same for `coverage.exclude` only if the config already lists coverage
     excludes.
   - oxlint (`oxlint.config.ts`): add `.claude/worktrees/**` to `ignorePatterns`, but only if oxlint still reports the
     plant after the `.gitignore` change.
   - oxfmt (`.oxfmtrc.json`): add `.claude/worktrees/**` to its ignore list, but only if oxfmt still reports the plant
     after the `.gitignore` change.
   - tsc: change a `tsconfig.*.json` only if `pnpm type-check` reports the plant.
   - knip: don't change `knip.jsonc`. Report it if knip reports the plant.

   Don't add a fix to a tool that already skips the plant.

5. **Run the five commands again** with the plant still in place. Each must not report the plant. (Ignore the
   `new-feature-spec.md` format hit if it is still there.)

6. **Delete the plant:** `rm -rf .claude/worktrees` (only the folder you made; check that nothing else is in it
   first). Then run `pnpm vitest run --reporter=dot` once more: 653 tests pass, or more if another agent added some.

7. Check: `git check-ignore -v .claude/worktrees/x` names the new `.gitignore` line, and
   `git check-ignore .claude/skills/orchestrate/SKILL.md` matches nothing.

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

Exception: the plant under `.claude/worktrees/zz-plant/` is yours to create and delete.

## Verify

Write `.agents/scratch/f03-t5-worktree-ignore/checks.json` with, for each of the five tools: whether it reported the
plant **before** the fix (step 3), what you changed for it (or "no change: already skips it"), and whether it reported
the plant **after** the fix (step 5). Add the step 6 test run and the two step 7 `git check-ignore` results.

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
