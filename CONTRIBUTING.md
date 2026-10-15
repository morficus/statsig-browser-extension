# Contributing to Statsig Browser Extension

Thank you for your interest in contributing to the Statsig Browser Extension! This document provides guidelines and instructions for contributing to this project.

## Development Setup

1.  **Prerequisites**:
    - Node.js (v24 or higher)
    - pnpm (v10 recommended)

2.  **Clone the repository**:

    ```bash
    git clone https://github.com/d0whc3r/statsig-browser-extension.git
    cd statsig-browser-extension
    ```

3.  **Install dependencies**:

    ```bash
    pnpm install
    ```

4.  **Start development server**:
    ```bash
    pnpm dev
    # Or target Chrome explicitly:
    pnpm dev:chrome
    ```

## Code Standards

- **Linting**: We use `oxlint` for high-performance linting. Run `pnpm lint` to check for issues and `pnpm lint:fix` to fix them.
- **Formatting**: We use `oxfmt` for lightning-fast formatting. Run `pnpm format` to format your code or `pnpm format:check` to verify.
- **Testing**: We use `vitest` for unit and integration testing. Run `pnpm test` to run tests.
- **Data Fetching**: Use `wretch` for API requests and `tanstack-query` for managing the server state in the UI. All network calls from the popup must be routed through `background.ts` via the `API_REQUEST` message (available in `src/lib/fetcher.ts`).

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages. It is **crucial** to follow these guidelines.

### Format

```
<type>(<scope>): <subject>
```

### Types

- **feat**: A new feature.
- **fix**: A bug fix.
- **docs**: Documentation only changes.
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
- **refactor**: A code change that neither fixes a bug nor adds a feature.
- **perf**: A code change that improves performance.
- **test**: Adding missing tests or correcting existing tests.
- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm).
- **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs).
- **chore**: Other changes that don't modify src or test files.
- **revert**: Reverts a previous commit.

### Breaking Changes

If your commit introduces a breaking change, add `BREAKING CHANGE:` in the footer or append `!` after the type/scope.

**Example**:

```
feat(auth)!: remove support for basic authentication
```

## Release Process

There is no automated release. CI (`.github/workflows/build.yml`) runs lint, type check, format check, unit tests, and e2e tests on every pull request and on every push to `main`. It uploads the Chrome zip as a build artifact. To release a new version, change `version` in `package.json` in a pull request.

## Pull Request Process

1.  Fork the repository and create your branch from `main`.
2.  If you've added code that should be tested, add tests.
3.  Ensure the test suite passes (`pnpm test`).
4.  Make sure your code lints (`pnpm lint`).
5.  Follow the commit message guidelines.
6.  Issue that pull request!

## Dependency security exceptions

Run `pnpm audit` after dependency changes. The lockfile contains compatible security
updates; the scoped `fx-runner>shell-quote` override replaces its vulnerable exact
pin. Keep install-script restrictions in `pnpm-workspace.yaml` enabled.

As of 2026-10-13, one development dependency has no published fix. Keep its
advisory visible and review it again by **2026-11-13**:

- `node-forge` 1.4.0: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
  It comes through `web-ext > @devicefarmer/adbkit`. The affected RSA verification
  belongs to adbkit's TCP USB server. The reviewed web-ext workflows use its ADB
  client, not that server, and target Chrome. Reassess before
  adding TCP USB server functionality or another node-forge caller.
