import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/unstyled')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/unstyled')
})

test('the tour crosses three pages and completes', async ({ page }) => {
  await page.getByTestId('start-tour').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Your projects live here')
  await expect(page.getByTestId('guide-spotlight')).toBeVisible()

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/unstyled/projects')
  await expect(dialog).toContainText('Create a project')

  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/unstyled/projects/42')
  await expect(dialog).toContainText('Share it')

  // The last step waits for a click on its real target, not a Finish button.
  await page.locator('[data-guide="project.share"]').click()
  await expect(dialog).toBeHidden()
})

test('the tour resumes where it was interrupted', async ({ page }) => {
  await page.getByTestId('start-tour').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL('/unstyled/projects')

  await page.reload()
  await page.goto('/unstyled')
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toContainText('Create a project')
})

test('an item launches the tour, and finishing it ticks the item', async ({ page }) => {
  await page.getByRole('button', { name: /Get started, 0 of 3 complete/ }).click()

  const checklistDialog = page.getByRole('dialog', { name: 'Get started' })
  // Distinguishes the unstyled launcher panel from the MUI one, which never carries this class.
  await expect(checklistDialog).toHaveClass(/guide-launcher-panel/)
  await checklistDialog.getByText('Take the product tour').click()

  await expect(checklistDialog).toBeHidden()
  await expect(page.getByRole('dialog')).toHaveCount(1)

  const tourDialog = page.getByRole('dialog')
  // Distinguishes the unstyled popover from the MUI one, which never carries this class.
  await expect(tourDialog).toHaveClass(/guide-popover/)
  await expect(tourDialog).toContainText('Your projects live here')
  await tourDialog.getByRole('button', { name: 'Next' }).click()
  await tourDialog.getByRole('button', { name: 'Next' }).click()
  await expect(tourDialog).toContainText('Share it')
  await page.locator('[data-guide="project.share"]').click()
  await expect(tourDialog).toBeHidden()

  await page.getByRole('button', { name: /Get started, 1 of 3 complete/ }).click()
  const reopened = page.getByRole('dialog', { name: 'Get started' })
  await expect(reopened.getByText('Take the product tour')).toHaveCSS('text-decoration-line', 'line-through')
})

test('a hotspot explains one element and then stays gone', async ({ page }) => {
  await page.goto('/unstyled/projects')
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

test('a hotspot steps aside while a tour points at the same element', async ({ page }) => {
  await page.goto('/unstyled/projects/42')
  const marker = page.getByRole('button', { name: /Share a project/ })
  await expect(marker).toBeVisible()

  await page.goto('/unstyled')
  await page.getByTestId('start-tour').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog).toContainText('Share it')

  await expect(marker).toBeHidden()

  // Comfortably inside where the marker's own 14px dot used to sit, centred on the target's
  // top-right corner, without hugging the exact pixel edge of the button's own box.
  const target = page.locator('[data-guide="project.share"]')
  const box = (await target.boundingBox())!
  await target.click({ position: { x: box.width - 6, y: 6 } })

  await expect(dialog).toBeHidden()
})

// The MUI suite cannot run this scenario: it exercises the hand written positioning that only
// this package's StepPopover carries. A narrow viewport puts the "nav.projects" target against
// the right edge of the window; naive placement would centre the popover under it and push its
// right edge past the viewport. The popover must stay inside the window instead.
test('a step near the right edge keeps its popover inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 700 })
  await page.goto('/unstyled')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/unstyled')

  await page.getByTestId('start-tour').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Your projects live here')

  const box = (await dialog.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(380)
})
