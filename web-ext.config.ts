import { defineWebExtConfig } from 'wxt'

export default defineWebExtConfig({
  chromiumArgs: ['--disable-blink-features=AutomationControlled'],
  chromiumProfile: '.dev-profile',
  keepProfileChanges: true,
  startUrls: ['https://cloud.qdrant.io'],
})
