import { expect, test } from './fixtures'
import { defaultRoutes } from './mock-data'
import { ACTIVE_TAB_ORIGIN, mockApi, seedApiKey } from './mocks'

test.describe('Intake Site scoping', () => {
  test('refuses to read a tab outside the Intake Site', async ({ context, extensionId, serviceWorker }) => {
    await seedApiKey(serviceWorker)
    const page = await context.newPage()
    await mockApi(page, defaultRoutes(), { activeTabUrl: 'https://example.com/' })
    await page.goto(`chrome-extension://${extensionId}/popup.html`)

    await expect(page.getByRole('heading', { name: 'Not an Intake Site page' })).toBeVisible()
    await expect(page.getByText('app.talkiatry.com/assessment', { exact: true })).toBeVisible()
    await expect(page.getByText('app.staging.talkiatry.com/assessment', { exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Gates/iu })).toBeHidden()

    await page.getByRole('banner').getByRole('button').last().click()
    await expect(page.getByRole('menuitem', { name: /^settings$/iu })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /user details/iu })).toHaveCount(0)
  })

  test('refuses a non-assessment page on the pinned Intake origin', async ({ context, extensionId, serviceWorker }) => {
    // SeedApiKey pins the project to https://app.staging.talkiatry.com
    await seedApiKey(serviceWorker)
    const page = await context.newPage()
    await mockApi(page, defaultRoutes(), { activeTabUrl: `${ACTIVE_TAB_ORIGIN}/login` })
    await page.goto(`chrome-extension://${extensionId}/popup.html`)

    await expect(page.getByRole('heading', { name: 'Not an Intake Site page' })).toBeVisible()
    await expect(page.getByRole('banner').getByText(/this page/iu)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Page project status/iu })).toHaveCount(0)
  })
})
