# Phase 0 checks (F00)

Phase 0 confirms how the Console API override calls behave before we write the override code (F06). It also records the SDK values that the Intake Site holds. The tasks are in [F00](../tickets/F00-pre-build-checks.md). The request shapes come from WL-016 in [`WORKLOG.md`](../WORKLOG.md).

## 1. Before you start

1. Copy `env.example` to `.env` in this folder.
2. Run `chmod 600 planning/phase0/.env`.
3. In `.env`, set `STATSIG_CONSOLE_KEY` to a Personal Console Key with write access. This is the kind of key that a Tester uses.

To run a step, use `bash planning/phase0/f00-check.sh <step>`. In Claude Code, use `! bash planning/phase0/f00-check.sh <step>`. Then the output goes into the conversation.

Send the output of each step to Claude. Claude records the results in [`WORKLOG.md`](../WORKLOG.md).

- The script never prints the key. It prints `<redacted>` in its place.
- The script stops if git does not ignore the key file.
- To see the requests without sending them, put `DRY_RUN=1` before the command.
- To see the list of steps, run the script without a step.
- Exit code `0` means that every check passed. Exit code `1` means that a check failed. Exit code `2` means a configuration, guard, or precondition error.

## 2. Create the test objects

Create these objects in the Statsig project that the Intake Site uses:

- An experiment with the name `intake_ext_phase0_check`. Set its ID type to Stable ID. Give it the groups `Control` and `Test`. Do not start it.
- On this experiment, one gate or segment override. Use any existing gate, and send it to `Control`. This override proves that the PATCH keeps it. Intake code does not read this experiment.
- A layer with the name `intake_ext_phase0_layer`. Put an experiment with the name `intake_ext_phase0_layer_check` in it. Give it the same ID type and groups. Do not start it.

Then set `EXPERIMENT` and `LAYER_EXPERIMENT` in `.env`.

The script writes only to experiments whose name starts with `intake_ext_phase0_` and whose status is `setup`. It writes only to a layer whose ID starts with `intake_ext_phase0_`. The experiment in that layer can have any name. Do not put the test experiment in a real layer.

## 3. T4 baseline

1. Open the staging assessment page (`https://app.staging.talkiatry.com/assessment`).
2. Open the Chrome DevTools console.
3. If your test objects have other names, set the three constants at the top of `t4-sdk-snippet.js` first.
4. Paste all of `t4-sdk-snippet.js`, then press Enter.
5. Send the JSON to Claude. The snippet also copies it to the clipboard.
6. The last line shows your Stable ID. Put it in `STABLE_ID`.
7. The JSON shows `environmentTier`. Put the Console environment that matches this tier in `ENVIRONMENT`. Use the exact name.

The snippet only reads. It does not write to storage, it sends no request, and it does not change the page.

## 4. Preflight

1. Run `preflight`.
2. Put the printed `layerID` in `LAYER_ID`. The `ACTION` line shows the value.
3. Run `preflight` again. Every `CHECK` must pass before you continue.

## 5. T3

Run `t3`. Or run each step in this order:

| Step                   | What it checks                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `t3-seed`              | It adds two made-up "other person" IDs, one in each group.                            |
| `t3-write`             | Your PATCH keeps the other IDs and the gate override.                                 |
| `t3-same-id-new-group` | Does a PATCH into a second group remove your ID from the first group?                 |
| `t3-delete-one`        | Your DELETE keeps the other ID in the same group. A second DELETE changes nothing.    |
| `t3-move`              | The planned move: DELETE, then PATCH. Your ID ends in `Test` only.                    |
| `t3-layer`             | The same calls on the layer, with the `layerID` of `LAYER_EXPERIMENT` as the path id. |

If a step fails, stop. Send the output to Claude.

**Do not run `cleanup` yet.** T2 needs the state that `t3-move` leaves: your Stable ID in `Test`.

## 6. T2 and T4 after the override

1. Run `t2-layer`. It puts your Stable ID in `Test` in the layer, and leaves it there.
2. Reload the staging page.
3. Run the snippet again.
4. Send the JSON to Claude.

This shows if the SDK serves `Test` for an experiment that is not started (OPEN-001). It shows both cases: the experiment not in a layer (from `t3-move`), and the experiment in the layer (from `t2-layer`).

## 7. T5, admin part

1. Run `t5-401`. It sends a made-up key and shows the `401` body.
2. Create a read-only Console key. Put it in `READ_ONLY_KEY`.
3. Run `t5-403`.
4. In the Statsig org settings, find out if Personal Console Keys are allowed. Tell Claude.

The non-admin part of T5 is F00-T6. It waits for the first Tester.

## 8. Clean up

1. Run `cleanup`.
2. In the Console, remove the gate override.
3. In the Console, delete both test experiments and the layer.
4. Revoke the read-only key.
5. Delete `planning/phase0/.env`.
