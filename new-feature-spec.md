# Specification: Intake Experiment Testing (Chrome Extension)

| Item            | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Document status | Draft 0.4                                               |
| Date            | 2026-10-14                                              |
| Writing style   | ASD-STE100 (simplified technical English)               |
| Implementer     | Claude Code                                             |
| Base repository | `d0whc3r/statsig-browser-extension`                     |
| Base commit     | `97aa1389daed4e63c582fba35a0c6a8509a71db0` (2026-10-13) |
| Base license    | ISC                                                     |

---

## 1. Purpose

This document gives the requirements for a Chrome extension. The Extension helps Testers do spot tests of Statsig experiments on the production Intake Site.

The Extension does three jobs:

1. **Job 2 (first priority).** A Tester forces himself or herself into a chosen experiment group. The Tester does not use the Statsig Console.
2. **Job 1 (second priority).** A Tester sees the active experiments on the page. The Tester sees at once if he or she is in the control arm or the treatment arm.
3. **Job 3 (third priority).** A Tester takes screenshots of the page at desktop, tablet, and mobile sizes.

The Extension is a fork of an open-source extension. Most of the base code stays. This document says what to change, what to add, and what to remove.

---

## 2. Scope

### 2.1 In scope

- Experiment overrides by stable ID, for the Tester only.
- A list of the Tester's active overrides, with a clear action.
- A view of the Tester's current group for each experiment on the page.
- Screenshots at three screen sizes, with a metadata footer.
- Feature gate overrides. Keep the feature of the base code without change.
- Chrome (stable), Manifest V3, loaded as an unpacked extension.

### 2.2 Out of scope

Do not build these items in this version:

- A proxy server or SSO sign-in. Each Tester uses a personal Console Key.
- Automatic expiry of overrides.
- Changes to the feature gate override feature and to dynamic configs. Keep the base behavior.
- Firefox, Safari, and Edge support.
- A Chrome Web Store listing.
- Blur or removal of personal data in screenshots. Testers use fake test data.
- Sharing of screenshots to other tools.

---

## 3. Definitions

| Term                 | Meaning                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension            | The Chrome extension that this document describes.                                                                                                                                                               |
| Tester               | A person who uses the Extension.                                                                                                                                                                                 |
| Intake Site          | The web pages that the Testers test. They run the Statsig JavaScript client SDK. The pages are `https://app.talkiatry.com/assessment` (production) and `https://app.staging.talkiatry.com/assessment` (staging). |
| Console API          | The Statsig management API at `https://statsigapi.net/console/v1`.                                                                                                                                               |
| Console Key          | A Statsig Console API key. It starts with `console-`. Each Tester uses a Personal Console Key.                                                                                                                   |
| Personal Console Key | A Console Key that a Tester creates for himself or herself in Statsig. It has the same access as the role of the Tester. It is tied to its owner.                                                                |
| Stable ID            | The Statsig identifier that the SDK stores for one browser.                                                                                                                                                      |
| Group                | One variant of an experiment, for example "Control" or "Test".                                                                                                                                                   |
| Control arm          | The group whose name is "control" when you ignore letter case.                                                                                                                                                   |
| Treatment arm        | Any group that is not the control arm.                                                                                                                                                                           |
| Override             | A Statsig rule that forces one ID into one group of one experiment.                                                                                                                                              |
| Cached evaluation    | The SDK result that the SDK stores in page `localStorage` under keys that start with `statsig.cached.evaluations.`.                                                                                              |
| Popup                | The window that opens when the Tester clicks the Extension icon.                                                                                                                                                 |

---

## 4. Known facts and assumptions

### 4.1 Facts about the Intake Site

- The SDK is `@statsig/js-client`, version 3.33.3.
- The SDK is available on the page as `window.__STATSIG__`. The product owner confirmed this.
- The Stable ID is in a cookie and in `localStorage`. The `localStorage` key starts with `statsig.stable_id.` and ends with a number that can change. One example is `statsig.stable_id.17069407`. The Extension does not use the cookie.

### 4.2 Facts about the Statsig Console API

- The base URL is `https://statsigapi.net/console/v1`.
- Each request has the header `STATSIG-API-KEY`.
- The endpoints `GET` and `POST /experiments/{id}/overrides` read and write overrides.
- Statsig has endpoints that delete one experiment override or one layer override. The calls are idempotent. Read the Console API reference for the exact paths.
- The ID type of an ID override does not need to match the ID type of the experiment. A `stableID` override is valid.
- If an experiment is in a layer, Statsig requires the override at the layer level.
- Statsig limits write requests to about 1,800 in 15 minutes for each project.
- A Tester can create a Personal Console Key. The key has the access of the role of the Tester. Statsig administrators can turn off personal keys in the organization settings.
- An override that is added after a user is exposed does not change the group that Pulse uses for that user. This is an accepted risk (see section 9).

### 4.3 Facts about the base code

The facts in this section come from a reading of the repository at the base commit. The implementer must confirm them.

- The stack is WXT, React 19, and TypeScript. The `package.json` field `engines` requires Node 24 or newer and pnpm 10 or newer.
- `src/lib/fetcher.ts` has the constant `API_BASE_URL`. API requests go through the background script by message.
- `src/lib/storage.ts` defines these storage items: `apiKeyStorage`, `projectsStorage`, `activeProjectIdStorage`, `apiKeyTypeStorage` (`write-key` or `read-key`), and `currentOverridesStorage`.
- `src/lib/get-user-details-injector.ts` runs in the page. It reads the SDK instance, the Stable ID, the SDK key, and the cached evaluations. It has a function that hashes names (`src/lib/djb2.ts`).
- `entrypoints/statsig-detector.ts` is a content script. It runs in the page world and its `matches` value is `<all_urls>`.
- `wxt.config.ts` sets `host_permissions` to `<all_urls>` and `https://statsigapi.net/*`. It sets a Firefox ID that ends in `@statsig.com`. It sets a fixed Chrome public `key`.
- `src/handlers/experiment-overrides.ts` has the functions that update and delete experiment overrides.
- `src/components/common/GenericAddOverrideForm.tsx` supports the ID types `userID` and `stableID`.
- The folder `src/components/cleanup` has a panel for stale gates. It is not part of this work. It does not make write calls.
- The only write calls in the base code are the experiment override calls and the gate override calls.

---

## 5. System overview

The Extension has four parts:

1. **Popup.** The user interface.
2. **Background script.** It sends Console API requests and holds the Console Key.
3. **Page reader.** A function that runs in the Intake Site page. It reads the SDK state, the Stable ID, and the cached evaluations.
4. **Screenshot module.** It uses the Chrome `debugger` API (Job 3 only).

The Extension sends data to one host only: `https://statsigapi.net`.

---

## 6. Requirements

Each requirement has an ID. The word "must" marks a mandatory requirement. The word "can" marks an option.

### 6.1 Setup and hardening (SET)

- **REQ-SET-001.** The Extension must be a fork of the base repository at the base commit.
- **REQ-SET-002.** The Extension must keep the ISC license text and the original copyright notice.
- **REQ-SET-003.** The Extension must have its own name. The name is "Intake Experiment Testing".
- **REQ-SET-004.** The Extension must not use the name "Statsig" as its product name. The Extension must not use the `statsig.com` domain in any extension ID.
- **REQ-SET-005.** The Extension must target Chrome only. Remove the Firefox build targets and the Firefox manifest settings.
- **REQ-SET-006.** The Extension must have a new Chrome public `key` in the manifest. Generate a new key pair. Do not reuse the base repository key. Keep the private key out of the repository.
- **REQ-SET-007.** The `host_permissions` value must list only these patterns:
  1. `https://statsigapi.net/*`
  2. `https://app.talkiatry.com/assessment*`
  3. `https://app.staging.talkiatry.com/assessment*`
- **REQ-SET-008.** The Intake Site URL patterns must come from one configuration constant. The product owner can widen the patterns later.
- **REQ-SET-009.** The `matches` value of each content script must list only the Intake Site URL patterns.
- **REQ-SET-010.** The manifest must not request a permission that no requirement needs. The allowed permissions are `storage`, `scripting`, and `activeTab`. In addition, `debugger` is allowed as an optional permission (see REQ-SHT-002).
- **REQ-SET-011.** The repository must commit the lockfile. Remove the automatic dependency update configuration (`renovate.json`).
- **REQ-SET-012.** The repository must have a `CLAUDE.md` file. It must give the build, test, and lint commands and the rules in this document. Replace the base `CLAUDE.md`.
- **REQ-SET-013.** The file `docs/permissions-justification.md` must match the final manifest.
- **REQ-SET-014.** The Extension must not read SDK state from a tab whose URL is not an Intake Site URL. This applies when `activeTab` gives access to the tab.

### 6.2 Security (SEC)

- **REQ-SEC-001.** The Extension must send the Console Key only to `https://statsigapi.net`.
- **REQ-SEC-002.** The Extension must store the Console Key only in extension storage (`browser.storage.local`).
- **REQ-SEC-003.** The Extension must not write the Console Key to page storage, cookies, the page DOM, or logs.
- **REQ-SEC-004.** The Extension must show only the first characters of a saved Console Key.
- **REQ-SEC-005.** The Extension must send all Console API requests through one module. That module must use one base URL constant. A later change to a proxy must need a change in that module only.
- **REQ-SEC-006.** The Extension must not load or run remote code. The Extension must not use `eval` or `new Function`.
- **REQ-SEC-007.** The Extension must call only these write endpoints: experiment overrides, layer overrides, and gate overrides. Do not add other write calls.
- **REQ-SEC-008.** If the key type is `read-key`, the Extension must disable each write action. The Extension must show the reason.
- **REQ-SEC-009.** The Extension must not send data to analytics or telemetry services.
- **REQ-SEC-010.** The Extension and the README must tell each Tester to use a Personal Console Key. They must tell the Tester not to use a shared project key.

### 6.3 Job 2: Force me into a group (OVR)

- **REQ-OVR-001.** The Popup must show a list of experiments from the Console API. The list must include experiments that are not started. The list must not include archived experiments.
- **REQ-OVR-002.** The Tester must be able to search the list by name.
- **REQ-OVR-003.** Each experiment must show its groups. Each group must have the action "Force me into this group".
- **REQ-OVR-004.** The Extension must find the Stable ID of the Tester in this order:
  1. the SDK instance on the page (`getStableID()` or `getContext().stableID`);
  2. the `localStorage` key that starts with `statsig.stable_id.`. The end of the key is a number that can change. Match the key by its start only.
- **REQ-OVR-005.** If the Extension cannot find the Stable ID, it must show an error. The Tester must be able to enter the Stable ID by hand.
- **REQ-OVR-006.** The action "Force me into this group" must add an override with ID type `stableID`, the Stable ID of the Tester, and the chosen group.
- **REQ-OVR-007.** The override must have an environment. The Extension must set the environment to the tier that the SDK reports (`getContext().options.environment.tier`). The default must be `production`. The Tester can change the environment.
- **REQ-OVR-008.** If the experiment is in a layer, the Extension must write the override at the layer level.
- **REQ-OVR-009.** The Extension must not remove or change an override that does not contain the Stable ID of the Tester. This is a critical requirement (see OPEN-004).
- **REQ-OVR-010.** If the Stable ID is already in another group of the same experiment, the Extension must move it to the chosen group. The Stable ID must be in one group only.
- **REQ-OVR-011.** After a successful write, the Extension must reload the active Intake Site tab.
- **REQ-OVR-012.** The Extension must record each override that it sets. The record must have the experiment ID, the experiment name, the layer ID (if any), the group, the environment, the Stable ID, and the time. Store the record in extension storage.
- **REQ-OVR-013.** The Popup must show a list of active overrides. The list comes from the record in REQ-OVR-012. The Extension must check each item against the Console API when the list opens. The Extension must remove from the record each override that no longer exists.
- **REQ-OVR-014.** Each active override must have the action "Clear". The Popup must also have the action "Clear all". Each action must delete the override and then reload the active Intake Site tab.
- **REQ-OVR-015.** The Extension icon must show the count of active overrides as a badge. The badge must be empty when the count is zero.
- **REQ-OVR-016.** The Extension must show the result of each write action. The message must be specific for these errors: key not valid (HTTP 401), key not allowed (HTTP 403), rate limit (HTTP 429), and no network.
- **REQ-OVR-017.** The Popup must say that overrides do not expire. It must say that the Tester clears them by hand.

### 6.4 Job 1: See my group (ASG)

- **REQ-ASG-001.** When the Popup opens on an Intake Site tab, the Extension must read the evaluation values of the SDK. It must use the live SDK instance first. If the live SDK instance is not available, it must use the cached evaluations.
- **REQ-ASG-002.** The Extension must show the data source for the values. The source is "live" or "cached". For "cached", it must show the age of the cache if the cache has a time value.
- **REQ-ASG-003.** The values can have hashed names. The field `hash_used` shows the method: `djb2`, `sha256`, or `none`. The Extension must support all three methods. It must match each hashed name to an experiment name from the Console API. See OPEN-007 for the `sha256` check.
- **REQ-ASG-004.** Statsig can serve a layer and omit the experiment in the values. If this occurs, the Extension must use the layer entry to find the experiment that is allocated to the Tester. See OPEN-007.
- **REQ-ASG-005.** For each experiment, the Popup must show the experiment name, the group name, and an arm badge.
- **REQ-ASG-006.** The arm badge must follow these rules:
  1. If the Tester is not in the experiment, show "Not enrolled".
  2. If the group name is "control" (letter case ignored), show "Control".
  3. In all other cases, show "Treatment" and the group name.
- **REQ-ASG-007.** The Popup must mark each experiment that has an override from the Tester. The Extension must use the record in REQ-OVR-012 for this mark. If the values contain a reliable marker for overrides, the Extension can also use it.
- **REQ-ASG-008.** The Popup must have a switch with two views. "On this page" is the default view. "All running experiments" shows each running experiment from the Console API. In the second view, an experiment that is not in the SDK values must show "Not evaluated on this page".
- **REQ-ASG-009.** The Popup must have a Refresh action. After an override change and a page reload, the Popup must refresh the values by itself.
- **REQ-ASG-010.** If the tab is not an Intake Site tab, or the SDK is not on the page, the Popup must say this in one clear message.
- **REQ-ASG-011.** The experiment list for Job 1 must work with a `read-key` Console Key.

### 6.5 Job 3: Screenshots (SHT)

- **REQ-SHT-001.** The Popup must have a separate tab named "Screenshots".
- **REQ-SHT-002.** The Extension must declare `debugger` as an optional permission. The Extension must request it when the Tester first uses the Screenshots tab.
- **REQ-SHT-003.** The Extension must use the Chrome `debugger` API and the DevTools Protocol. Use `Emulation.setDeviceMetricsOverride`, `Emulation.setTouchEmulationEnabled`, `Emulation.setUserAgentOverride`, and `Page.captureScreenshot`.
- **REQ-SHT-004.** The Extension must have these presets:

  | Preset  | Width (px) | Height (px) | Device scale factor | Touch | Mobile user agent |
  | ------- | ---------- | ----------- | ------------------- | ----- | ----------------- |
  | Desktop | 1440       | 900         | 1                   | No    | No                |
  | Tablet  | 820        | 1180        | 2                   | Yes   | Yes               |
  | Mobile  | 390        | 844         | 3                   | Yes   | Yes               |

- **REQ-SHT-005.** The Tester must be able to capture one preset or all three presets with one action.
- **REQ-SHT-006.** The Tester must be able to choose "Visible area" or "Full page". The default is "Full page".
- **REQ-SHT-007.** After a change of screen size, the Extension must wait for the page to settle before capture. The default wait time is 750 ms. The wait time must be one constant.
- **REQ-SHT-008.** The Extension must add a footer strip below each image. It must not cover the page content. The footer must show the preset name, the page URL, the date and time, and the experiment names with their groups from Job 1.
- **REQ-SHT-009.** The Extension must save each image as a PNG file. The file name must have the preset name and the date and time.
- **REQ-SHT-010.** The Extension must remove the device emulation and detach the debugger after each capture. This must also occur after an error or a cancel.
- **REQ-SHT-011.** The Extension must not change the data on the page. It must not change the cookies or the storage of the page.
- **REQ-SHT-012.** The README must say that Chrome shows a "debugging this browser" banner during capture.
- **REQ-SHT-013.** The Extension must capture only tabs that have an Intake Site URL.

### 6.6 Quality (NFR)

- **REQ-NFR-001.** The Extension must work in current stable Chrome.
- **REQ-NFR-002.** The existing unit tests must pass. If a test checks a removed feature, remove that test.
- **REQ-NFR-003.** New logic must have unit tests. This includes the arm badge rules, the hash matching, the Stable ID search, and the override record.
- **REQ-NFR-004.** The Playwright end-to-end tests must cover the flows of Job 2 and Job 1 with a mocked Console API.
- **REQ-NFR-005.** The Popup must show the Job 1 list within 3 seconds after it opens, if cached evaluations exist. This is a target.
- **REQ-NFR-006.** The code must pass the lint and type checks of the repository.
- **REQ-NFR-007.** The README must have these sections: install as unpacked extension, create a Personal Console Key, key types, the list of permissions, and the known limits.

### 6.7 Feature gate overrides (GAT)

- **REQ-GAT-001.** The Extension must keep the gate override feature of the base code. The behavior must not change.
- **REQ-GAT-002.** The gate override feature must follow REQ-SEC-007 and REQ-SEC-008.
- **REQ-GAT-003.** The active overrides list and the badge (REQ-OVR-013 and REQ-OVR-015) do not include gate overrides. This is a known limit.
- **REQ-GAT-004.** The existing unit tests of the gate override feature must pass.

---

## 7. Implementation guidance

This section is a guide. The implementer can choose a different design if the requirements stay true.

| Task                                         | Where to start                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Rename, new key, permissions, remove Firefox | `wxt.config.ts`, `package.json`, `entrypoints/statsig-detector.ts`                             |
| Single API module and base URL               | `src/lib/fetcher.ts`                                                                           |
| Key and record storage                       | `src/lib/storage.ts` (`currentOverridesStorage` is a start for REQ-OVR-012)                    |
| Stable ID search, cache reading, hash match  | `src/lib/get-user-details-injector.ts`, `src/lib/djb2.ts`                                      |
| Override write and delete                    | `src/handlers/experiment-overrides.ts`                                                         |
| Override user interface                      | `src/components/modals/manage-experiment/`, `src/components/common/GenericAddOverrideForm.tsx` |
| Gate override feature (keep, no change)      | `src/components/modals/manage-gate-overrides/`, `src/handlers/gate-overrides.ts`               |
| Screenshot module                            | New files. Use the background script for the `debugger` calls.                                 |

Rules for the implementer:

1. Read the Console API reference before you write the override code. Do not guess the request shapes.
2. Use a test Statsig project or a test experiment to confirm the behavior (see section 8).
3. Keep the page reader function self-contained. Chrome serializes the function when it injects the function into the page.
4. Do not add a dependency that you do not need.

---

## 8. Verification

The implementer must do each test. Record the results in the README or in the pull request.

### 8.1 Checks before you build (do first)

1. **Unstarted experiment (OPEN-001).** Create an experiment in Statsig. Do not start it. Add a `stableID` override for your Stable ID. Open the Intake Site. Record if the SDK gives the override group.
2. **Override write behavior (OPEN-004).** Add an override for a second ID. Use the Extension write call for your ID. Read the overrides. Make sure the second ID is still there.
3. **SDK values (OPEN-007).** On the Intake Site, read the real SDK values. Record the field names for the group name, the layer allocation, the hash method, and the override marker.
4. **Personal key (OPEN-008).** Sign in to Statsig as a Tester who is not an administrator. Create a Personal Console Key. Add and clear an experiment override with the key. Record each error.

### 8.2 Acceptance tests

| ID      | Test                                                         | Pass condition                                                                                                        |
| ------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| T-SET-1 | Read the built `manifest.json`.                              | `host_permissions` has only `statsigapi.net` and the Intake Site origins. No `statsig.com` extension ID. A new `key`. |
| T-SEC-1 | Do a full session with the network log open.                 | Requests go to `statsigapi.net` only.                                                                                 |
| T-SEC-2 | Set the key type to `read-key`.                              | All write actions are disabled with a reason.                                                                         |
| T-SEC-3 | Search the code for write calls.                             | Only experiment, layer, and gate override calls.                                                                      |
| T-GAT-1 | Add and delete a gate override for your own ID.              | Both actions work as in the base code.                                                                                |
| T-OVR-1 | Open the Intake Site. Force a group of a running experiment. | The tab reloads. The page shows the chosen group.                                                                     |
| T-OVR-2 | Repeat T-OVR-1 with an experiment in a layer.                | The override is at the layer level. The page shows the chosen group.                                                  |
| T-OVR-3 | Force a second group of the same experiment.                 | The Stable ID is in the second group only.                                                                            |
| T-OVR-4 | Clear one override.                                          | The override is gone from Statsig. The tab reloads. The badge count goes down.                                        |
| T-OVR-5 | Use an invalid key.                                          | The message says that the key is not valid.                                                                           |
| T-OVR-6 | Block the Stable ID read.                                    | The Popup shows an error and the manual entry.                                                                        |
| T-ASG-1 | Open the Popup on the Intake Site with the SDK live.         | The Popup lists each experiment with the correct group and arm badge.                                                 |
| T-ASG-2 | Remove the live SDK access. Use only the cache.              | The Popup shows the same data. The source says "cached".                                                              |
| T-ASG-3 | Set a group named "CONTROL".                                 | The badge says "Control".                                                                                             |
| T-ASG-4 | Force the Treatment group.                                   | The badge says "Treatment" and the group name. The experiment has the override mark.                                  |
| T-ASG-5 | Open the Popup on a page without the SDK.                    | The Popup shows the message in REQ-ASG-010.                                                                           |
| T-SHT-1 | Capture all three presets with "Full page".                  | Three PNG files. Each file has a footer with the required data.                                                       |
| T-SHT-2 | Cancel a capture.                                            | The emulation is off. The debugger is detached. The page is in its original size.                                     |

---

## 9. Risks and accepted limits

- **Wide key.** A Personal Console Key has the access of the role of the Tester. That access can be wider than the override calls. This version has no proxy. Mitigation: the key is tied to its owner, so the Statsig audit log shows who made each change. Viewers can use a read-only key. Add a proxy before wide use (see section 11).
- **Overrides do not expire.** A Tester can forget an override. Mitigation: the badge and the active overrides list (REQ-OVR-013 and REQ-OVR-015).
- **Overrides not set by the Extension.** The active list shows only overrides that the Extension set. Overrides set in the Statsig Console are not in the list.
- **Result pollution.** Statsig does not change the Pulse group of a user who was exposed before the override. A few Testers cause a small effect. Testers should use test accounts where possible.
- **Hosted payload changes.** Statsig can change the payload shape. The values reader must fail in a safe way and show "Not available".
- **Upstream change.** The base project can change or stop. This fork does not take automatic updates.

---

## 10. Open items

| ID       | Question                                                                                                                                               | Status                                                                                                                                                  | Owner                     | Needed before      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------ |
| OPEN-001 | Does an override work on an experiment that is not started?                                                                                            | Open                                                                                                                                                    | Implementer (test in 8.1) | Job 2 acceptance   |
| OPEN-002 | What is the Stable ID storage?                                                                                                                         | Closed. Use the `localStorage` key that starts with `statsig.stable_id.`. Do not use the cookie.                                                        | Product owner             | -                  |
| OPEN-003 | What are the Intake Site URLs?                                                                                                                         | Closed. See REQ-SET-007.                                                                                                                                | Product owner             | -                  |
| OPEN-004 | Does the override write call add to the list or replace the list?                                                                                      | Product owner expects that it adds to the list. Confirm with test 2 in 8.1. Do not skip this test. A wrong result deletes the overrides of other users. | Implementer (test in 8.1) | REQ-OVR-009        |
| OPEN-005 | Can the Testers create their own Console Keys?                                                                                                         | Product owner says yes. Confirm with test 4 in 8.1.                                                                                                     | Implementer               | Release to Testers |
| OPEN-006 | What is the Extension name?                                                                                                                            | Closed. "Intake Experiment Testing".                                                                                                                    | Product owner             | -                  |
| OPEN-007 | What are the real SDK value fields (group name, layer allocation, `sha256` method, override marker)?                                                   | Open                                                                                                                                                    | Implementer (test in 8.1) | Job 1 acceptance   |
| OPEN-008 | Does a Personal Console Key of a non-administrator role have permission to add and clear overrides? Does the organization setting allow personal keys? | Product owner says yes. Confirm with test 4 in 8.1.                                                                                                     | Implementer (test in 8.1) | Release to Testers |
| OPEN-009 | Do all experiments name the control group "Control"? REQ-ASG-006 uses this name.                                                                       | Closed. The product owner confirms that the control group is always named "Control".                                                                    | Product owner             | -                  |
| OPEN-010 | What are the real screen widths for tablet and mobile? REQ-SHT-004 uses 820 and 390.                                                                   | Closed. The product owner accepts the values in REQ-SHT-004.                                                                                            | Product owner             | -                  |

---

## 11. Delivery order

Do the work in this order. Each step must pass its tests before the next step starts.

1. Do the checks in section 8.1.
2. Do the setup and hardening (6.1 and 6.2).
3. Do Job 2 (6.3).
4. Do Job 1 (6.4).
5. Do Job 3 (6.5).

Work for a later version: a proxy with SSO, automatic expiry of overrides, and a private Chrome Web Store listing. Keep the single API module (REQ-SEC-005) so that the proxy change is small.
