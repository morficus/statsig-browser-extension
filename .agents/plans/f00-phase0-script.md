# Brief: F00 phase 0 check script, SDK snippet, and runbook

slug: f00-phase0-script
status: agreed
agent: f00-phase0-script

## Decision

Phase 0 (F00-T2 to F00-T5) is a set of manual checks that Maurice runs against the real Statsig Console API and the Intake Site. They confirm how the override calls behave before any override code is written (F06). The worst outcome is the one F00-T3 exists to catch: if `PATCH …/overrides` replaces the list instead of adding to it, the extension would delete other people's overrides in production (REQ-OVR-009).

The decisions:

- **One bash script** runs the API checks, one subcommand per step. Each step prints the request and the response, then checks the result itself and prints `PASS`, `FAIL`, or `OBSERVE`. Maurice runs it, often as `! bash planning/phase0/f00-check.sh <step>` inside Claude Code, so the output lands in the conversation. Claude writes the WORKLOG entries from that output. **The output must never contain a key.**
- **The key lives in `planning/phase0/.env`** (Maurice's choice, not Keychain). `.gitignore` already ignores `.env*`, so the file is never committed. It's not at the repo root, so WXT never loads it. The committed template is `planning/phase0/env.example` (no leading dot, so it isn't ignored).
- **Only throwaway test objects.** The script refuses to write unless the experiment's name starts with `intake_ext_phase0_` and its status is `setup` (not started). A wrong guess must never touch a real experiment.
- **One DevTools snippet** captures the Intake SDK values (F00-T4). It runs twice: before the T3 writes (a baseline) and after them. Comparing the two runs answers F00-T2 (OPEN-001: does an override work on an experiment that isn't started?) and shows the override marker (OPEN-007).
- **F00-T5 is split.** Maurice is an admin and has no second account. The script covers what an admin can check: the real `401` body from a made-up key, and the real `403` body from a read-only key. The non-admin check waits for the first Tester. It isn't part of this brief.

Sources for every request shape: `planning/WORKLOG.md` entry **WL-016** (read it in full), and the API reference pages it links. Don't use a request shape that WL-016 doesn't record. The base URL and version header are in `src/lib/api-config.ts` (`https://statsigapi.net/console/v1`, `STATSIG-API-VERSION: 20240601`).

## Owns

```
planning/phase0/f00-check.sh
planning/phase0/t4-sdk-snippet.js
planning/phase0/env.example
planning/phase0/README.md
```

Anything else is read-only for this agent. In particular, don't edit `planning/README.md`, `planning/tickets/**`, `planning/WORKLOG.md`, `.gitignore`, or anything under `src/`. Scratch files go in `.agents/scratch/f00-phase0-script/`.

**Never create, read, or print `planning/phase0/.env`.** It holds Maurice's real key. For dry runs, use a fake env file in the scratch folder (see Verify).

## Intent

### A. `planning/phase0/f00-check.sh`

**Runtime.** `#!/usr/bin/env bash`. It must run on macOS `/bin/bash` 3.2: no associative arrays, no `mapfile`/`readarray`, no `${var,,}`. Tools: `curl`, `jq` (1.7), and standard macOS utilities. No other dependency. `set -euo pipefail`. Never `set -x`.

**Usage.** `f00-check.sh <step>`. With no step or an unknown step, print the step list with one line each and exit 2.

**Env file.**

- Default path: `.env` in the script's own folder. `PHASE0_ENV_FILE` overrides the path.
- Parse it line by line. Accept `NAME=value`, blank lines, and `#` comments. Strip one pair of matching surrounding quotes from the value. **Never `source` or `eval` it.** Accept only the variable names listed below, and ignore any other name with a warning.
- If the file is inside the git work tree and `git check-ignore -q <file>` says it's not ignored, stop with exit 2. Print a message that says the key file must be git-ignored.
- If the file is readable by group or others, print a warning to run `chmod 600 <file>`. Don't stop.

**Variables.** These are also the contents of `env.example`, with one comment line each:

| Name                  | Required for         | Default             | Meaning                                                                                   |
| --------------------- | -------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `STATSIG_CONSOLE_KEY` | every step but t5-401 | none                | Maurice's Personal Console Key, with write access.                                       |
| `EXPERIMENT`          | every step but t5-401 | none                | Test experiment name (the path `id`). Must start with `intake_ext_phase0_`.              |
| `LAYER_EXPERIMENT`    | t3-layer, cleanup    | none                | Test experiment that is in the test layer. Must start with `intake_ext_phase0_`.         |
| `LAYER_ID`            | t3-layer, cleanup    | none                | The `layerID` that `preflight` prints for `LAYER_EXPERIMENT`. Maurice copies it in.      |
| `STABLE_ID`           | t3-*, t5-403, cleanup | none                | Maurice's Stable ID on staging. The T4 snippet prints it.                                 |
| `ENVIRONMENT`         | t3-*, t5-403, cleanup | none                | Exact Console environment name for the overrides (e.g. the staging environment).          |
| `GROUP_A`             | t3-*, t5-403         | `Control`           | First group name. Group names are the override key (`groupID` / `groupName`, WL-016).    |
| `GROUP_B`             | t3-*                 | `Test`              | Second group name.                                                                        |
| `OTHER_ID_A`          | t3-*, cleanup        | `phase0-other-id-a` | Made-up "other person" ID, seeded into `GROUP_A`.                                         |
| `OTHER_ID_B`          | t3-*, cleanup        | `phase0-other-id-b` | Made-up "other person" ID, seeded into `GROUP_B`.                                         |
| `READ_ONLY_KEY`       | t5-403 (optional)    | none                | A Console key with read-only access. If it's empty, `t5-403` prints `SKIP` and exits 0. |

If a step needs a variable that is missing, stop with exit 2 before any request, and name the variable.

**Key safety. All four are required:**

1. **Key never in argv.** Pass the `STATSIG-API-KEY` header to curl so the key isn't in the process arguments (e.g. `-H @<(printf …)` or `--config` from stdin). Never put it in a URL.
2. **Key never in output.** Every byte the script writes to stdout and stderr goes through a filter. The filter replaces each non-empty value of `STATSIG_CONSOLE_KEY` and `READ_ONLY_KEY` with `<redacted>`, as a literal string, not a regex. Keys can hold regex characters. Responses that echo the key must come out redacted too.
3. **Header names only.** The printed request shows the method, the full URL, header names (never values for the key header), and the body.
4. **No verbose curl.** Never use `-v` or `--trace`. Use `-sS`, capture the HTTP status, and capture the body. A curl transport error prints curl's message (filtered) and counts as `FAIL` for that step.

**Requests.**

- Headers: `STATSIG-API-KEY`, `STATSIG-API-VERSION: 20240601`, `Accept: application/json`, and `Content-Type: application/json` on requests with a body.
- URL-encode every path segment and query value (`jq -rn --arg v … '$v|@uri'`).
- Wait 1 second after every write (PATCH or DELETE). This is for Statsig's burst protection (WL-016).
- Only these calls are allowed. They're the WL-016 shapes:
  - `GET /experiments/{EXPERIMENT}` and `GET /experiments/{LAYER_EXPERIMENT}`
  - `GET /experiments/{id}/overrides`
  - `PATCH /experiments/{id}/overrides` with body `{"overrides":[],"userIDOverrides":[{"groupID":<group>,"ids":[<one id>],"environment":<ENVIRONMENT>,"unitType":"stableID"}]}`. Exactly one entry with exactly one ID, every time.
  - `DELETE /experiments/{id}/overrides/userID/{userID}?groupID=<group>&unitType=stableID&environment=<ENVIRONMENT>`
  - `GET /layers/{LAYER_ID}/overrides`
  - `PATCH /layers/{LAYER_ID}/overrides` with body `{"op":"add","conditionalOverrides":[],"idOverrides":[{"groupName":<group>,"ids":[<one id>],"idType":"stableID","environment":<ENVIRONMENT>,"experimentName":<LAYER_EXPERIMENT>}]}`
  - `DELETE /layers/{LAYER_ID}/overrides/userID/{userID}?groupName=<group>&experimentName=<LAYER_EXPERIMENT>&idType=stableID&environment=<ENVIRONMENT>`
- **Never** call `POST …/overrides` or the bulk `DELETE …/overrides`. Never call any other endpoint.

**Write guard.** Every step that writes runs it first, and stops with exit 2 on any failure, before its first write:

- `EXPERIMENT` starts with `intake_ext_phase0_`.
- `GET /experiments/{EXPERIMENT}` returns 200, with `data.status == "setup"` and `data.idType == "stableID"`. `GROUP_A` and `GROUP_B` are both in `data.groups[].name`.
- For layer steps, the same checks on `LAYER_EXPERIMENT` (only `GROUP_A` must exist there), plus `data.layerID == LAYER_ID`.

**Comparing state.** All checks use these derived views of a GET response:

- Experiment ID tuples: for each `data.userIDOverrides[]` item and each ID in its `ids`, the tuple `(groupID, environment, unitType, id)`. Keep a null environment or unitType as `null`.
- Layer ID tuples: for each `data.idOverrides[]` item, `(groupName, environment, idType, experimentName, id)`.
- Conditional overrides: `data.overrides` (experiment) or `data.conditionalOverrides` (layer), compared as canonical JSON (`jq -S -c`).
- **"Others unchanged"** means: the set of tuples whose id is not `STABLE_ID` is the same before and after, and the conditional overrides are the same before and after. (For `t3-seed`, the seeded tuples are the expected difference.)

Print every check as one line, padded so the results line up, e.g. `CHECK  OTHER_ID_A still in Control (staging) ........ PASS`. Observations are `OBSERVE  <what> ........ <value>`. `SKIP` is for dry runs and the optional step. Each step ends with `RESULT <step>: PASS` or `RESULT <step>: FAIL (<n> failed)`.

**Exit codes.** 0 = every check passed. 1 = at least one check failed. 2 = config, guard, or precondition error.

**Steps.** Each step begins with a header line `== <step> ==` and the date and time (UTC), then prints the GET it starts from.

1. **`preflight`** (read only). Print the following for `EXPERIMENT`, and for `LAYER_EXPERIMENT` if it's set: name, `status`, `idType`, `groups[].name`, `layerID`. Print the current overrides of `EXPERIMENT`, and of the layer if `LAYER_ID` is set. Run every guard check and report each one as a `CHECK` line, without stopping. Also `CHECK` that `EXPERIMENT` has at least one conditional override, because T3 needs a gate or segment override to prove the PATCH keeps it. If `LAYER_EXPERIMENT` is set but `LAYER_ID` isn't, print `ACTION  set LAYER_ID=<layerID> in the env file`.
2. **`t3-seed`.** Precondition: at least one conditional override (else exit 2, and tell Maurice to add a gate override in the Console). PATCH `OTHER_ID_A` into `GROUP_A`, then PATCH `OTHER_ID_B` into `GROUP_B`, as two separate calls. CHECK: both seeded tuples are present, and every tuple from before is still present. CHECK: the conditional overrides are unchanged. Running the step again must be safe.
3. **`t3-write`.** Precondition: both seeds are present (else exit 2, run `t3-seed`). PATCH `STABLE_ID` into `GROUP_B`. CHECK: `STABLE_ID` is in `GROUP_B`. CHECK: `OTHER_ID_B` is still in `GROUP_B` (catches a replace inside the same group). CHECK: `OTHER_ID_A` is still in `GROUP_A`. CHECK: others unchanged. CHECK: the conditional overrides are unchanged. This is the F00-T3 criteria "second ID survives" and "`overrides: []` keeps gate and segment overrides".
4. **`t3-same-id-new-group`.** Precondition: `STABLE_ID` is in `GROUP_B` (else exit 2, run `t3-write`). PATCH `STABLE_ID` into `GROUP_A`. CHECK: `STABLE_ID` is in `GROUP_A`. CHECK: others unchanged. OBSERVE: "`STABLE_ID` still in `GROUP_B` after PATCH into `GROUP_A`" with `yes` (leaves it in two groups) or `no` (PATCH moves it). This is the criterion "does the PATCH remove the ID from its old group on its own".
5. **`t3-delete-one`.** Precondition: `STABLE_ID` and `OTHER_ID_A` are both in `GROUP_A` (else exit 2, run `t3-same-id-new-group`). DELETE `STABLE_ID` from `GROUP_A`. CHECK: `STABLE_ID` is not in `GROUP_A`. CHECK: `OTHER_ID_A` is still in `GROUP_A`. CHECK: others unchanged. CHECK: `STABLE_ID`'s tuples outside `GROUP_A` are unchanged. Send the same DELETE again, then CHECK: status 200 and no change (idempotent, WL-016).
6. **`t3-move`.** This is the planned F06-T1 flow, remove first and then add. Setup, printed as `SETUP` lines: if `STABLE_ID` is in `GROUP_B`, DELETE it there. If it's not in `GROUP_A`, PATCH it into `GROUP_A`. Then CHECK that it's in `GROUP_A` only. Then the move: DELETE `STABLE_ID` from `GROUP_A`, then PATCH it into `GROUP_B`. CHECK: `STABLE_ID` is in `GROUP_B` only (no other group, in `ENVIRONMENT`). CHECK: others unchanged. CHECK: the conditional overrides are unchanged. **The step ends with `STABLE_ID` in `GROUP_B`.** F00-T2 needs that state. Print `NEXT  reload the Intake Site and run the T4 snippet again (F00-T2)`.
7. **`t3-layer`.** Layer guard first. GET the layer overrides. PATCH `OTHER_ID_A` into `GROUP_A`. PATCH `STABLE_ID` into `GROUP_A`. CHECK: both are present, and every tuple from before is still present. CHECK: the conditional overrides are unchanged. DELETE `STABLE_ID` (group `GROUP_A`). CHECK: `STABLE_ID` is gone from `GROUP_A`, `OTHER_ID_A` is still there, and the other tuples are unchanged. OBSERVE: "layerID works as the layer path id" with `yes` if every layer call returned 200. This is the F00-T3 criterion for layers.
8. **`t3`.** Runs steps 2 to 7 in order, and stops at the first step that doesn't exit 0.
9. **`t5-401`.** GET `/experiments/{EXPERIMENT}/overrides`, or `/experiments` if `EXPERIMENT` is unset, using the made-up key `console-PHASE0FAKEKEY0123456789abcdefABCDEF`. Don't redact this key: it's fake on purpose. Print the status and the raw body. OBSERVE: the status. OBSERVE: "body echoes the full key" yes or no. OBSERVE: "body echoes part of the key" yes or no, with the echoed fragment. This is WL-017.
10. **`t5-403`.** Without `READ_ONLY_KEY`: print `SKIP` and exit 0. Otherwise run the write guard, then PATCH `STABLE_ID` into `GROUP_A` using `READ_ONLY_KEY`. Print the status and the body, redacted. OBSERVE: the status. If the status is 2xx, print `WARNING  the read-only key was allowed to write`, and say that `cleanup` removes it.
11. **`cleanup`.** Uses the main key. Guards as for writes, but the layer part runs only if `LAYER_EXPERIMENT` and `LAYER_ID` are set. GET the experiment overrides. For every tuple whose id is `STABLE_ID`, `OTHER_ID_A`, or `OTHER_ID_B`, single-ID DELETE it with that tuple's own group, environment, and unitType. Do the same for the layer, using each tuple's own groupName, environment, idType, and experimentName. Never touch another ID. CHECK: none of the three IDs remain. CHECK: every tuple of any other ID is unchanged. CHECK: the conditional overrides are unchanged. Then print `NEXT  remove the gate override and delete the test experiments and layer in the Console`.

A null environment or unitType in a tuple can't go in the DELETE query. Leave that query parameter out, per WL-016: leaving out `environment` targets the all-environments bucket. Only `cleanup` can meet such a tuple.

**Dry run.** With `DRY_RUN=1`, the script makes **no network calls at all**. It prints every request it would send, with a `DRY RUN` marker. It treats each GET response as empty and prints every CHECK as `SKIP (dry run)`. Guards that need a response are skipped and say so. The name-prefix guard and the env-file checks still run. Steps that need a GET result to decide what to send (`t3-move` setup, `cleanup`) print what they would decide from an empty state.

### B. `planning/phase0/t4-sdk-snippet.js`

Paste into the Chrome DevTools console on the Intake Site (staging: `https://app.staging.talkiatry.com/assessment…`). It is **read only**: no writes to any storage, no network requests, no DOM changes.

- Top of the file: a comment that says how to use it, then three constants that Maurice edits: `EXPERIMENT`, `LAYER_EXPERIMENT`, `LAYER_ID` (defaults `'intake_ext_phase0_check'`, `'intake_ext_phase0_layer_check'`, `''`).
- One self-contained async IIFE. No imports. Modern Chrome only.
- **Find the SDK instance** the same way `src/lib/get-user-details-injector.ts` does: read it, and use the same globals and fallbacks in the same order. Report which path found it. Then get the values the client holds: try `instance.getContext().values` first. If that's missing, report the keys of `getContext()` and of the instance (names only) so we can find them. **Don't guess other private fields.**
- **Find the Stable ID** with the same order as the injector, plus a fallback to the first `localStorage` key that starts with `statsig.stable_id.`. Report the source. Also report `getContext().options?.environment?.tier`, or `null`.
- **Hash check.** For each of `EXPERIMENT`, `LAYER_EXPERIMENT`, and `LAYER_ID` (if not empty), compute candidates: the raw name, djb2, sha256 as lowercase hex, and sha256 as standard base64 (`crypto.subtle.digest`). For djb2, reuse the repo's implementation if one exists (search `src/`). If there's none, use Statsig js-client's `_DJB2`: `hash = 0`; for each UTF-16 code unit `c`: `hash = (hash << 5) - hash + c; hash = hash & hash`; the result is `String(hash >>> 0)`. Look each candidate up in `dynamic_configs` and `layer_configs`. Report which candidate matched, or that none did. Report `hash_used` as found.
- **Output object**, then `console.log(JSON.stringify(output, null, 2))`, and also `copy(...)` the same string when `copy` exists. Then print a separate, clearly labeled line: `Stable ID for planning/phase0/.env: <id>`. That line is the only place the real Stable ID appears.
  - `capturedAt` (ISO), `page` (`location.origin + location.pathname`, no query string or hash), `sdkFoundBy`, `stableIdSource`, `environmentTier`
  - `values.hashUsed`, and `values.topLevel`: for each top-level key of the values, its type, plus a key count for objects and the value for scalars. Drop `user`, `evaluated_keys`, and `derived_fields`, and list them under `values.dropped`.
  - `values.hashCheck`: per name, its candidates, and which matched where.
  - `values.entries`: the full matched entries from `dynamic_configs` and `layer_configs`, keyed by the readable name.
  - `values.sampleShape`: for the first entry of `dynamic_configs` and of `layer_configs`, the field names and value types only, with no values.
  - `values.unmatchedConfigKeys`: only if a name had no match. The full key list of `dynamic_configs` and `layer_configs` (they're hashes or names, not user data).
  - `localStorage`: every key that starts with `statsig.` (names only). For the first `statsig.cached.evaluations.` key: its top-level field names and types, the values of any field named `source` or `receivedAt`, and whether its `data` field parses as JSON with the same top-level keys as `values`.
- **Sanitize** before printing. In the final JSON string, replace every occurrence of the Stable ID with `<stable-id>`. Also replace `user.userID`, `user.email`, and any `user.customIDs` values (taken from `getContext().user`, if it exists) with `<user-id>`, `<email>`, and `<custom-id>`.
- If something isn't found, the output says so in a field. The snippet doesn't throw: wrap the body, and on an error print the message and what it had so far.

### C. `planning/phase0/env.example`

The variables table above, as `NAME=` lines, each with its default (or empty) and one `#` comment line above it. First line: `# Copy to planning/phase0/.env (git-ignored) and run chmod 600 on it. Never commit the copy.`

### D. `planning/phase0/README.md`

The runbook for Maurice. Write it in ASD-STE100-style simplified English, like `planning/` (short sentences, one instruction per sentence). Don't make up Statsig Console UI menu paths: say what to create, not which buttons to click. Sections, in this order:

1. **Before you start.** Copy `env.example` to `.env`. Run `chmod 600`. Put in a Personal Console Key with write access (the kind of key a Tester uses). Say how to run steps: `bash planning/phase0/f00-check.sh <step>`, or `! bash planning/phase0/f00-check.sh <step>` in Claude Code so the output goes to the conversation. Say: send the output to Claude, and Claude records the results in `planning/WORKLOG.md`.
2. **Create the test objects** in the Statsig project that the Intake Site uses:
   - Experiment `intake_ext_phase0_check`, ID type Stable ID, groups `Control` and `Test`. Don't start it.
   - On it, one gate or segment override (any existing gate, to `Control`). This proves the PATCH keeps it. The experiment isn't read by Intake code.
   - Layer `intake_ext_phase0_layer`, with experiment `intake_ext_phase0_layer_check` in it. Same ID type and groups. Don't start it.
   - Set `EXPERIMENT` and `LAYER_EXPERIMENT` in `.env`.
3. **T4 baseline.** Open the staging assessment page. Paste the snippet into the DevTools console. Send the JSON to Claude. Put the printed Stable ID in `STABLE_ID`. Put the Console environment that matches the printed tier in `ENVIRONMENT`.
4. **Preflight.** Run `preflight`. Put the printed `layerID` in `LAYER_ID`. Every CHECK must pass before you continue.
5. **T3.** Run `t3`, or run each step in order: `t3-seed`, `t3-write`, `t3-same-id-new-group`, `t3-delete-one`, `t3-move`, `t3-layer`. If a step fails, stop and send the output to Claude. **Don't run `cleanup` yet**, because T2 needs the state `t3-move` leaves.
6. **T2 and T4 after the override.** Reload the staging page. Run the snippet again. Send the JSON to Claude. This shows whether the SDK serves `Test` for an experiment that isn't started.
7. **T5, admin part.** Run `t5-401`. Create a read-only Console key, put it in `READ_ONLY_KEY`, and run `t5-403`. In Statsig's org settings, record whether Personal Console Keys are allowed. Tell Claude. The non-admin part of T5 waits for the first Tester.
8. **Clean up.** Run `cleanup`. In the Console, remove the gate override, delete both test experiments and the layer, and revoke the read-only key. Delete `planning/phase0/.env`.

Under the title, add one short paragraph: what phase 0 confirms, with links to `../tickets/F00-pre-build-checks.md` and `../WORKLOG.md` (WL-016).

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/<slug>/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/<slug>/checks.json`. Save screenshots to
  `.agents/scratch/<slug>/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.
- **Brief-specific:** never send any request to `statsigapi.net` or any other host. Run the script only with `DRY_RUN=1`, and only with the fake env file. Never create, read, or print `planning/phase0/.env`.

## Verify

Make a fake env file at `.agents/scratch/f00-phase0-script/dry.env`. Set every variable. Use `STATSIG_CONSOLE_KEY=console-FAKE.key+with$regex*chars` and `READ_ONLY_KEY=console-FAKE-READONLY-[key]`, plus `EXPERIMENT=intake_ext_phase0_check` and made-up values for the rest.

Run:

- `bash -n planning/phase0/f00-check.sh` → exit 0
- `shellcheck planning/phase0/f00-check.sh` → no warnings, or each remaining one justified in Deviations
- For each step (`preflight`, `t3-seed`, `t3-write`, `t3-same-id-new-group`, `t3-delete-one`, `t3-move`, `t3-layer`, `t3`, `t5-401`, `t5-403`, `cleanup`): `DRY_RUN=1 PHASE0_ENV_FILE=.agents/scratch/f00-phase0-script/dry.env /bin/bash planning/phase0/f00-check.sh <step>`. Save the combined output to `.agents/scratch/f00-phase0-script/dry-<step>.txt`. Each one must exit 0.
- Grep all the `dry-*.txt` files for both fake key values, as literal strings → 0 hits. Check that `<redacted>` doesn't show up where no key was printed.
- Redaction self-test: a small scratch test, not committed, that pipes a line holding both fake keys through the script's redaction filter → both are replaced. If the filter can't be called alone, describe how you tested it.
- Guard test: set `EXPERIMENT=real_experiment` in a copy of the dry env, run `t3-write` with `DRY_RUN=1` → exit 2, and no request printed.
- Env-file guard test: copy the dry env to `planning/phase0/not-ignored-test.txt`, run `preflight` with `PHASE0_ENV_FILE` pointing to it → exit 2. **Delete that file right after.**
- No key in argv: show in Deviations, or in a line of the report, how the header reaches curl.
- `node --check planning/phase0/t4-sdk-snippet.js` → exit 0
- Snippet harness, scratch only: run the snippet in Node (`vm`) with a stub `window.__STATSIG__` that matches what the injector expects, a stub `localStorage`, `location`, `copy`, and `crypto.subtle` from Node. Give the stub `getContext()` a `values` object with `hash_used`, `dynamic_configs` holding a djb2-keyed entry for `intake_ext_phase0_check`, a `user` with an email, and a stable ID. Check that the output finds the entry by djb2, drops `user`, and has no stable ID or email in the JSON.
- `pnpm lint` → exit 0
- `pnpm exec oxfmt --check planning/phase0` (or the repo's equivalent for these paths) → clean. Format only your own files.

Write `.agents/scratch/f00-phase0-script/checks.json`, with one entry per item above.

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
