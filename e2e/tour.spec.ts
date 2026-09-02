import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/')
})

test('the tour crosses three pages and completes', async ({ page }) => {
  await page.getByTestId('start-tour').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Your projects live here')
  await expect(page.getByTestId('guide-spotlight')).toBeVisible()

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects')
  await expect(dialog).toContainText('Create a project')

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects/42')
  await expect(dialog).toContainText('Share it')

  await dialog.getByRole('button', { name: 'Finish' }).click()
  await expect(dialog).toBeHidden()
})

test('the tour resumes where it was interrupted', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects')

  await page.reload()
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toContainText('Create a project')
})

test('the spotlight stays on the target after scrolling', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  const hole = page.locator('mask rect').last()
  const before = await hole.getAttribute('y')
  await page.mouse.wheel(0, 200)
  await expect.poll(() => hole.getAttribute('y')).not.toBe(before)
})

test('an interactive step lets the page be clicked', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog).toContainText('Share it')
  await page.locator('[data-guide="project.share"]').click()
})
