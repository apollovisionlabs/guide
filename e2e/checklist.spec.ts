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

  // Launching the tour closes the checklist popover: only one dialog is ever on screen.
  await expect(checklistDialog).toBeHidden()
  await expect(page.getByRole('dialog')).toHaveCount(1)

  const tourDialog = page.getByRole('dialog')
  await expect(tourDialog).toContainText('Your projects live here')
  await tourDialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects')
  await expect(tourDialog).toContainText('Create a project')
  await tourDialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/projects/42')
  await expect(tourDialog).toContainText('Share it')
  await tourDialog.getByRole('button', { name: 'Finish' }).click()
  await expect(tourDialog).toBeHidden()

  // Reopen the launcher to see the completion reflected: the checklist popover was closed by
  // the tour launch, so it is no longer open the way earlier revisions of this test assumed.
  await page.getByRole('button', { name: /Get started, 1 of 3 complete/ }).click()
  const reopened = page.getByRole('dialog', { name: 'Get started' })
  await expect(reopened.getByText('Take the product tour')).toHaveCSS('text-decoration-line', 'line-through')
  await expect(reopened.getByRole('checkbox', { name: 'Mark Take the product tour as not complete' })).toBeChecked()
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
