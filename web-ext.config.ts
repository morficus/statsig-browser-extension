import { mkdirSync } from 'node:fs'
import { defineWebExtConfig } from 'wxt'

const CHROMIUM_PROFILE = '.dev-profile'

// The chrome-launcher package opens its log file inside the profile folder before it creates the folder.
// On a fresh checkout the folder is missing, and `pnpm dev:chrome` fails with ENOENT.
mkdirSync(CHROMIUM_PROFILE, { recursive: true })

export default defineWebExtConfig({
  chromiumArgs: ['--disable-blink-features=AutomationControlled'],
  chromiumProfile: CHROMIUM_PROFILE,
  keepProfileChanges: true,
  startUrls: ['https://app.staging.talkiatry.com/assessment'],
})
