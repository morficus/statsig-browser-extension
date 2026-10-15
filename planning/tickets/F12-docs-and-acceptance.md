# F12: Docs and acceptance

| Field      | Value                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| Status     | Todo                                                                   |
| Phase      | 5: Release readiness                                                   |
| Spec       | REQ-NFR-001, REQ-NFR-007, REQ-SEC-010, REQ-SHT-012, REQ-SET-013 · §8.2 |
| Depends on | F01 to F11                                                             |
| Blocks     | Release to the Testers                                                 |

## Goal

A Tester can install and use the extension from the README alone, the docs match what was built, and every acceptance test in §8.2 has a recorded result.

## Tasks

### F12-T1: Rewrite the README

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F11
- **Description:** Sections required by REQ-NFR-007:
  - Install as an unpacked extension
  - Create a Personal Console Key, and don't use a shared project key (REQ-SEC-010)
  - Key types
  - The permissions list
  - Known limits: no expiry, overrides set in the Console aren't listed, gate overrides aren't in the badge, results pollution (spec §9), and the "debugging this browser" banner (REQ-SHT-012)

  Keep credit to the upstream project.

- **Acceptance criteria:**
  - [ ] Every REQ-NFR-007 section is there
  - [ ] Someone new can follow the install steps and get a working extension
- **Verification:** Maurice, or a Tester, follows the README on a clean Chrome profile.
- **Files likely touched:** `README.md`, `CONTRIBUTING.md` (remove upstream-only content)

### F12-T2: Final permissions doc

- **Status:** Todo
- **Owner:** Claude
- **Size:** XS
- **Depends on:** F11-T2
- **Description:** REQ-SET-013. Bring `docs/permissions-justification.md` in line with the final built manifest, including the optional `debugger` permission.
- **Acceptance criteria:**
  - [ ] Every permission and host pattern in the manifest is justified, and nothing else is listed
- **Verification:** Compare with `.output/chrome-mv3/manifest.json`
- **Files likely touched:** `docs/permissions-justification.md`

### F12-T3: Run and record the §8.2 acceptance tests

- **Status:** Todo
- **Owner:** Maurice runs the manual tests, Claude runs and records the automated ones
- **Size:** M
- **Depends on:** F12-T1, F12-T2
- **Description:** Run every row of spec §8.2, T-SET-1 through T-SHT-2, with staging first, in the current stable Chrome (REQ-NFR-001). Record the Chrome version. Record pass or fail, the date, and notes in the PR description or the README (spec §8).
- **Acceptance criteria:**
  - [ ] All 19 tests have a recorded result
  - [ ] Every failure has a ticket or a logged decision
- **Verification:** The results table exists in the PR or the README.
- **Files likely touched:** `README.md` or the PR description, `planning/WORKLOG.md`
