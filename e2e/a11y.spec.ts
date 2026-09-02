import { expect, test } from '@playwright/test'

test('the full keyboard walkthrough works', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Focus enters the dialog on the container itself: the focus trap aims at the Paper, not at
  // the close button.
  await expect(dialog).toBeFocused()

  // The arrow keys move forward and back.
  await page.keyboard.press('ArrowRight')
  await expect(dialog).toContainText('Create a project')
  await page.keyboard.press('ArrowLeft')
  await expect(dialog).toContainText('Your projects live here')

  // Escape stops the tour.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('the tour is announced in a live region', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  const announcer = page.locator('[data-guide-announcer]')
  await expect(announcer).toHaveAttribute('aria-live', 'polite')
  await expect(announcer).toHaveText('1 / 3')

  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
  await expect(announcer).toHaveText('2 / 3')
})

test('both themes render the tour legibly', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toHaveScreenshot('tour-light.png')

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('toggle-mode').click()
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toHaveScreenshot('tour-dark.png')
})
