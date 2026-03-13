import { test, expect } from '@playwright/test'

test.describe('Search', () => {
  test('search bar exists on home page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.search-bar')).toBeVisible()
    await expect(page.getByPlaceholder(/Search by candidate name/i)).toBeVisible()
  })

  test('typing in search and pressing Enter navigates to /explore with query param', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.getByPlaceholder(/Search by candidate name/i)
    await searchInput.fill('mayor')
    await searchInput.press('Enter')
    await expect(page).toHaveURL(/\/explore\?q=mayor/)
  })

  test('explore page has filter controls', async ({ page }) => {
    await page.goto('/explore')
    // The explore page should have search and filter UI
    await expect(page.getByPlaceholder(/Search/i).first()).toBeVisible()
  })
})
