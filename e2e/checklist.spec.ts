import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/')
})

test('an item launches the tour, and finishing it ticks the item', async ({ page }) => {
  await page.getByRole('button', { name: /Get started, 0 of 3 complete/ }).click()

  const checklistDialog = page.getByRole('dialog', { name: 'Get started' })
  await checklistDialog.getByText('Take the product tour').click()

  // The checklist popover stays open behind the tour: it is not closed by activating an item.
  // Scope the tour dialog by excluding the checklist's own aria-label rather than by its
  // changing step text, which would go stale as the tour advances.
  const tourDialog = page.locator('[role="dialog"]:not([aria-label="Get started"])')
  await expect(tourDialog).toContainText('Your projects live here')
  await tourDialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects')
  await expect(tourDialog).toContainText('Create a project')
  await tourDialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects/42')
  await expect(tourDialog).toContainText('Share it')
  await tourDialog.getByRole('button', { name: 'Finish' }).click()
  await expect(tourDialog).toBeHidden()

  // The checklist popover, still open the whole time, reflects the completion without needing
  // to be reopened.
  await expect(checklistDialog.getByText('1 of 3')).toBeVisible()
  await expect(checklistDialog.getByText('Take the product tour')).toHaveCSS('text-decoration-line', 'line-through')
  await expect(checklistDialog.getByRole('checkbox', { name: 'Mark Take the product tour as not complete' })).toBeChecked()
})

test('a ticked item survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: /Get started, 0 of 3 complete/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Get started' })
  await dialog.getByRole('checkbox', { name: 'Mark Try dark mode as complete' }).click()
  await expect(dialog.getByText('1 of 3')).toBeVisible()

  await page.reload()

  await page.getByRole('button', { name: /Get started, 1 of 3 complete/ }).click()
  const reopened = page.getByRole('dialog', { name: 'Get started' })
  await expect(reopened.getByRole('checkbox', { name: 'Mark Try dark mode as not complete' })).toBeChecked()
})

test('the launcher is reachable and operable from the keyboard', async ({ page }) => {
  const launcher = page.getByRole('button', { name: /Get started, 0 of 3 complete/ })
  await launcher.focus()
  await expect(launcher).toBeFocused()

  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Get started' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Take the product tour')
})
