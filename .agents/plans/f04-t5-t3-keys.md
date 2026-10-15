# Brief: F04-T5 + F04-T3 Key guidance, key type per project, and read-key write gating

slug: f04-t5-t3-keys
status: done (b086d7a, 6370c8a)
agent: f04-keys (Sonnet, isolated worktree)

## Decision

Two things about Console Keys, done in two phases by one agent because they touch the same forms.

- **F04-T5 (REQ-SEC-010).** Every form where a Tester enters a Console Key tells them to use their own Personal
  Console Key, not a shared project key. That way each change in Statsig is tied to a person.
- **F04-T3 (REQ-SEC-008, REQ-GAT-002).** Read-key mode is dead code today. `apiKeyTypeStorage` supports `read-key`,
  but nothing sets it, and `src/hooks/use-settings-storage.ts:14-18` forces it back to `write-key` (WL-013). Decision
  (WL-026, Q7): the **Tester picks** the key type when adding a key, can change it later on the project, and the type
  is **stored on each project**. Projects saved before this change count as `write-key`, so the current behavior is
  unchanged for them. With a read key, every write action is disabled (not hidden) and shows the reason. One shared
  hook decides this, so the later override features (F07, F08) reuse it.

The background script will separately refuse writes when `local:api_key_type` is `read-key` (another agent owns that).
So `apiKeyTypeStorage` must always reflect **the active project's** type.

Ticket: `planning/tickets/F04-console-api-hardening.md` (F04-T3, F04-T5). Context: `planning/WORKLOG.md` WL-013,
WL-026.

This brief has **two phases**. Do phase 1, verify, report, and **stop**. The lead commits phase 1, then messages you to
do phase 2 in the same worktree.

## Owns

```
src/components/modals/AuthForm.tsx
src/tests/unit/AuthForm.test.tsx
src/components/sheets/settings/AddProjectForm.tsx
src/components/sheets/settings/AddProjectForm.test.tsx      (create if missing)
src/components/sheets/settings/ProjectRow.tsx
src/components/sheets/settings/ProjectsSettings.test.tsx
src/lib/storage.ts                                         (phase 2: only the apiKeyTypeStorage type)
src/lib/projects.ts
src/lib/projects.test.ts
src/store/**
src/hooks/use-projects.ts
src/hooks/use-projects.test.tsx
src/hooks/use-settings-storage.ts
src/hooks/use-settings-storage.test.tsx
src/hooks/use-write-access.ts                              (new)
src/hooks/use-write-access.test.tsx                        (new)
src/hooks/use-overrides-section-logic.ts
src/hooks/use-gate-overrides-logic.ts
src/hooks/use-gate-overrides-logic.test.tsx
src/components/modals/manage-experiment/**
src/components/modals/manage-gate-overrides/**
src/handlers/initial-login.ts                              (read-only; another agent owns it, see below)
e2e/key-type.e2e.ts                                        (new)
```

`src/handlers/initial-login.ts` is owned by another agent this round. Read it, don't edit it. Also don't edit
`entrypoints/background.ts`, `src/lib/fetcher.ts`, `src/lib/api-config.ts`, `src/lib/utils.ts`, `oxlint.config.ts`,
`src/components/sheets/settings/StatsigKeysSettings.tsx`, or `e2e/mocks.ts` (other agents). If you need a change
there, stop and report.

## Intent

Base commit: before anything else run `git log -1 --format=%H`. It must be
`e409c450eba01a8a1625e36f36082f43447da17a`. If it isn't, stop and report. Then run `pnpm install --frozen-lockfile`.

### Phase 1: F04-T5 guidance

1. Find every form where a Console Key is typed. At least `AuthForm.tsx` (the login form) and `AddProjectForm.tsx`.
   If you find another one outside your files, stop and report it.
2. In each, directly under the key input (above the field's error message), show this muted helper text, verbatim:

   > Use your own Personal Console Key, not a shared project key.

   Use `FormDescription` from `src/components/ui/form.tsx` if it exists. Otherwise, match how the codebase renders
   muted helper text (`text-xs text-muted-foreground`). Define the string once (an exported constant in a sensible
   shared place inside your owned files, for example next to `AuthForm`), and use it in both forms.
3. Tests: `AuthForm.test.tsx` and an `AddProjectForm` test assert the text is shown.

### Phase 2: F04-T3 key type and write gating (only after the lead messages you)

The tree will have your phase 1 work in it. Build on it.

1. **Type.** In `src/lib/projects.ts`, export `type ApiKeyType = 'write-key' | 'read-key'`. Add an optional
   `apiKeyType?: ApiKeyType` to `StatsigProject`, with a doc comment: missing means `write-key` (projects saved before
   F04-T3). Add `getProjectKeyType(project): ApiKeyType`, which returns `project.apiKeyType ?? 'write-key'`. In
   `src/lib/storage.ts`, change only the `apiKeyTypeStorage` generic to use `ApiKeyType`. Its storage key
   (`local:api_key_type`) and fallback (`'write-key'`) stay the same.
2. **Sync.** Wherever the settings store writes `apiKeyStorage` from the active project (`src/store/use-settings-store.ts`,
   around line 32), also write `apiKeyTypeStorage` with `getProjectKeyType(activeProject)`. Use `'write-key'` when
   there's no active project. It must update when the active project changes and when the active project's type
   changes.
3. **Remove the forced reset** in `src/hooks/use-settings-storage.ts` (the effect that sets `write-key`). Remove
   anything it orphans. Its test must assert that a stored `read-key` is no longer overwritten.
4. **Picking the type.**
   - `AuthForm.tsx` and `AddProjectForm.tsx` get a field labeled `Key type`, using the existing `Select` from
     `src/components/ui/select.tsx`. Options, in this order: `Read & write` (value `write-key`, the default) and
     `Read only` (value `read-key`). Put it right after the key input and its helper text. The chosen type is saved on
     the new project. Extend `useAddProject` and its callers to accept the type. Keep everything else about adding a
     project as it is.
   - `ProjectRow.tsx` gets the same `Key type` select (same labels and values), showing the project's current type
     (`getProjectKeyType`). Changing it updates that project in `projectsStorage`. If it's the active project,
     `apiKeyTypeStorage` follows through the sync in step 2. Match the row's existing layout and control sizes.
5. **`src/hooks/use-write-access.ts`** (new):
   - `export const READ_ONLY_KEY_REASON = 'Read-only key. Add a key with write access to change overrides.'`
   - `export function useWriteAccess(): { canWrite: boolean; reason: string | null }`. It reads `apiKeyTypeStorage`
     through the existing `useWxtStorage`. While loading: `{ canWrite: false, reason: null }`, so the reason doesn't
     flash. `write-key`: `{ canWrite: true, reason: null }`. `read-key`: `{ canWrite: false, reason: READ_ONLY_KEY_REASON }`.
6. **Gating.** Replace each `typeApiKey === 'write-key'` check (`use-gate-overrides-logic.ts`, `OverridesSection.tsx`
   via `use-overrides-section-logic.ts`) with `useWriteAccess()`. Then make sure that when `canWrite` is false:
   - every write control in the gate overrides UI and in the experiment overrides section (add form inputs, add
     button, delete buttons, and any other control that triggers a write) is **rendered but disabled**. If the
     current code hides them when `canEdit` is false, change it to disabled;
   - the reason shows **once** per section as a single line of muted text (`text-xs text-muted-foreground`) at the
     top of that overrides area. Don't use tooltips or toasts;
   - with a write key, the UI looks and behaves exactly as today (REQ-GAT-001). Existing gate override tests must
     pass unchanged, except for the mechanical change in where `canEdit` comes from.
   - Remove `typeApiKey` from return values and props it no longer feeds.
7. **Unit tests.** `use-write-access` (loading, write, read). The sync (switching the active project between a read
   and a write project updates `apiKeyTypeStorage`). `useAddProject` saves the type. `ProjectRow` changes the type.
   Both forms send the chosen type. With `read-key`, the gate and experiment override UIs show the reason and their
   write controls are disabled. With `write-key`, no reason is shown and the controls are enabled.
8. **E2E (T-SEC-2).** New `e2e/key-type.e2e.ts`, using the existing helpers in `e2e/` (read `e2e/mocks.ts` and an
   existing spec such as `e2e/projects.e2e.ts` first; don't edit them). Cover: a project set to `Read only` → open a
   gate's overrides → the reason is shown and the add control is disabled. Then switch the project to
   `Read & write` → the control is enabled and the reason is gone. When you read `chrome.storage.local` in the test,
   wait for it with `expect.poll` (see WL-023 for why).

Must not:

- Add dependencies.
- Write user-facing text other than the strings given verbatim here (`Key type`, `Read & write`, `Read only`, the
  reason, the guidance).
- Change the storage key names.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f04-t5-t3-keys/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f04-t5-t3-keys/checks.json`. Save screenshots to
  `.agents/scratch/f04-t5-t3-keys/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

After each phase:

- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check` (already flags `new-feature-spec.md`; not yours, ignore that one hit and say so)
- `pnpm vitest run --exclude '.claude/**'`
- `pnpm knip`
- Phase 2 only: `pnpm test:e2e`. `e2e/projects.e2e.ts:63` is a known flaky test (WL-023). If it's the only failure,
  re-run it alone once and report both results.

Screenshots: take them of the popup the way the e2e suite renders it (same extension build, same viewport). Use a
throwaway script or spec inside `.agents/scratch/f04-t5-t3-keys/`, not in `e2e/`. Look at each screenshot yourself
and fix any spacing or alignment that's off compared with the controls around it before you report.

- Phase 1: `auth-form-guidance.png` (login form), `add-project-guidance.png` (Settings, add-project form).
- Phase 2: `auth-form-key-type.png`, `add-project-key-type.png`, `project-row-key-type.png` (Settings, a project row),
  `gate-overrides-read-only.png`, `experiment-overrides-read-only.png`, `gate-overrides-write.png` (write key,
  should look like before).

Write `checks.json` with one entry per check (overwrite it in phase 2).

## Report

```
## Done
<one line>

## Files changed
<path> — <what changed>   (list every changed or added file; the lead copies exactly these)

## Checks
<contents of checks.json>

## Screenshots
<name> — <absolute path>

## Deviations
<where you did something other than what the brief said, and why — or "none">

## Left undone
<anything in the brief you didn't do, and why — or "nothing">
```

Also give the absolute path of your worktree.
