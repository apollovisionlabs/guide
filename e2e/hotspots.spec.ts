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

test('a hotspot steps aside while a tour points at the same element', async ({ page }) => {
  // The demo's last tour step and the "share" hotspot target the same button, which is the
  // collision this covers: the marker is drawn over the target's top-right corner, so
  // document.elementFromPoint there returns the marker and the click never reaches the step.
  await page.goto('/projects/42')
  const marker = page.getByRole('button', { name: /Share a project/ })
  await expect(marker).toBeVisible()

  await page.goto('/')
  await page.getByTestId('start-tour').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Next' }).click()
  await dialog.getByRole('button', { name: 'Next' }).click()
  await expect(dialog).toContainText('Share it')

  await expect(marker).toBeHidden()

  // Exactly where the marker used to sit. The step advances on this click, and cannot if a
  // marker is there to take it.
  const target = page.locator('[data-guide="project.share"]')
  const box = (await target.boundingBox())!
  await target.click({ position: { x: box.width - 1, y: 1 } })

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Share a project' })).toHaveCount(0)
})

test('a tour started from a hotspot leaves focus on a real element', async ({ page }) => {
  await page.goto('/projects/42')
  await page.getByRole('button', { name: /Share a project/ }).click()
  await expect(page.getByRole('dialog', { name: 'Share a project' })).toBeVisible()

  await page.getByRole('button', { name: 'Show me' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Your projects live here')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // Both restore targets, the "Show me" button and the marker, unmounted with the bubble.
  const landed = await page.evaluate(() => document.activeElement?.tagName ?? null)
  expect(landed).not.toBe('BODY')
})

test('clicking an open marker again closes its bubble', async ({ page }) => {
  await page.goto('/projects')
  const marker = page.getByRole('button', { name: /Start a project/ })
  await marker.click()
  await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeVisible()

  await marker.click()
  await expect(page.getByRole('dialog', { name: 'Start a project' })).toBeHidden()
})
