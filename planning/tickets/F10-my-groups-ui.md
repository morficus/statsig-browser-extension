# F10: "My groups" UI

| Field      | Value                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Status     | Todo                                                                                                                         |
| Phase      | 3: Job 1                                                                                                                     |
| Spec       | REQ-ASG-005, REQ-ASG-007, REQ-ASG-008, REQ-ASG-009, REQ-ASG-010, REQ-ASG-011 · REQ-NFR-004, REQ-NFR-005 · T-ASG-1 to T-ASG-5 |
| Depends on | F09, Q1, Q5                                                                                                                  |
| Blocks     | None                                                                                                                         |

## Goal

When a Tester opens the popup on the Intake Site, they see right away which experiments are running on the page and whether they're in Control or Treatment.

## Tasks

### F10-T1: "On this page" list

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F09-T3, F09-T4, Q1
- **Description:** For each experiment, show the name, the group name, the arm badge, and the override mark (REQ-ASG-005, REQ-ASG-007), plus a source label ("live", or "cached · 5 min ago") (REQ-ASG-002). Goal: the list shows within 3 seconds of opening if cached values exist (REQ-NFR-005), so render from the cache first and don't wait on the Console API to draw the list.
- **Acceptance criteria:**
  - [ ] Component tests for each badge state and the source label
  - [ ] It renders from page values before Console API names arrive (shows names when they're ready)
- **Verification:** `pnpm vitest run src/components`; manual T-ASG-1 and T-ASG-2 on staging
- **Files likely touched:** new components under `src/components/my-groups/`, a hook

### F10-T2: "All running experiments" view

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F10-T1
- **Description:** REQ-ASG-008. A two-way switch, with "On this page" as the default. The second view lists every running experiment from the Console API (proposed: `status: active`, WL-016), and those missing from the SDK values show "Not evaluated on this page".
- **Acceptance criteria:**
  - [ ] Component tests for the default view and for the "Not evaluated on this page" state
- **Verification:** `pnpm vitest run src/components`
- **Files likely touched:** the my-groups components

### F10-T3: Refresh, auto-refresh, and the empty states

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F10-T1, F07-T3
- **Description:** A Refresh action, plus an automatic refresh after a page reload caused by an override change (REQ-ASG-009). Listen for the tab finishing its load, then read again, and allow for the SDK starting up after load. Show one clear message when the tab isn't an Intake Site or the SDK is missing (REQ-ASG-010). Works with a read key (REQ-ASG-011).
- **Acceptance criteria:**
  - [ ] T-ASG-5: a page without the SDK shows the single message
  - [ ] The list updates by itself after a force or clear, with no manual refresh
  - [ ] Works with a read key (unit tested)
- **Verification:** `pnpm vitest run src/hooks src/components`
- **Files likely touched:** the my-groups hook, `src/hooks/use-detected-user.ts`

### F10-T4: E2E tests for Job 1

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F10-T3
- **Description:** REQ-NFR-004. Playwright with a mocked Console API and seeded SDK values: live values, cache-only values, a "CONTROL" group, a forced Treatment with the override mark, and no SDK.
- **Acceptance criteria:**
  - [ ] T-ASG-1 to T-ASG-5 are automated and pass in `pnpm test:e2e`
- **Verification:** `pnpm test:e2e`
- **Files likely touched:** `e2e/my-groups.e2e.ts` (new), `e2e/mock-data.ts`, `e2e/mocks.ts`
