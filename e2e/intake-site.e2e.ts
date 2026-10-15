import { expect, test } from './fixtures'
import { defaultRoutes } from './mock-data'
import { mockApi, seedApiKey } from './mocks'

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
  })
})
