# Planning: Intake Experiment Testing

Work tracking for the changes in [`new-feature-spec.md`](../new-feature-spec.md) (Draft 0.4).

| Where                      | What it is for                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`tickets/`](tickets/)     | One file per **functionality** (`F00`–`F12`). Each one holds its **tasks** (`F06-T2` and so on). Tracks progress and what comes next. |
| [`WORKLOG.md`](WORKLOG.md) | Append-only history of discoveries, decisions, risks, and resolved questions. Entries are numbered `WL-NNN` so tickets can cite them. |
| This file                  | The board, what's next, open questions, and the conventions.                                                                          |

## Conventions

**Statuses:** `Todo` · `In progress` · `Blocked` · `Done` · `Dropped`

**When a task changes status:**

1. Update the task's `Status` line in its ticket file.
2. Update the functionality row in the board below (status and `done/total` count).
3. If the task produced a discovery or decision, add a `WORKLOG.md` entry and cite it in the task (`See WL-014`).
4. Update **Next up**.

**Task IDs** are stable. Don't renumber. To drop a task, set it to `Dropped` and log why. To add a task, give it the next free number.

**Owner:** `Claude` (I can do it alone) or `Maurice` (needs Statsig access, the real Intake Site, or a decision).

**Definition of done** for every task, on top of its own acceptance criteria:

- `pnpm vitest run` passes (existing tests too, per REQ-NFR-002 / REQ-GAT-004)
- `pnpm type-check` and `pnpm lint` pass, and `pnpm format:check` is clean (REQ-NFR-006)
- `pnpm build:chrome` succeeds if the task touches the manifest, `wxt.config.ts`, or `entrypoints/`
- New logic has unit tests (REQ-NFR-003)
- No new dependency unless the task justifies it (spec §7, rule 4)

## Board

Delivery order follows spec §11. Each phase must pass its checkpoint before the next one starts.

| Phase                            | Functionality                                                                  | Status      | Tasks |
| -------------------------------- | ------------------------------------------------------------------------------ | ----------- | ----- |
| 0: Pre-build checks              | [F00: Pre-build checks (spec §8.1)](tickets/F00-pre-build-checks.md)           | In progress | 5/6   |
| 1: Setup & hardening             | [F01: Rebrand and Chrome-only](tickets/F01-rebrand-chrome-only.md)             | Done        | 3/3   |
|                                  | [F02: Intake Site scoping](tickets/F02-intake-site-scoping.md)                 | Done        | 4/4   |
|                                  | [F03: Repository hygiene](tickets/F03-repo-hygiene.md)                         | Done        | 5/5   |
|                                  | [F04: Console API hardening](tickets/F04-console-api-hardening.md)             | Done        | 5/5   |
| 2: Job 2 (force me into a group) | [F05: Stable ID and environment detection](tickets/F05-stable-id-detection.md) | Done        | 2/2   |
|                                  | [F06: Override engine](tickets/F06-override-engine.md)                         | Todo        | 0/6   |
|                                  | [F07: "Force me into this group" UI](tickets/F07-force-me-ui.md)               | Todo        | 0/5   |
|                                  | [F08: Active overrides and badge](tickets/F08-active-overrides.md)             | Todo        | 0/4   |
| 3: Job 1 (see my group)          | [F09: SDK values reader](tickets/F09-sdk-values-reader.md)                     | Todo        | 0/4   |
|                                  | [F10: "My groups" UI](tickets/F10-my-groups-ui.md)                             | Todo        | 0/4   |
| 4: Job 3 (screenshots)           | [F11: Screenshots](tickets/F11-screenshots.md)                                 | Todo        | 0/5   |
| 5: Release readiness             | [F12: Docs and acceptance](tickets/F12-docs-and-acceptance.md)                 | Todo        | 0/3   |

### Checkpoints

- [x] **After phase 0:** OPEN-001, OPEN-004, and OPEN-007 have recorded results in `WORKLOG.md`. So does the admin part of OPEN-008 (F00-T5). The request shapes for the override endpoints are confirmed. Passed on 2026-10-16 (WL-056).
- [ ] **After phase 1:** the built manifest passes T-SET-1. T-SEC-1, T-SEC-2, T-SEC-3, and T-GAT-1 pass. All existing tests pass.
- [ ] **After phase 2:** T-OVR-1 to T-OVR-6 pass on staging. The Job 2 e2e tests pass.
- [ ] **After phase 3:** T-ASG-1 to T-ASG-5 pass. The Job 1 e2e tests pass.
- [ ] **After phase 4:** T-SHT-1 and T-SHT-2 pass.
- [ ] **After phase 5:** all of spec §8.2 is recorded. F00-T6 (a non-admin key, OPEN-005 and OPEN-008) has a recorded result (WL-048). Ready for the Testers.

## Next up

1. **Maurice:** move the new private signing key to a password manager before the machine restarts (WL-021).
2. **Phase 0 passes** (WL-056). F00-T1 to F00-T5 are done. OPEN-001, OPEN-004, and OPEN-007 are answered (WL-053, WL-054).
   - **Maurice:** `cleanup` ran. Delete the test experiments, the layer, and the read-only key in the Console, and delete `planning/phase0/.env`, if that isn't done yet.
   - **F00-T6** (a non-admin key) waits for the first Tester, before the release (WL-048).
   - **F05 is done** (WL-064 to WL-066) and merged into `main`. Maurice agreed the F05-T2 layout and storage (WL-065), so F05-T2 ran ahead of wave 3. `StableIdFallback` waits for F07-T2 to place it.
   - **WL-059 to WL-063 aren't on `main` yet.** F06 (`f06-override-engine`) and F07-T5 (`f07-t5`) use them, and they aren't merged. F05's entries took the next free numbers, as WL-063 on `f07-t5` says.
   - **Claude, next (waits for Maurice's go):** the rest of wave 1, in parallel: F06-T4, F06-T5, F06-T6, F07-T5. Wave 2: F06-T1, then F06-T2, then F06-T3. Wave 3: the Intake tab UI (F07-T1 to F07-T4), after Maurice agrees to a layout proposal (WL-058).
3. **F02 is done** (WL-026 to WL-031). T-SET-1 passes. Merged into `main`. F05-T1 and F05-T2 carry two guard follow-ups (WL-031). F01 is done (WL-019 to WL-022).
4. **F03 is done** (WL-033 to WL-041). It is merged into `main` and pushed. Each push to `main` runs CI on the fork, and the run uploads the zip artifact.
5. **F04 is done** (WL-042 to WL-046) and merged into `main`. Two manual checks are still to do (Maurice), in a real browser against the real Statsig API and the Intake Site:
   - **T-SEC-1:** do a full session with the background service worker's Network log open. All requests go to `statsigapi.net` only.
   - **T-SEC-2:** set a project's key type to Read only. All write actions are disabled, and the reason shows.

## Open questions

Each resolved question becomes a `Decision` entry in `WORKLOG.md`. Then remove it from this list.

None right now. Q1, Q4, and Q5 were decided, and Q2 was closed, in WL-057.
