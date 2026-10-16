import type { Page } from '@playwright/test'

import type { MockApi, MockRoute } from './mocks'

import { expect, test } from './fixtures'
import {
  emptyOverrides,
  mockAuditLogs,
  mockDynamicConfigs,
  mockExperimentOverrides,
  mockExperiments,
  mockFeatureGates,
  paginated,
  single,
} from './mock-data'
import { mockApi, seedApiKey } from './mocks'

const overrideRoutes = (): MockRoute[] => [
  { data: paginated(mockFeatureGates), urlPattern: String.raw`/gates(\?|$)` },
  { data: paginated(mockExperiments), urlPattern: String.raw`/experiments(\?|$)` },
  { data: paginated(mockDynamicConfigs), urlPattern: String.raw`/dynamic_configs(\?|$)` },
  { data: paginated(mockAuditLogs), urlPattern: String.raw`/audit_logs(\?|$)` },
  { data: { data: [{ rules: [] }], message: 'ok' }, urlPattern: String.raw`/gates/[^/]+/rules(\?|$)` },
  { data: single(emptyOverrides), urlPattern: String.raw`/gates/[^/]+/overrides(\?|$)` },
  { data: single(mockFeatureGates[0]), urlPattern: String.raw`/gates/[^/]+(\?|$)` },
  { data: single(mockExperimentOverrides), urlPattern: String.raw`/experiments/[^/]+/overrides(\?|$)` },
  { data: single(mockExperiments[0]), urlPattern: String.raw`/experiments/[^/]+(\?|$)` },
  { data: { data: ['userID', 'stableID'], message: 'ok' }, urlPattern: String.raw`/unit_id_types(\?|$)` },
]

const openAuthenticated = async (page: Page, extensionId: string): Promise<MockApi> => {
  const api = await mockApi(page, overrideRoutes())
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await expect(page.getByText('Login to Statsig')).toBeHidden()
  return api
}

test.describe('override management', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await seedApiKey(serviceWorker)
  })

  test('opens the gate overrides tab and the add-manual form', async ({ context, extensionId }) => {
    const page = await context.newPage()
    await page.setViewportSize({ height: 700, width: 800 })
    await openAuthenticated(page, extensionId)

    await page.getByRole('tab', { name: /Gates/iu }).click()
    await page.getByRole('row', { name: /new_checkout_flow/u }).click()
    await expect(page.getByRole('dialog').getByText('new_checkout_flow').first()).toBeVisible()

    await page.getByRole('tab', { name: /^Overrides$/iu }).click()
    await expect(page.getByText('Active Overrides')).toBeVisible()

    await page.getByRole('button', { name: /Add Manual/iu }).click()
    await expect(page.getByLabel(/ID Value/iu)).toBeVisible()
    await expect(page.getByRole('button', { name: /Add PASS Override/iu })).toBeDisabled()

    await page.getByLabel(/ID Value/iu).fill('user_override')
    await expect(page.getByRole('button', { name: /Add PASS Override/iu })).toBeEnabled()
  })

  test('opens the experiment groups tab and a read-only overrides list', async ({ context, extensionId }) => {
    const page = await context.newPage()
    await page.setViewportSize({ height: 900, width: 800 })
    const api = await openAuthenticated(page, extensionId)

    await page.getByRole('tab', { name: /Experiments/iu }).click()
    await page.getByRole('row', { name: /homepage_hero_reorder/u }).click()

    await page.getByRole('tab', { name: /^Groups$/iu }).click()
    await expect(page.getByText('Total Allocation')).toBeVisible()
    await expect(page.getByText('Control', { exact: true })).toBeVisible()
    await expect(page.getByText('Variant', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: /^Overrides$/iu }).click()
    await expect(page.getByRole('heading', { name: 'Active Overrides' })).toBeVisible()

    // The ID overrides of other users stay behind the toggle, as before
    await page.getByRole('button', { name: /Show 2 other overrides/iu }).click()
    await expect(page.getByRole('row', { name: /qa_tester_1/u })).toBeVisible()
    await expect(page.getByRole('row', { name: /qa_tester_2, qa_tester_3/u })).toBeVisible()
    await expect(page.getByRole('row', { name: /beta_gate/u })).toBeVisible()
    await expect(page.getByRole('row', { name: /beta_segment/u })).toBeVisible()

    // Writes live in Force me and Clear. This list has no add, form, or delete control.
    await expect(page.getByRole('button', { name: /Add Manual/iu })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Delete override/iu })).toHaveCount(0)
    await expect(page.getByLabel(/ID Value/iu)).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)

    const calls = await api.calls()
    expect(calls.filter(({ method }) => method.toUpperCase() !== 'GET')).toStrictEqual([])
    expect(
      calls.some(({ method, url }) => method.toUpperCase() === 'GET' && /\/experiments\/[^/]+\/overrides/u.test(url)),
    ).toBeTruthy()
  })
})
