# Brief: F03-T2 Replace `CLAUDE.md`

slug: f03-t2-claude-md
status: agreed
agent: f03-claude-md (Sonnet, shared F03 worktree)

## Decision

`CLAUDE.md` is the first thing every future session reads (REQ-SET-012). It must give the commands that work, as
written, and the spec's hard rules with their REQ IDs, so that a session that never read the spec can't break them
by accident. It is a reference, not a tutorial: short, exact, and with no repeated text. Everything in it must be true
for this repo now. Ticket: `planning/tickets/F03-repo-hygiene.md` F03-T2.

Other agents work at the same time. `f03-ci` removes semantic-release, Codecov, SonarCloud, and the publishing
workflows, and adapts `.github/workflows/build.yml` (WL-035 in `planning/WORKLOG.md`). `f03-ignore` makes git, lint,
format, and vitest ignore `.claude/worktrees/` (F03-T5). Write `CLAUDE.md` for the state **after** their work: CI is
`build.yml` only, and agent worktrees are ignored. Don't describe the removed release process.

## Owns

```
CLAUDE.md
```

## Environment

Work in `/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension/.claude/worktrees/f03-repo-hygiene`. Run
every command from there. Don't `cd` to the main checkout. `pnpm` is 12.11.2 and works as is. `node_modules` is
installed.

## Intent

Sources to read first: the current `CLAUDE.md` (a stub), `new-feature-spec.md` (§2, §6.1, §6.2, §6.3 REQ-OVR-009,
§6.7, §7), `planning/README.md`, `package.json` (scripts, `packageManager`, `lint-staged`), `.husky/*`,
`.github/workflows/build.yml`, and `.claude/skills/orchestrate/SKILL.md`.

Write `CLAUDE.md` with exactly these sections, in this order. Keep it under 130 lines.

1. **`# CLAUDE.md`**, then one or two sentences: this repo is a fork of `d0whc3r/statsig-browser-extension`, being
   turned into the "Intake Experiment Testing" Chrome extension. The requirements are in `new-feature-spec.md`.

2. **`## Current work: Intake Experiment Testing`**: keep the content of the stub's section (read
   `planning/README.md` first; tickets `F00`–`F12` in `planning/tickets/`; on a status change update the ticket, the
   board row, and **Next up**; add `WL-NNN` entries at the bottom of `planning/WORKLOG.md` and never edit old ones).
   Delete the stub's line "This file is a stub until ticket F03-T2 ..." and its last paragraph ("For additional
   context ..."). Add one bullet: agent briefs for multi-agent work live in `.agents/plans/` (see the `orchestrate`
   skill in `.claude/skills/`), and `planning/` stays the record of truth.

3. **`## Commands`**: a two-column table, `Command` | `What it does`. Exactly these rows, in this order. Each
   description is one short line, and each must be true (check `package.json`):
   `pnpm install`, `pnpm dev:chrome`, `pnpm build:chrome`, `pnpm zip:chrome`, `pnpm vitest run`,
   `pnpm vitest run <one real test file>`, `pnpm test:e2e`, `pnpm exec playwright test <one real e2e file>`,
   `pnpm type-check`, `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`, `pnpm knip`.
   For the two "one file" rows, pick a real file that exists now (for example a test next to `src/lib/storage.ts`,
   and `e2e/projects.e2e.ts`). Under the table, one line: `pnpm test` starts vitest in watch mode, so use
   `pnpm vitest run` for a single run.

4. **`## Definition of done`**: the list from `planning/README.md` "Definition of done", shortened to one line per
   item, with a link to that section as the source. Then one sentence on CI: `build.yml` runs on every pull request
   and every push to `main`, and what it runs (read the file after `f03-ci` is done; see phase 2).

5. **`## Hard rules`**: one bullet per rule. Each bullet starts with the REQ ID (or spec section) in bold, then the
   rule in one to three short sentences, faithful to the spec. Don't add rules the spec doesn't have, and don't soften
   or widen any rule. Exactly these rules, in this order:
   - REQ-SEC-001 to REQ-SEC-004: Console Key handling (one bullet per REQ, or one bullet that covers all four, as long
     as each of the four requirements is stated).
   - REQ-SEC-005: the single API module (name the file, `src/lib/fetcher.ts`, if the spec or §7 table names it).
   - REQ-SEC-006: no `eval` or remote code.
   - REQ-SEC-007: the write-call allowlist.
   - REQ-SET-010: the manifest permissions allowlist.
   - REQ-OVR-009: never touch other users' overrides.
   - §2.2 and REQ-GAT-*: don't change the feature gate override feature or dynamic configs (cite the exact REQ-GAT
     IDs that say this).
   - §7 rule 1: read the Console API reference before you write override code; don't guess request shapes.
   - §7 rule 3: keep the page reader function self-contained, and why (Chrome serializes it).
   - §7 rule 4: don't add a dependency you don't need.

6. **`## Working in this repo`**: short bullets, each true now:
   - `packageManager` pins pnpm (give the version from `package.json`).
   - Branch per functionality or task. Never commit on `main`. Conventional Commits.
   - The git hooks: what `pre-commit` and `pre-push` run (read `.husky/` and `package.json`).
   - Claude Code agent worktrees live in `.claude/worktrees/`. Git, lint, format, and vitest ignore that folder (F03-T5).
   - The spec and the planning docs use ASD-STE100-style simplified English: short sentences, one instruction per
     sentence. Keep new planning text in that style.

Style: plain sentences. No emoji, no bold-for-emphasis inside sentences, and no "Note:" or "Important:" lead-ins.
The bold in section 5 is only for the REQ ID at the start of each bullet.

### Two phases

**Phase 1 (now).** Write `CLAUDE.md`. Run the commands that change no tracked files, and record them:
`pnpm type-check`, `pnpm lint`, `pnpm format:check`, `pnpm vitest run`, the one-file vitest run,
`pnpm knip`, `pnpm build:chrome`, `pnpm zip:chrome`. `pnpm format:check` may fail on `new-feature-spec.md` until
`f03-ci` is done. A check may also fail in a file another agent is editing. Record those as "pending other agent".
Then report with the phase 1 report (below) and **wait**.

**Phase 2 (only when the lead messages you "phase 2").** Re-read `.github/workflows/build.yml` and `.gitignore`, and
fix section 4 and section 6 if they no longer match. Then run each remaining command once:
`pnpm install`, `pnpm lint:fix`, `pnpm format`, `pnpm test:e2e`, the one-file Playwright run, and `pnpm dev:chrome`
(start it, wait until WXT says it is ready or 90 seconds pass, then stop it). After `pnpm lint:fix` and `pnpm format`,
run `git status --porcelain`. If either one changed any file other than `CLAUDE.md`, revert those changes with
`git checkout -- <file>` and report the file names. Then run all the phase 1 commands once more. Then report with the
full report.

Don't run `pnpm install`, `pnpm lint:fix`, `pnpm format`, or any e2e command in phase 1. Other agents are changing
files in this worktree, and those commands write to them.

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

Exception: in phase 2, `git checkout -- <file>` to undo a formatter change in a file you don't own is allowed.

## Verify

`.agents/scratch/f03-t2-claude-md/checks.json`: one entry per command in the `## Commands` table, with the phase it
ran in and its exit code. Also add a check that every bullet in `## Hard rules` starts with a REQ ID or spec section,
and that each cited ID exists in `new-feature-spec.md` (grep each one).

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

Phase 1 report: the same format, plus the full text of `CLAUDE.md` at the end.
