# Permission Justifications

## activeTab

**Justification:**
When the Tester opens the popup, the extension checks the active tab's URL. It reads the page only if the URL is an Intake Site page. On any other page the popup shows a message, and the extension doesn't run scripts in the page or send it messages.

## Host Permissions

**Justification:**

1.  `https://statsigapi.net/*`: This specific host permission is required to communicate with the Statsig API for:
    - Fetching current project configurations (gates, experiments, dynamic configs).
    - Applying overrides via the Statsig Console API (using the user's provided API key).
    - Validating API keys.
2.  `https://app.talkiatry.com/assessment*`: The production Intake Site assessment pages. The content scripts run only on these pages, and the extension reads the Statsig SDK state (the current user and the SDK keys) only from them.
3.  `https://app.staging.talkiatry.com/assessment*`: The staging Intake Site assessment pages. Same use as the production pages.

## Remote Code

**Are you using remote code?**
**No.**

**Justification/Clarification:**
All code ships in the extension package: the popup, the background script, the content scripts, and the function the popup injects with `scripting.executeScript`.

## Scripting

**Justification:**
The popup injects one bundled function into the Intake Site page with `scripting.executeScript`. The function reads the Statsig SDK state from the page: the user object, the evaluation context, and the SDK keys. It runs only on Intake Site pages.

## Storage

**Justification:**
The `storage` permission (`browser.storage.local` via WXT) is used to persist:

1.  **Console API key**: The Statsig Console API key the Tester enters, and its key type.
2.  **Projects**: The Statsig projects the Tester has added, the active project, and the Intake Site origins pinned to a project. Each project keeps its Console API key, plus its client SDK keys and gate-name hashes, which the extension uses to recognize the project on a page.
3.  **Settings**: The name of the page's localStorage key that holds the Statsig user, and the theme.
4.  **Overrides**: The extension's record of the overrides it applied.
5.  **UI preferences**: The popup's last active tab, and each table's filters, sorting, page, rows per page, and visible columns, including the audit log filters.
    This data is stored locally on the user's device and is never shared externally except when making authenticated requests to the Statsig API (using the stored API key).

## Single Purpose Description

**Description:**
A developer tool that allows Statsig users to debug feature gates, force experiment variations, and inspect dynamic configurations directly on the Intake Site by interacting with the Statsig SDK and API.

## Data Usage Policy Certification

**Certification:**
I certify that this extension only collects and uses data strictly necessary for its stated purpose (debugging Statsig SDK implementations).

- **Statsig API Key**: Stored locally and used only to authenticate requests to the Statsig API on behalf of the user.
- **Page Data**: The extension reads the `window.statsig` object and specific local storage keys related to Statsig. It does not collect browsing history, personal data, or unrelated page content.
- **Data Transmission**: Data is only transmitted to `statsigapi.net` (the official Statsig API) to perform the requested debugging actions. No data is sent to third-party servers or tracking services.
