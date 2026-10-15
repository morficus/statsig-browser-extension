import type { Locator, Page } from '@playwright/test'

import { pollExtensionLocalValue, readExtensionLocalValue } from './extension-runtime'
import { expect, test } from './fixtures'
import { defaultRoutes } from './mock-data'
import { mockApi, seedLegacyApiKey } from './mocks'

const PROJECTS_KEY = 'statsig-projects'
const ACTIVE_PROJECT_KEY = 'statsig-active-project-id'
const API_KEY_KEY = 'statsig-console-api-key'

interface StoredProject {
  id: string
  label: string
  apiKey: string
  clientKeys: string[]
}

const projectsOf = (value: unknown): StoredProject[] => (value as StoredProject[] | undefined) ?? []

const keysRoute = () => ({
  data: {
    data: [
      { key: 'client-second-a', type: 'CLIENT' },
      { key: 'client-second-b', type: 'CLIENT' },
      { key: 'secret-second', type: 'SERVER' },
    ],
  },
  urlPattern: String.raw`/keys(\?|$)`,
})

/**
 * Opens the settings sheet and returns it. These tests seed the pre-projects key, so the popup is
 * showing the page gate — which offers the same "add project" form — hence every project assertion
 * is scoped to the sheet.
 */
const openSettings = async (page: Page, extensionId: string): Promise<Locator> => {
  await mockApi(page, [...defaultRoutes(), keysRoute()])
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await expect(page.getByText('Login to Statsig')).toBeHidden()
  await page.locator('header button').last().click()
  await page.getByRole('menuitem', { name: /^Settings$/iu }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: /Extension Settings/iu })).toBeVisible()
  return sheet
}

test.describe('statsig projects', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await seedLegacyApiKey(serviceWorker)
  })

  test('migrates the previously stored key into the first project', async ({ context, extensionId, serviceWorker }) => {
    const page = await context.newPage()
    const sheet = await openSettings(page, extensionId)

    await expect(sheet.getByLabel('Project name')).toHaveValue('Project 1')
    await expect(sheet.getByRole('button', { name: 'Project 1 is active' })).toBeVisible()

    await pollExtensionLocalValue(serviceWorker, PROJECTS_KEY, projectsOf).toHaveLength(1)
    await pollExtensionLocalValue(serviceWorker, PROJECTS_KEY, (value) => projectsOf(value)[0]?.apiKey).toBe(
      'console-mock-key',
    )
  })

  test('adds a second project, activates it and keeps its client keys', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    const page = await context.newPage()
    const sheet = await openSettings(page, extensionId)

    await sheet.getByLabel('Statsig Console API Key').fill('console-second-key')
    await sheet.getByRole('button', { name: /^Add$/iu }).click()

    await expect(sheet.getByRole('button', { name: 'Project 2 is active' })).toBeVisible()
    // Both projects resolve their keys from the same mock, so read the badge of the active row
    await expect(sheet.locator('[data-active="true"]').getByText('2 client keys')).toBeVisible()

    await pollExtensionLocalValue(serviceWorker, PROJECTS_KEY, projectsOf).toHaveLength(2)
    await pollExtensionLocalValue(
      serviceWorker,
      PROJECTS_KEY,
      (value) => projectsOf(value)[1]?.clientKeys,
    ).toStrictEqual(['client-second-a', 'client-second-b'])

    const stored = projectsOf(await serviceWorker.evaluate(readExtensionLocalValue, PROJECTS_KEY))
    await pollExtensionLocalValue(serviceWorker, ACTIVE_PROJECT_KEY).toBe(stored[1].id)

    // The background script authorizes requests with the active project's key
    await pollExtensionLocalValue(serviceWorker, API_KEY_KEY).toBe('console-second-key')
  })

  test('switching back to another project survives reopening the popup', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    const page = await context.newPage()
    const sheet = await openSettings(page, extensionId)

    await sheet.getByLabel('Statsig Console API Key').fill('console-second-key')
    await sheet.getByRole('button', { name: /^Add$/iu }).click()
    await expect(sheet.getByRole('button', { name: 'Project 2 is active' })).toBeVisible()
    // Without this, the final check could pass on the key that was stored before the add.
    await pollExtensionLocalValue(serviceWorker, API_KEY_KEY).toBe('console-second-key')

    await sheet.getByRole('button', { name: 'Use Project 1' }).click()
    await expect(sheet.getByRole('button', { name: 'Project 1 is active' })).toBeVisible()

    const reopened = await context.newPage()
    const reopenedSheet = await openSettings(reopened, extensionId)
    await expect(reopenedSheet.getByRole('button', { name: 'Project 1 is active' })).toBeVisible()

    await pollExtensionLocalValue(serviceWorker, API_KEY_KEY).toBe('console-mock-key')
  })

  test('removes a project', async ({ context, extensionId, serviceWorker }) => {
    const page = await context.newPage()
    const sheet = await openSettings(page, extensionId)

    await sheet.getByLabel('Statsig Console API Key').fill('console-second-key')
    await sheet.getByRole('button', { name: /^Add$/iu }).click()
    await expect(sheet.getByRole('button', { name: 'Project 2 is active' })).toBeVisible()
    // Without this, the final checks could pass on the list that was stored before the add.
    await pollExtensionLocalValue(serviceWorker, PROJECTS_KEY, projectsOf).toHaveLength(2)

    await sheet.getByRole('button', { name: 'Remove Project 2' }).click()
    await expect(sheet.getByRole('button', { name: 'Project 1 is active' })).toBeVisible()

    await pollExtensionLocalValue(serviceWorker, PROJECTS_KEY, projectsOf).toHaveLength(1)
    await pollExtensionLocalValue(serviceWorker, PROJECTS_KEY, (value) => projectsOf(value)[0]?.label).toBe('Project 1')
  })
})
