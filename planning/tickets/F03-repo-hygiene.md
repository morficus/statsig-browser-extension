# F03: Repository hygiene

| Field      | Value                                           |
| ---------- | ----------------------------------------------- |
| Status     | Todo                                            |
| Phase      | 1: Setup & hardening                            |
| Spec       | REQ-SET-011, REQ-SET-012 · §9 "Upstream change" |
| Depends on | None                                            |
| Blocks     | None                                            |

## Goal

The fork doesn't take automatic updates, and future sessions have a `CLAUDE.md` with the commands and the spec's rules.

## Tasks

### F03-T1: Remove automatic dependency updates

- **Status:** Todo
- **Owner:** Claude
- **Size:** XS
- **Depends on:** Q3 (Dependabot)
- **Description:** Delete `renovate.json`, and `.github/dependabot.yml` if Q3 says so (WL-012). Confirm `pnpm-lock.yaml` is committed and not git-ignored. Remove the `.agents/**` Renovate exclusion if anything else references it.
- **Acceptance criteria:**
  - [ ] `renovate.json` is gone
  - [ ] Dependabot is handled as Q3 decides
  - [ ] `git ls-files pnpm-lock.yaml` lists the lockfile
- **Verification:** `git status`; `git ls-files pnpm-lock.yaml`
- **Files likely touched:** `renovate.json`, `.github/dependabot.yml`

### F03-T2: Replace `CLAUDE.md`

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** Replace the Speckit stub. Include the build, test, lint, format, type-check, and e2e commands. Include the spec's hard rules: Console Key handling (SEC-001 to SEC-004), the single API module (SEC-005), no `eval` or remote code (SEC-006), the write-call allowlist (SEC-007), never touch other users' overrides (OVR-009), keep the page reader self-contained (§7 rule 3), and no new dependencies without need (§7 rule 4). Point to `planning/README.md` and `planning/WORKLOG.md`.
- **Acceptance criteria:**
  - [ ] Every command listed runs as written
  - [ ] Each rule cites its REQ ID
- **Verification:** Run each listed command once.
- **Files likely touched:** `CLAUDE.md`

### F03-T3: Review CI workflows and the `web/` site for the fork

- **Status:** Todo
- **Owner:** Claude proposes, Maurice decides
- **Size:** S
- **Depends on:** Q6
- **Description:** `.github/workflows/` has `build.yml`, `pages.yml`, `release.yml`, and `submit.yml`. `submit.yml` publishes to the browser stores, which is out of scope (spec §2.2), and `pages.yml` deploys the Statsig-branded `web/` landing page. Also check Codecov and SonarCloud, which the fork may not have set up. Apply the Q6 decision.
- **Acceptance criteria:**
  - [ ] Each workflow is kept, adapted, or removed, with the reason logged in `WORKLOG.md`
  - [ ] CI on the fork doesn't fail because of missing upstream secrets
- **Verification:** Push a branch and check the workflow runs (with Maurice's approval).
- **Files likely touched:** `.github/workflows/*.yml`, `web/`, `.releaserc.json`, `sonar-project.properties`
