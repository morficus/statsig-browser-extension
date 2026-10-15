import type { Locator, Page } from '@playwright/test'

import type { MockRoute } from './mocks'

import { readExtensionLocalValue } from './extension-runtime'
import { expect, test } from './fixtures'
import { emptyOverrides, mockFeatureGates, paginated, single } from './mock-data'
import { mockApi, seedApiKey } from './mocks'

const API_KEY_TYPE_KEY = 'api_key_type'
const READ_ONLY_REASON = 'Read-only key. Add a key with write access to change overrides.'

const routes = (): MockRoute[] => [
  { data: paginated(mockFeatureGates), urlPattern: String.raw`/gates(\?|$)` },
  { data: paginated([]), urlPattern: String.raw`/experiments(\?|$)` },
  { data: paginated([]), urlPattern: String.raw`/dynamic_configs(\?|$)` },
  { data: paginated([]), urlPattern: String.raw`/audit_logs(\?|$)` },
  { data: { data: [{ rules: [] }], message: 'ok' }, urlPattern: String.raw`/gates/[^/]+/rules(\?|$)` },
  { data: single(emptyOverrides), urlPattern: String.raw`/gates/[^/]+/overrides(\?|$)` },
  { data: single(mockFeatureGates[0]), urlPattern: String.raw`/gates/[^/]+(\?|$)` },
  { data: { data: ['userID', 'stableID'], message: 'ok' }, urlPattern: String.raw`/unit_id_types(\?|$)` },
]

const openPopup = async (page: Page, extensionId: string): Promise<void> => {
  await mockApi(page, routes())
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await expect(page.getByText('Login to Statsig')).toBeHidden()
}

/** Picks a key type on the project row in the settings sheet, then closes the sheet. */
const pickKeyType = async (page: Page, label: 'Read & write' | 'Read only'): Promise<void> => {
  await page.locator('header button').last().click()
  await page.getByRole('menuitem', { name: /^Settings$/iu }).click()
  const sheet: Locator = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: /Extension Settings/iu })).toBeVisible()
  const rowKeyType = sheet.locator('[data-active="true"]').getByRole('combobox', { name: 'Key type' })
  await rowKeyType.click()
  await page.getByRole('option', { name: label }).click()
  await expect(rowKeyType).toHaveText(label)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
}

const openGateOverrides = async (page: Page): Promise<void> => {
  await page.getByRole('tab', { name: /Gates/iu }).click()
  await page.getByRole('row', { name: /new_checkout_flow/u }).click()
  await page.getByRole('tab', { name: /^Overrides$/iu }).click()
  await expect(page.getByText('Active Overrides')).toBeVisible()
}

test.describe('console key type', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await seedApiKey(serviceWorker)
  })

  test('a read-only project disables the override controls until it is switched back', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    const page = await context.newPage()
    await page.setViewportSize({ height: 700, width: 800 })
    await openPopup(page, extensionId)

    await pickKeyType(page, 'Read only')
    await expect.poll(() => serviceWorker.evaluate(readExtensionLocalValue, API_KEY_TYPE_KEY)).toBe('read-key')

    await openGateOverrides(page)
    await expect(page.getByText(READ_ONLY_REASON)).toBeVisible()
    await expect(page.getByRole('button', { name: /Add Manual/iu })).toBeDisabled()

    await page.keyboard.press('Escape')
    await pickKeyType(page, 'Read & write')
    await expect.poll(() => serviceWorker.evaluate(readExtensionLocalValue, API_KEY_TYPE_KEY)).toBe('write-key')

    await openGateOverrides(page)
    await expect(page.getByText('Active Overrides')).toBeVisible()
    await expect(page.getByRole('button', { name: /Add Manual/iu })).toBeEnabled()
    await expect(page.getByText(READ_ONLY_REASON)).toBeHidden()
  })
})
