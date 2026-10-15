# F00: Pre-build checks (spec §8.1)

| Field      | Value                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| Status     | In progress                                                            |
| Phase      | 0: Pre-build checks                                                    |
| Spec       | §8.1 · OPEN-001, OPEN-004, OPEN-005, OPEN-007, OPEN-008 · §7 rules 1–2 |
| Depends on | None                                                                   |
| Blocks     | F06 (T1, T3), F09 (T1, T2), F12-T3                                     |

## Goal

Confirm the facts that the override code and the values reader depend on before any of that code is written. A wrong guess about OPEN-004 deletes other users' overrides in production. Record every result in `WORKLOG.md`.

## Tasks

### F00-T1: Record the Console API request shapes

- **Status:** Done (2026-10-14). See WL-016, WL-017, WL-018.
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** Read the official Console API reference (start from `docs/urls_experiments.md` and `docs/urls_gates.md`). Record the exact method, path, body, and documented behavior for each endpoint we'll use. Don't guess (spec §7 rule 1).
- **Acceptance criteria:**
  - [x] Experiment overrides: GET, POST, PATCH, and DELETE, each with its body shape and whether it replaces or adds to the list. Replace-or-add isn't stated in words, only suggested by the examples, so F00-T3 confirms it.
  - [x] Layer overrides: the paths and body shapes, and the experiment field that gives the layer ID (`layerID`)
  - [x] Experiment list: how status and archived state appear (`status` enum, filter param), for REQ-OVR-001
  - [x] Documented error codes and the rate limit. `403` isn't documented, so F00-T5 records it.
  - [x] All of it in a `WORKLOG.md` entry, with links to the reference pages
- **Verification:** WL-016 cites the reference page for each endpoint, plus the OpenAPI spec.
- **Files likely touched:** `planning/WORKLOG.md`, `docs/urls_experiments.md`, `docs/urls_layers.md` (new)

### F00-T2: Override on an unstarted experiment (OPEN-001)

- **Status:** Todo
- **Owner:** Maurice (Claude prepares the steps)
- **Size:** XS
- **Depends on:** None
- **Description:** Spec §8.1 check 1. Create an experiment and don't start it. Add a `stableID` override for your Stable ID. Open the Intake Site and record whether the SDK serves the override group.
- **Acceptance criteria:**
  - [ ] The result is in a `WORKLOG.md` entry, and OPEN-001 has an answer
- **Verification:** The WL entry exists.

### F00-T3: Overrides of other IDs survive our write and delete (OPEN-004)

- **Status:** Todo
- **Owner:** Maurice (Claude prepares the curl commands)
- **Size:** S
- **Depends on:** F00-T1
- **Description:** Spec §8.1 check 2, extended to cover delete. On a test experiment, add an override for a second ID. Run the exact write call we plan to use for your ID, then read the overrides back. Next, put two IDs in the same group and delete only yours. Confirm the other ID is still there both times. **Don't skip this check.** The calls under test are the ones WL-016 proposes: `PATCH …/overrides` with only our ID and an empty `overrides: []`, and `DELETE …/overrides/userID/{id}?groupID=…`.
- **Acceptance criteria:**
  - [ ] Write: the second ID survives (or the result says it doesn't)
  - [ ] Write: the PATCH with `overrides: []` keeps the existing gate and segment overrides (an extra case from WL-016)
  - [ ] Write: record whether the PATCH removes the ID from its old group on its own, or leaves it in two groups
  - [ ] Delete: deleting one ID from a group with several IDs keeps the others
  - [ ] Moving an ID from group A to group B leaves it in B only (REQ-OVR-010)
  - [ ] Layer: for an experiment in a layer, its `layerID` works as the path `id` of `PATCH /layers/{id}/overrides` and the single-ID delete
  - [ ] Results in a `WORKLOG.md` entry, and OPEN-004 has an answer
- **Verification:** The WL entry has the request and response for each step.

### F00-T4: Capture the real SDK values (OPEN-007)

- **Status:** Todo
- **Owner:** Maurice (Claude provides a DevTools console snippet)
- **Size:** S
- **Depends on:** None
- **Description:** Spec §8.1 check 3. On the Intake Site (staging first), dump the live SDK values and one `statsig.cached.evaluations.*` entry. Record the fields for the group name, the layer allocation, `hash_used`, the override marker (if any), and the cache time. Save a sanitized copy as a test fixture.
- **Acceptance criteria:**
  - [ ] The field names are in a `WORKLOG.md` entry, and OPEN-007 has an answer
  - [ ] A sanitized fixture (no real user data) at `src/tests/fixtures/intake-sdk-values.json`
  - [ ] If `hash_used` is `sha256`, the exact encoding (hex, base64, or truncated) is recorded
- **Verification:** The fixture parses, and the WL entry exists.
- **Files likely touched:** `src/tests/fixtures/intake-sdk-values.json` (new), `planning/WORKLOG.md`

### F00-T5: Personal Console Key with a non-admin role (OPEN-005, OPEN-008)

- **Status:** Todo
- **Owner:** Maurice
- **Size:** XS
- **Depends on:** F00-T1
- **Description:** Spec §8.1 check 4. Sign in to Statsig as a Tester who isn't an admin. Create a Personal Console Key. Add and clear an experiment override with it, and record every error.
- **Acceptance criteria:**
  - [ ] It's recorded whether the org setting allows personal keys
  - [ ] It's recorded whether a non-admin key can add and clear overrides, with the error codes if not
  - [ ] The real `403` body is recorded (the docs don't cover it, WL-016)
  - [ ] The real `401` body is recorded, using a revoked or made-up key: does it echo the full key? (WL-017)
  - [ ] Results in a `WORKLOG.md` entry, and OPEN-005 and OPEN-008 have answers
- **Verification:** The WL entry exists.
