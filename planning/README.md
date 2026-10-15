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
| 0: Pre-build checks              | [F00: Pre-build checks (spec §8.1)](tickets/F00-pre-build-checks.md)           | In progress | 1/5   |
| 1: Setup & hardening             | [F01: Rebrand and Chrome-only](tickets/F01-rebrand-chrome-only.md)             | Done        | 3/3   |
|                                  | [F02: Intake Site scoping](tickets/F02-intake-site-scoping.md)                 | Done        | 4/4   |
|                                  | [F03: Repository hygiene](tickets/F03-repo-hygiene.md)                         | Done        | 5/5   |
|                                  | [F04: Console API hardening](tickets/F04-console-api-hardening.md)             | Todo        | 0/5   |
| 2: Job 2 (force me into a group) | [F05: Stable ID and environment detection](tickets/F05-stable-id-detection.md) | Todo        | 0/2   |
|                                  | [F06: Override engine](tickets/F06-override-engine.md)                         | Todo        | 0/5   |
|                                  | [F07: "Force me into this group" UI](tickets/F07-force-me-ui.md)               | Todo        | 0/4   |
|                                  | [F08: Active overrides and badge](tickets/F08-active-overrides.md)             | Todo        | 0/4   |
| 3: Job 1 (see my group)          | [F09: SDK values reader](tickets/F09-sdk-values-reader.md)                     | Todo        | 0/4   |
|                                  | [F10: "My groups" UI](tickets/F10-my-groups-ui.md)                             | Todo        | 0/4   |
| 4: Job 3 (screenshots)           | [F11: Screenshots](tickets/F11-screenshots.md)                                 | Todo        | 0/5   |
| 5: Release readiness             | [F12: Docs and acceptance](tickets/F12-docs-and-acceptance.md)                 | Todo        | 0/3   |

### Checkpoints

- [ ] **After phase 0:** OPEN-001, OPEN-004, OPEN-007, and OPEN-008 have recorded results in `WORKLOG.md`. The request shapes for the override endpoints are confirmed.
- [ ] **After phase 1:** the built manifest passes T-SET-1. T-SEC-1, T-SEC-2, T-SEC-3, and T-GAT-1 pass. All existing tests pass.
- [ ] **After phase 2:** T-OVR-1 to T-OVR-6 pass on staging. The Job 2 e2e tests pass.
- [ ] **After phase 3:** T-ASG-1 to T-ASG-5 pass. The Job 1 e2e tests pass.
- [ ] **After phase 4:** T-SHT-1 and T-SHT-2 pass.
- [ ] **After phase 5:** all of spec §8.2 is recorded. Ready for the Testers.

## Next up

1. **Maurice:** move the new private signing key to a password manager before the machine restarts (WL-021).
2. **F00-T2 to F00-T5** (Maurice): the manual checks against Statsig and the Intake Site. F00-T1 is done (WL-016), so the exact calls to test are known. Claude can prepare the curl commands (T3, T5) and the DevTools snippet (T4).
3. **F02 is done** (WL-026 to WL-031). T-SET-1 passes. Merged into `main`. F05-T1 and F05-T2 carry two guard follow-ups (WL-031). Then F04, once Q2 is answered for it. F01 is done (WL-019 to WL-022).
4. **F03 is done** (WL-033 to WL-041). It is merged into `main` and pushed. Each push to `main` runs CI on the fork, and the run uploads the zip artifact.

## Open questions

Each resolved question becomes a `Decision` entry in `WORKLOG.md`. Then remove it from this list.

| ID  | Question                                                                                                                                                                                                                            | Blocks      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Q1  | **Popup layout.** Keep the Gates, Experiments, Configs, Audit Logs, and Cleanup tabs? Where do Job 2 and Job 1 live: new tabs, or inside the Experiments tab?                                                                       | F07, F10    |
| Q2  | **Who runs phase 0, and when?** Can the rest of phase 1 (F02 to F04) start while the manual checks wait? Spec §11 says no. F01 (WL-019), F02 (WL-026), and F03 (WL-033) started early.                                              | F04         |
| Q4  | **Existing experiment override modal and REQ-OVR-009.** The base modal can delete any override row, and a delete removes every ID in that row. Should it be limited to the Tester's own ID, made read-only, or removed? See WL-004. | F06-T3, F07 |
| Q5  | **Project gate.** The popup hides everything unless the page's SDK key matches a configured project. Do the Intake flows keep this gate (each Tester adds their key and pins it to the site), or bypass it? See WL-010.             | F07, F10    |
| Q7  | **How is the key type set?** Nothing in the base code sets `read-key`. Should the Tester pick the type when adding a key, or should the extension detect it? See WL-013.                                                            | F04-T3      |
