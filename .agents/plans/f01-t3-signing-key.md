# Brief: F01-T3 Generate a new Chrome signing key

slug: f01-t3-signing-key
status: done (90b8e7c)
agent: f01-t3-signing-key (Sonnet, main working tree)

## Decision

The fork must not reuse the base repository's Chrome `key` (spec REQ-SET-006). We generate a new 2048-bit RSA key
pair. The public half goes in `CRX_PUBLIC_KEY` in `wxt.config.ts`; it pins the extension ID, so it is not a secret.
The private half must never enter the repository, its history, or any worktree. It goes to a directory outside the
repo, and Maurice moves it to a password manager. Ticket: `planning/tickets/F01-rebrand-chrome-only.md` (F01-T3).
Decision record: `planning/WORKLOG.md` WL-020.

Two other agents work on F01 at the same time in separate worktrees (they don't share your working tree). They
edit other parts of `wxt.config.ts` and `.gitignore`. Change only what is listed below so the merges stay clean.

## Owns

```
wxt.config.ts        # ONLY the string value of CRX_PUBLIC_KEY
.gitignore           # ONLY a new section appended at the very end of the file
/private/tmp/claude-501/-Users-maurice-Dev-Workspace-talkiatry-statsig-browser-extension/c22fe54b-4f5b-4e11-83e9-d7394987bb63/scratchpad/f01-signing-key/**
```

Call the last directory `$KEYDIR` below. It already exists with mode 700.

## Environment

The global `pnpm` on this machine can't switch to the pinned pnpm 12.11.2. Start **every** Bash command with:

```
export PATH=/private/tmp/claude-501/-Users-maurice-Dev-Workspace-talkiatry-statsig-browser-extension/c22fe54b-4f5b-4e11-83e9-d7394987bb63/scratchpad/bin:$PATH;
```

That puts a shim first on `PATH` that runs pnpm 12.11.2. Without it, `pnpm` fails with `ENOEXEC`. Don't try to fix the
global pnpm. Baseline on this branch: type-check, lint, knip, and 653 unit tests pass. `pnpm format:check` already
flags `new-feature-spec.md`; that file is not yours, so ignore that one hit and report it.

## Intent

You work in the main working tree (`/Users/maurice/Dev-Workspace/talkiatry/statsig-browser-extension`, branch
`feat/f01-rebrand-chrome-only`). `node_modules` is already installed.

1. **Generate the key pair outside the repo** (PKCS#8 PEM, which Chrome's "Pack extension" accepts):
   - `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEYDIR/intake-experiment-testing.pem"`
   - `chmod 600 "$KEYDIR/intake-experiment-testing.pem"`
   - Never write the private key, or any copy of it, anywhere inside the repository. Never print it to the terminal.
2. **Public key** (base64 of the DER SubjectPublicKeyInfo, one line, no wrapping):
   `openssl pkey -in "$KEYDIR/intake-experiment-testing.pem" -pubout -outform DER | base64 | tr -d '\n'`
   Write it also to `$KEYDIR/public-key.txt`.
3. **Extension ID** (first 32 hex chars of SHA-256 of the DER public key, mapped `0-9a-f` → `a-p`):
   `openssl pkey -in "$KEYDIR/intake-experiment-testing.pem" -pubout -outform DER | shasum -a 256 | head -c 32 | tr 0-9a-f a-p`
   Write it to `$KEYDIR/extension-id.txt`.
4. **`wxt.config.ts`:** replace only the string value of `CRX_PUBLIC_KEY` with the new public key. Keep the
   declaration shape and the comments above it exactly as they are.
5. **`.gitignore`:** append at the very end of the file (after the last existing line), exactly:

   ```

   # Extension signing keys. The private key stays out of the repository (REQ-SET-006).
   *.pem
   ```

6. **Check the ID really loads:** write a throwaway Playwright script under `.agents/scratch/f01-t3-signing-key/`
   that launches Chromium with the built `.output/chrome-mv3` loaded (see `e2e/extension-runtime.ts` for how the
   e2e suite does it), reads the service worker URL, and prints the runtime extension ID. It must equal
   `$KEYDIR/extension-id.txt`. Do not add the script to `e2e/`.

Must not:
- Touch any other part of `wxt.config.ts` (the Firefox block, `name`, `description`, etc. belong to other tasks).
- Put any `.pem`, private key, or key material other than the public key value inside the repository.
- Edit `LICENSE`, `planning/`, or anything else.

## Hard rules

- Own only the files listed under `owns:`. Read anything; edit nothing else.
- Never rename or move files, never restructure directories.
- Never commit, never push, never touch git state.
- Never invent content — no placeholder copy, no fake data, no made-up API fields.
  If the brief doesn't say, stop and ask; don't guess.
- Don't "improve" adjacent code, comments, or formatting you weren't asked to change.
- Remove imports and variables _your_ changes orphaned; leave pre-existing dead code alone.
- Recon first: read the code, write your exact-edit plan to
  `.agents/scratch/f01-t3-signing-key/plan.md`, then build.
- Verify with the commands in the brief. Write results to
  `.agents/scratch/f01-t3-signing-key/checks.json`. Save screenshots to
  `.agents/scratch/f01-t3-signing-key/shots/<name>.png` using the names the brief gives.
- If a check fails, fix it and re-run. Report it if it still fails; never report
  a check as passing that you didn't run.
- Report back in the exact format in the brief.

## Verify

Run:

- `pnpm type-check`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test --run`
- `pnpm build:chrome`, then read `.output/chrome-mv3/manifest.json`: `key` equals `$KEYDIR/public-key.txt` and
  differs from the old key (`MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuEhfW2Y3y8I5...`).
- `pnpm test:e2e` passes (the suite loads the extension with the new key).
- The throwaway Playwright script prints a runtime ID equal to `$KEYDIR/extension-id.txt`.
- `git status --porcelain` lists only `wxt.config.ts` and `.gitignore` as changed (plus untracked files under the
  gitignored `.agents/scratch/`, which won't show).
- `find . -name '*.pem' -not -path './node_modules/*'` → no output.
- `git check-ignore -q probe.pem` → exit 0 (the pattern works; no file needs to exist).
- `git log --all --oneline -- '*.pem'` → no output.

No screenshots for this task.

Write `.agents/scratch/f01-t3-signing-key/checks.json` with one entry per check above.

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

Also report: the new extension ID, and the absolute paths of the private key, `public-key.txt`, and
`extension-id.txt`. Do not include the private key contents.
