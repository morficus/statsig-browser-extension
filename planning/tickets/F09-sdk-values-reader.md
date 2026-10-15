# F09: SDK values reader

| Field      | Value                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Status     | Todo                                                                                                                  |
| Phase      | 3: Job 1                                                                                                              |
| Spec       | REQ-ASG-001, REQ-ASG-002, REQ-ASG-003, REQ-ASG-004, REQ-ASG-006, REQ-ASG-007 · OPEN-007 · §9 "Hosted payload changes" |
| Depends on | F00-T4 (real field names and fixture), F05-T1                                                                         |
| Blocks     | F10, F11-T4 (footer data)                                                                                             |

## Goal

A pure, tested pipeline: SDK values (live or cached), then matched experiment names, then group and arm for each experiment. If the payload shape changes, it fails safely and shows "Not available".

## Notes

- Suggested split: the page reader returns **raw** values plus their source and time, and the popup does the hashing and matching. That keeps the self-contained injected function small, and `crypto.subtle` for `sha256` is easier to use and test in the popup. Log the decision when this ticket starts.

## Tasks

### F09-T1: Read the evaluation values (live first, then cached)

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F00-T4, F05-T1
- **Description:** WL-009. Extend the page reader to return the evaluation values from the live SDK instance, or, if there's no live SDK, the newest `statsig.cached.evaluations.*` entry, along with `source: 'live' | 'cached'` and the cache time if it has one (REQ-ASG-001, REQ-ASG-002). Keep it self-contained. Validate the shape in the popup (zod is already a dependency), and any parse failure gives "Not available".
- **Acceptance criteria:**
  - [ ] Unit tests with the F00-T4 fixture for live, cached, both, neither, and malformed input
  - [ ] Source and cache age are returned correctly
- **Verification:** `pnpm vitest run src/lib`
- **Files likely touched:** `src/lib/get-user-details-injector.ts`, `src/lib/sdk-values.ts` (new, the schema and parser), tests

### F09-T2: Match hashed names to Console API experiments

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F09-T1, F00-T4 (the `sha256` encoding)
- **Description:** REQ-ASG-003. Support `hash_used` values `djb2` (reuse `src/lib/djb2.ts`), `sha256` (`crypto.subtle`, using the encoding F00-T4 confirms), and `none`. Build a lookup from hash to experiment name, covering both experiments and layers.
- **Acceptance criteria:**
  - [ ] Unit tests with known hash vectors for all three methods
  - [ ] Unknown hashes are kept and reported as unmatched, not dropped silently
- **Verification:** `pnpm vitest run src/lib/hash-match.test.ts`
- **Files likely touched:** `src/lib/hash-match.ts` (new), its test

### F09-T3: Resolve assignments and classify the arm

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F09-T1, F09-T2
- **Description:** For each experiment, work out whether the Tester is enrolled and in which group. If Statsig served the layer but not the experiment, use the layer entry to find the experiment allocated to the Tester (REQ-ASG-004). Add a pure `classifyArm()` for REQ-ASG-006: not in the experiment gives "Not enrolled", a group named "control" in any letter case gives "Control", and anything else gives "Treatment" plus the group name.
- **Acceptance criteria:**
  - [ ] `classifyArm` unit tests include "CONTROL", "Control", "control ", "Test", and not enrolled (T-ASG-3)
  - [ ] Layer allocation is unit tested with the fixture
- **Verification:** `pnpm vitest run src/lib`
- **Files likely touched:** `src/lib/assignments.ts` (new), its test

### F09-T4: Override mark

- **Status:** Todo
- **Owner:** Claude
- **Size:** XS
- **Depends on:** F09-T3, F06-T4
- **Description:** REQ-ASG-007. Mark each experiment that has an override record for this Stable ID. If F00-T4 found a reliable override marker in the values, also use it, and log which one wins when they disagree.
- **Acceptance criteria:**
  - [ ] Unit tests for record only, marker only, and both
- **Verification:** `pnpm vitest run src/lib`
- **Files likely touched:** `src/lib/assignments.ts`, its test
