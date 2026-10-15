# F03: Repository hygiene

| Field      | Value                                           |
| ---------- | ----------------------------------------------- |
| Status     | Done                                            |
| Phase      | 1: Setup & hardening                            |
| Spec       | REQ-SET-011, REQ-SET-012 · §9 "Upstream change" |
| Depends on | None                                            |
| Blocks     | None                                            |

## Goal

The fork doesn't take automatic updates, and future sessions have a `CLAUDE.md` with the commands and the spec's rules.

## Tasks

### F03-T1: Remove automatic dependency updates

- **Status:** Done
- **Owner:** Claude
- **Size:** XS
- **Depends on:** Q3 (Dependabot), resolved: remove it (WL-034)
- **Description:** Delete `renovate.json`, and `.github/dependabot.yml` if Q3 says so (WL-012). Confirm `pnpm-lock.yaml` is committed and not git-ignored. Remove the `.agents/**` Renovate exclusion if anything else references it.
- **Acceptance criteria:**
  - [x] `renovate.json` is gone
  - [x] Dependabot is handled as Q3 decides: `.github/dependabot.yml` is deleted, and its `.agents/**` exclusion went with it
  - [x] `git ls-files pnpm-lock.yaml` lists the lockfile, and `git check-ignore` doesn't match it
- **Verification:** `git status`; `git ls-files pnpm-lock.yaml`
- **Files likely touched:** `renovate.json`, `.github/dependabot.yml`

### F03-T2: Replace `CLAUDE.md`

- **Status:** Done (WL-039)
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** Replace the Speckit stub. Include the build, test, lint, format, type-check, and e2e commands. Include the spec's hard rules: Console Key handling (SEC-001 to SEC-004), the single API module (SEC-005), no `eval` or remote code (SEC-006), the write-call allowlist (SEC-007), never touch other users' overrides (OVR-009), keep the page reader self-contained (§7 rule 3), and no new dependencies without need (§7 rule 4). Point to `planning/README.md` and `planning/WORKLOG.md`.
- **Acceptance criteria:**
  - [x] Every command listed runs as written. `pnpm dev:chrome` needed a fix first (WL-039).
  - [x] Each rule cites its REQ ID
- **Verification:** Run each listed command once.
- **Files likely touched:** `CLAUDE.md`

### F03-T3: Review CI workflows and the `web/` site for the fork

- **Status:** Done (WL-035, WL-037, WL-040)
- **Owner:** Claude proposes, Maurice decides
- **Size:** S
- **Depends on:** Q6, resolved (WL-035)
- **Description:** `.github/workflows/` has `build.yml`, `pages.yml`, `release.yml`, and `submit.yml`. `submit.yml` publishes to the browser stores, which is out of scope (spec §2.2), and `pages.yml` deploys the Statsig-branded `web/` landing page. Also check Codecov and SonarCloud, which the fork may not have set up. Apply the Q6 decision.
- **Acceptance criteria:**
  - [x] Each workflow is kept, adapted, or removed, with the reason logged in `WORKLOG.md` (WL-035)
  - [x] CI on the fork doesn't fail because of missing upstream secrets (run 38769230604, WL-040)
- **Verification:** Push a branch and check the workflow runs (with Maurice's approval).
- **Files likely touched:** `.github/workflows/*.yml`, `web/`, `.releaserc.json`, `sonar-project.properties`

### F03-T4: Fix the flaky e2e test "adds a second project, activates it and keeps its client keys"

- **Status:** Done (WL-038)
- **Owner:** Claude
- **Size:** XS
- **Depends on:** None
- **Description:** The test reads `chrome.storage.local` once, right after the UI write, and sometimes gets the old value (WL-023). Wait for the stored value instead. Fix the same way any other e2e test that reads storage once, right after a UI write.
- **Acceptance criteria:**
  - [x] The test passes 20 of 20 runs with `--repeat-each=20`
  - [x] The full e2e suite passes
- **Verification:** `pnpm build:chrome && pnpm exec playwright test e2e/projects.e2e.ts --repeat-each=20`; `pnpm exec playwright test`
- **Files likely touched:** `e2e/projects.e2e.ts`

### F03-T5: Keep agent worktrees out of git, lint, format, and tests

- **Status:** Done (WL-036)
- **Owner:** Claude
- **Size:** XS
- **Depends on:** None
- **Description:** Claude Code agent worktrees live in `.claude/worktrees/` inside the repo. That folder isn't ignored, so lint and vitest runs in the main checkout pick up the copies in the worktrees and fail (WL-024 item 2). Ignore the folder in git, and make vitest, oxlint, oxfmt, knip, and tsc skip it.
- **Acceptance criteria:**
  - [x] `git check-ignore .claude/worktrees/x` matches
  - [x] A planted file under `.claude/worktrees/` with a lint error, a format error, and a failing test is skipped by `pnpm lint`, `pnpm format:check`, `pnpm vitest run`, `pnpm knip`, and `pnpm type-check`
- **Verification:** Plant the file, run the five commands, delete the file.
- **Files likely touched:** `.gitignore`, `vitest.config.ts`
