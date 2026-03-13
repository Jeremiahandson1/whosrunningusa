import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test('login page renders form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Welcome Back')).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()
  })

  test('register page renders with account type selection', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText('Join WhosRunningUSA')).toBeVisible()
    await expect(page.getByText("I'm a Voter")).toBeVisible()
    await expect(page.getByText("I'm Running for Office")).toBeVisible()
  })

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByText('Reset Password')).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByRole('button', { name: /Send Reset Link/i })).toBeVisible()
  })

  test('unauthenticated user sees "Sign In" in header', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.desktop-nav').getByRole('link', { name: 'Sign In' })).toBeVisible()
  })
})
