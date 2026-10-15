# CLAUDE.md

This repo is a fork of `d0whc3r/statsig-browser-extension`. It is being turned into the "Intake Experiment Testing" Chrome extension. The requirements are in [`new-feature-spec.md`](new-feature-spec.md).

## Current work: Intake Experiment Testing

Before starting or resuming work, read [`planning/README.md`](planning/README.md). It has the board, **Next up**, the open questions, and the definition of done. Each functionality has a ticket in `planning/tickets/` (`F00`–`F12`), with its tasks inside.

- When a task changes status, update its ticket, the board row, and **Next up** in `planning/README.md`.
- Record discoveries, decisions, risks, and resolved questions as new `WL-NNN` entries at the bottom of [`planning/WORKLOG.md`](planning/WORKLOG.md), and cite them from the task. Never edit old entries; add a correcting entry instead.
- Agent briefs for multi-agent work live in `.agents/plans/` (see the `orchestrate` skill in `.claude/skills/`). `planning/` stays the record of truth.

## Commands

| Command                                         | What it does                                     |
| ----------------------------------------------- | ------------------------------------------------ |
| `pnpm install`                                  | Install dependencies and run `wxt prepare`.      |
| `pnpm dev:chrome`                               | Start the WXT dev server for Chrome.             |
| `pnpm build:chrome`                             | Build the extension into `.output/`.             |
| `pnpm zip:chrome`                               | Build and zip the extension.                     |
| `pnpm vitest run`                               | Run all unit tests once.                         |
| `pnpm vitest run src/lib/projects.test.ts`      | Run one unit test file.                          |
| `pnpm vitest run --coverage`                    | Run all unit tests once, with a coverage report. |
| `pnpm test:e2e`                                 | Build for Chrome, then run all Playwright tests. |
| `pnpm exec playwright test e2e/projects.e2e.ts` | Run one e2e file (build first).                  |
| `pnpm type-check`                               | Type-check the app, test, and e2e projects.      |
| `pnpm lint`                                     | Run oxlint.                                      |
| `pnpm lint:fix`                                 | Run oxlint and apply its fixes.                  |
| `pnpm format`                                   | Format files with oxfmt.                         |
| `pnpm format:check`                             | Check formatting without writing.                |
| `pnpm knip`                                     | Find unused files, exports, and dependencies.    |

In a terminal, `pnpm test` starts vitest in watch mode, so use `pnpm vitest run` for a single run. The pre-push hook runs it once, because a git hook has no terminal.

## Definition of done

Source: "Definition of done" in [`planning/README.md`](planning/README.md#conventions).

- `pnpm vitest run` passes, existing tests too (REQ-NFR-002, REQ-GAT-004).
- `pnpm type-check` and `pnpm lint` pass, and `pnpm format:check` is clean (REQ-NFR-006).
- `pnpm build:chrome` succeeds if the task touches the manifest, `wxt.config.ts`, or `entrypoints/`.
- New logic has unit tests (REQ-NFR-003).
- No new dependency unless the task justifies it (spec §7, rule 4).

CI is `.github/workflows/build.yml`. It runs on pull requests, on pushes to `main`, and on manual dispatch. It runs lint, type check, format check, unit tests, the zip build (uploaded as an artifact), and the e2e tests. Superseded runs are cancelled only on pull requests.

## Hard rules

- **REQ-SEC-001 to REQ-SEC-004:** Send the Console Key only to `https://statsigapi.net` (001). Store it only in extension storage, `browser.storage.local` (002). Never write it to page storage, cookies, the page DOM, or logs (003). Show only the first characters of a saved key (004).
- **REQ-SEC-005:** Send all Console API requests through one module, `src/lib/fetcher.ts`, with one base URL constant. A later change to a proxy must need a change in that module only.
- **REQ-SEC-006:** Do not load or run remote code. Do not use `eval` or `new Function`.
- **REQ-SEC-007:** Call only these write endpoints: experiment overrides, layer overrides, and gate overrides. Do not add other write calls.
- **REQ-SET-010:** Do not request a manifest permission that no requirement needs. The allowed permissions are `storage`, `scripting`, and `activeTab`. `debugger` is allowed as an optional permission (REQ-SHT-002).
- **REQ-OVR-009:** Never remove or change an override that does not contain the Stable ID of the Tester. This is a critical requirement.
- **§2.2, REQ-GAT-001:** Do not change the feature gate override feature or dynamic configs. Keep the base behavior.
- **§7 rule 1:** Read the Console API reference before you write override code. Do not guess the request shapes.
- **§7 rule 3:** Keep the page reader function self-contained. Chrome serializes the function when it injects it into the page.
- **§7 rule 4:** Do not add a dependency that you do not need.

## Working in this repo

- `packageManager` pins pnpm 12.11.2.
- Use one branch per functionality or task. Never commit on `main`. Use Conventional Commits.
- `pre-commit` runs `lint-staged`: `oxlint --fix` and `oxfmt --write` on staged files. `pre-push` runs `pnpm test`.
- Claude Code agent worktrees live in `.claude/worktrees/`. Git, lint, format, and vitest ignore `.claude/worktrees/` (F03-T5).
- The spec and the planning docs use ASD-STE100-style simplified English: short sentences, one instruction per sentence. Keep new planning text in that style.
