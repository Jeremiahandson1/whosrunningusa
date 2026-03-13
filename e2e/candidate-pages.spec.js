import { test, expect } from '@playwright/test'

test.describe('Candidate and Static Pages', () => {
  test('/races page renders', async ({ page }) => {
    await page.goto('/races')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('/town-halls page renders', async ({ page }) => {
    await page.goto('/town-halls')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('/voting-guide shows sign-in prompt when not logged in', async ({ page }) => {
    await page.goto('/voting-guide')
    await expect(page.getByText('Sign in to build your voting guide')).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: 'Sign In' })).toBeVisible()
  })

  test('/how-it-works page renders content', async ({ page }) => {
    await page.goto('/how-it-works')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('/about page renders', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('/contact page renders form', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.getByText('Contact Us')).toBeVisible()
    await expect(page.locator('form')).toBeVisible()
  })

  test('/privacy page renders', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('/terms page renders', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('h1')).toBeVisible()
  })
})
