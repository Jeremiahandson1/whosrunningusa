import { test, expect } from '@playwright/test'

test.describe('Responsive Design', () => {
  test('mobile viewport shows hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.locator('.mobile-menu-btn')).toBeVisible()
    // Desktop nav should be hidden on mobile
    await expect(page.locator('nav.desktop-nav')).not.toBeVisible()
  })

  test('desktop viewport shows full nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.locator('nav.desktop-nav')).toBeVisible()
    await expect(page.locator('.desktop-nav').getByRole('link', { name: 'Find Candidates' })).toBeVisible()
    await expect(page.locator('.desktop-nav').getByRole('link', { name: 'Races' })).toBeVisible()
  })
})
