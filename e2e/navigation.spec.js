import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('home page loads with hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.hero')).toBeVisible()
    await expect(page.getByText('earn your vote')).toBeVisible()
  })

  test('clicking "Find Your Candidates" navigates to /explore', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Find Your Candidates/i }).click()
    await expect(page).toHaveURL(/\/explore/)
  })

  test('clicking "Run For Office" navigates to /run', async ({ page }) => {
    await page.goto('/')
    // The hero section has a "Run For Office" link
    await page.locator('.hero-actions').getByRole('link', { name: /Run For Office/i }).click()
    await expect(page).toHaveURL(/\/run/)
  })

  test('header nav link "Find Candidates" works', async ({ page }) => {
    await page.goto('/')
    await page.locator('.desktop-nav').getByRole('link', { name: 'Find Candidates' }).click()
    await expect(page).toHaveURL(/\/explore/)
  })

  test('header nav link "Races" works', async ({ page }) => {
    await page.goto('/')
    await page.locator('.desktop-nav').getByRole('link', { name: 'Races' }).click()
    await expect(page).toHaveURL(/\/races/)
  })

  test('header nav link "Town Halls" works', async ({ page }) => {
    await page.goto('/')
    await page.locator('.desktop-nav').getByRole('link', { name: 'Town Halls' }).click()
    await expect(page).toHaveURL(/\/town-halls/)
  })

  test('header nav link "How It Works" works', async ({ page }) => {
    await page.goto('/')
    await page.locator('.desktop-nav').getByRole('link', { name: 'How It Works' }).click()
    await expect(page).toHaveURL(/\/how-it-works/)
  })

  test('footer links work', async ({ page }) => {
    await page.goto('/')
    // Test a few footer links
    await expect(page.locator('.footer').getByRole('link', { name: 'About Us' })).toBeVisible()
    await expect(page.locator('.footer').getByRole('link', { name: 'Contact' })).toBeVisible()
    await expect(page.locator('.footer').getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
    await expect(page.locator('.footer').getByRole('link', { name: 'Terms of Service' })).toBeVisible()

    // Click one to verify navigation
    await page.locator('.footer').getByRole('link', { name: 'About Us' }).click()
    await expect(page).toHaveURL(/\/about/)
  })

  test('logo links to home', async ({ page }) => {
    await page.goto('/about')
    await page.locator('.logo').click()
    await expect(page).toHaveURL('http://localhost:3000/')
  })
})
