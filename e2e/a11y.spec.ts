import { expect, test } from '@playwright/test'

test('le parcours clavier complet fonctionne', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Le focus entre dans la boîte de dialogue.
  await expect(dialog.locator(':focus')).toHaveCount(1)

  // Les flèches font avancer et reculer.
  await page.keyboard.press('ArrowRight')
  await expect(dialog).toContainText('Create a project')
  await page.keyboard.press('ArrowLeft')
  await expect(dialog).toContainText('Your projects live here')

  // Échap ferme le tour.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('le tour est annoncé dans une région dynamique', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.locator('[data-guide-announcer]')).toHaveAttribute('aria-live', 'polite')
})

test('les deux thèmes rendent le tour lisible', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toHaveScreenshot('tour-light.png')

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('toggle-mode').click()
  await page.getByTestId('start-tour').click()
  await expect(page.getByRole('dialog')).toHaveScreenshot('tour-dark.png')
})
