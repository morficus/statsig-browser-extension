# F05: Stable ID and environment detection

| Field      | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Status     | Todo                                                        |
| Phase      | 2: Job 2                                                    |
| Spec       | REQ-OVR-004, REQ-OVR-005, REQ-OVR-007 · T-OVR-6 · §7 rule 3 |
| Depends on | F02-T3 (the Intake-only guard)                              |
| Blocks     | F07                                                         |

## Goal

The extension reliably knows the Tester's Stable ID and the SDK's environment tier, and gives a manual way out when it can't find the ID.

## Tasks

### F05-T1: Page reader: Stable ID order and environment tier

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** None
- **Description:** WL-009. In `getUserDetailsFromPage`, keep the SDK-instance lookups first (`getStableID()`, `getContext().stableID`, plus the existing instance fallbacks). Then fall back to the first `localStorage` key that **starts with** `statsig.stable_id.`, since the number at the end changes. Never use the cookie. Also return `getContext().options.environment.tier` when it exists. Keep the function self-contained: no imports or module-level values, because Chrome serializes it.
- **Acceptance criteria:**
  - [ ] Unit tests for each step of the lookup order, including a localStorage key with a different number at the end
  - [ ] The result has the Stable ID source (`sdk` or `localStorage`) and the tier (or none)
  - [ ] The existing `get-user-details-injector` tests pass
- **Verification:** `pnpm vitest run src/lib/get-user-details-injector.test.ts src/handlers/get-user-details.test.ts`
- **Files likely touched:** `src/lib/get-user-details-injector.ts`, `src/types/statsig/sdk.ts`, tests

### F05-T2: Error and manual Stable ID entry

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F05-T1, Q1 (where it shows)
- **Description:** REQ-OVR-005. If no Stable ID is found, show an error and an input for entering it by hand. Decide whether a typed-in ID lasts for the popup session or is stored per tab or site, and log the decision.
- **Acceptance criteria:**
  - [ ] T-OVR-6: with the read blocked, the error and the input show, and a typed-in ID is used for forcing
  - [ ] Basic format validation (not empty, trimmed)
- **Verification:** Component tests; covered again in F07-T4 e2e
- **Files likely touched:** a new component under `src/components/`, `src/hooks/use-detected-user.ts`
