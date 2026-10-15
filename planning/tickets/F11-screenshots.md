# F11: Screenshots

| Field      | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Status     | Todo                                                        |
| Phase      | 4: Job 3                                                    |
| Spec       | REQ-SHT-001 to REQ-SHT-013 · REQ-SET-010 · T-SHT-1, T-SHT-2 |
| Depends on | F02-T1, F09 (footer data)                                   |
| Blocks     | F12-T2                                                      |

## Goal

One action captures the page at desktop, tablet, and mobile sizes, with a metadata footer, and always puts the tab back the way it was.

## Tasks

### F11-T1: Spike the capture design

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** None
- **Description:** WL-015. Before any capture code, decide and log in `WORKLOG.md`:
  1. Where the capture runs. The background service worker is suggested.
  2. How it survives the popup closing.
  3. How the PNGs get saved without a `downloads` permission (for example, an extension page that receives the images and triggers `<a download>`).
  4. How a full-page capture works: `captureBeyondViewport` or `Page.getLayoutMetrics` plus a resize.
  5. Where the footer gets drawn: `OffscreenCanvas` in the worker, or the extension page.

  Build a throwaway prototype on staging to check that the popup and the debugger banner work together.

- **Acceptance criteria:**
  - [ ] A Decision entry in `WORKLOG.md` answers questions 1 to 5, each with its reason
- **Verification:** The WL entry exists, and a manual prototype run on staging worked.

### F11-T2: Optional `debugger` permission

- **Status:** Todo
- **Owner:** Claude
- **Size:** XS
- **Depends on:** F11-T1
- **Description:** Declare `debugger` under `optional_permissions` (REQ-SHT-002, REQ-SET-010), and request it the first time the Tester uses the Screenshots tab. Handle a refusal gracefully.
- **Acceptance criteria:**
  - [ ] The built manifest has `debugger` only under `optional_permissions`
  - [ ] Refusing shows an explanation and a way to try again
- **Verification:** `pnpm build:chrome` and read the manifest; manual first-use check
- **Files likely touched:** `wxt.config.ts`, the Screenshots tab component

### F11-T3: Capture engine with guaranteed cleanup

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F11-T1, F11-T2
- **Description:** In the background: the preset table as one constant (REQ-SHT-004) and a settle-time constant of 750 ms (REQ-SHT-007). Use `Emulation.setDeviceMetricsOverride`, `Emulation.setTouchEmulationEnabled`, and `Emulation.setUserAgentOverride`, then `Page.captureScreenshot` (REQ-SHT-003). Support visible-area and full-page captures, with full page as the default. On success, error, cancel, or an outside detach, clear the emulation and detach (REQ-SHT-010). Refuse non-Intake tabs (REQ-SHT-013). Never touch page data, cookies, or storage (REQ-SHT-011).
- **Acceptance criteria:**
  - [ ] Unit tests with a mocked `chrome.debugger`: correct CDP calls for each preset, and cleanup runs on a thrown error, a cancel, and a detach
  - [ ] Refuses a non-Intake URL before attaching
- **Verification:** `pnpm vitest run src/lib/screenshots`; manual T-SHT-2
- **Files likely touched:** `src/lib/screenshots/` (new: presets, engine), `entrypoints/background.ts`, tests

### F11-T4: Footer strip and PNG file names

- **Status:** Todo
- **Owner:** Claude
- **Size:** S
- **Depends on:** F11-T3, F09-T3
- **Description:** Add a footer strip **below** the image, never over the page content (REQ-SHT-008). It shows the preset name, the page URL, the date and time, and each experiment with its group from Job 1. Save as PNG with the preset name and date and time in the file name (REQ-SHT-009).
- **Acceptance criteria:**
  - [ ] Unit tests for the footer text builder and the file name format
  - [ ] Output height is the image height plus the footer height (unit tested with a fake canvas)
- **Verification:** `pnpm vitest run src/lib/screenshots`
- **Files likely touched:** `src/lib/screenshots/footer.ts` (new), its test

### F11-T5: Screenshots tab UI

- **Status:** Todo
- **Owner:** Claude
- **Size:** M
- **Depends on:** F11-T3, F11-T4, Q1
- **Description:** A separate "Screenshots" tab (REQ-SHT-001). Choose one preset or all (REQ-SHT-005), choose visible area or full page with full page as the default (REQ-SHT-006), and show progress and a Cancel button.
- **Acceptance criteria:**
  - [ ] T-SHT-1: all three presets with full page give three PNGs with correct footers
  - [ ] T-SHT-2: after a cancel, the emulation is off, the debugger is detached, and the page is back to its original size
- **Verification:** Component tests; manual T-SHT-1 and T-SHT-2 on staging
- **Files likely touched:** `src/components/screenshots/` (new), `src/components/layout/MainTabs.tsx`
