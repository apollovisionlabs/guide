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
  // The last step waits for a click on its real target, not a Finish button.
  await page.locator('[data-guide="project.share"]').click()
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

test('activating a tour item from the keyboard hands focus into the tour dialog', async ({ page }) => {
  const launcher = page.getByRole('button', { name: /Get started, 0 of 3 complete/ })
  await launcher.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Get started' })).toBeVisible()

  // Tab until the "Take the product tour" row itself holds focus.
  for (let i = 0; i < 20; i++) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      return { role: el?.getAttribute('role'), text: el?.textContent ?? '' }
    })
    if (focused.role === 'button' && focused.text.includes('Take the product tour')) break
    await page.keyboard.press('Tab')
  }

  await page.keyboard.press('Enter')

  // Exactly one dialog remains, it is the tour's (not the checklist's, which carries the
  // "Get started" label), and focus landed inside it rather than on the launcher or the body.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCount(1)
  await expect(dialog).not.toHaveAttribute('aria-label', 'Get started')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dialogEl = document.querySelector('[role="dialog"]')
        return (
          dialogEl !== null &&
          dialogEl.contains(document.activeElement) &&
          document.activeElement !== document.body
        )
      }),
    )
    .toBe(true)
})
