import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/')
})

test('a hotspot explains one element and then stays gone', async ({ page }) => {
  await page.goto('/projects')
  const marker = page.getByRole('button', { name: /Start a project/ })
  await expect(marker).toBeVisible()

  await marker.click()
  const bubble = page.getByRole('dialog', { name: 'Start a project' })
  await expect(bubble).toContainText('Everything else in here hangs off')

  await page.keyboard.press('Escape')
  await expect(bubble).toBeHidden()

  await page.reload()
  await expect(page.getByRole('button', { name: /Start a project/ })).toBeHidden()
})
