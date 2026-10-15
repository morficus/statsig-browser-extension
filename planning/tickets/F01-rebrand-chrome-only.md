# F01: Rebrand and Chrome-only

| Field      | Value                                |
| ---------- | ------------------------------------ |
| Status     | In progress                          |
| Phase      | 1: Setup & hardening                 |
| Spec       | REQ-SET-001 to REQ-SET-006 · T-SET-1 |
| Depends on | Phase 0 checkpoint (see README Q2)   |
| Blocks     | F12-T2                               |

## Goal

The extension becomes "Intake Experiment Testing", built for Chrome only, with its own signing key. REQ-SET-001 is already met (WL-002).

## Tasks

### F01-T1: Rename the product

- **Status:** In progress
- **Owner:** Claude
- **Size:** M
- **Depends on:** None
- **Description:** Replace "Statsig Browser Extension" as the product name in the manifest (`name`, `default_title`, `description`), in `package.json` (`name`, `description`, `keywords`), in the popup HTML title, and in the UI header. "Statsig" can stay where it names the service (for example "Statsig Console API key"). Keep `LICENSE` and the original copyright notice (REQ-SET-002).
- **Acceptance criteria:**
  - [ ] The built manifest has `name: "Intake Experiment Testing"`
  - [ ] A grep for "Statsig Browser Extension" in `src/`, `entrypoints/`, and `wxt.config.ts` finds nothing
  - [ ] `LICENSE` hasn't changed
- **Verification:** `pnpm build:chrome`, then read `.output/chrome-mv3/manifest.json`. Fix the UI tests that assert the old name.
- **Files likely touched:** `wxt.config.ts`, `package.json`, `entrypoints/popup/index.html`, `src/components/layout/Header.tsx`, `src/components/layout/Header.test.tsx`

### F01-T2: Remove the Firefox targets

- **Status:** In progress
- **Owner:** Claude
- **Size:** M
- **Depends on:** None
- **Description:** Remove the `browser_specific_settings.gecko` block (with its `@statsig.com` ID, per REQ-SET-004) and the `browser === 'firefox'` branch from `wxt.config.ts`. Remove the `*:firefox` and `zip:all` scripts. Remove the Firefox steps in `.github/workflows/submit.yml` (or drop the workflow, see Q6) and the Firefox notes in `docs/publishing.md`. Check `web-ext.config.ts` and the e2e comments too.
- **Acceptance criteria:**
  - [ ] No `gecko`, `firefox`, or `@statsig.com` in the built manifest or in `wxt.config.ts`
  - [ ] `package.json` has no Firefox scripts
- **Verification:** `pnpm build:chrome`; `grep -rni firefox --exclude-dir=node_modules --exclude-dir=.agents --exclude=CHANGELOG.md .`
- **Files likely touched:** `wxt.config.ts`, `package.json`, `.github/workflows/submit.yml`, `docs/publishing.md`, `web-ext.config.ts`

### F01-T3: Generate a new Chrome signing key

- **Status:** Done (see WL-021). Maurice still has to move the private key to a password manager.
- **Owner:** Claude generates it, Maurice stores the private key
- **Size:** S
- **Depends on:** None
- **Description:** Generate a new 2048-bit RSA key pair. Put the base64 public key in `CRX_PUBLIC_KEY` in `wxt.config.ts`. Hand the private key to Maurice outside the repository, and add `*.pem` to `.gitignore`. Record the new extension ID.
- **Acceptance criteria:**
  - [x] `key` in the built manifest differs from the base key
  - [x] No private key in the git tree or history, and `*.pem` is ignored
  - [x] The new extension ID is in a `WORKLOG.md` entry
- **Verification:** Load `.output/chrome-mv3` unpacked and check that the ID matches the recorded one.
- **Files likely touched:** `wxt.config.ts`, `.gitignore`
