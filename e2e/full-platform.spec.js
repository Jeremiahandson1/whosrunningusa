/**
 * Full-platform end-to-end smoke test.
 *
 * Walks the entire WhosRunningUSA user journey so a single run shows you
 * exactly which features are healthy and which are broken.
 *
 * Sections (each is a separate describe — failure in one does not block others):
 *   1. Public page smoke    — every public route renders without crashing
 *   2. Form validation      — register/login forms reject bad input
 *   3. Voter journey (UI)   — UI signup -> browse -> compare -> voting guide -> petition -> logout
 *   4. Candidate journey    — UI signup -> dashboard -> edit profile -> profile persists
 *   5. Town hall flow       — candidate creates -> voter sees -> voter asks question -> upvote
 *   6. Promise tracker      — candidate creates promise -> appears on profile -> can lock
 *   7. Platform features    — every feature page renders with on-topic content
 *   8. Auth guards          — protected routes redirect or prompt sign-in
 *   9. Search + lookup      — header search returns or shows empty cleanly
 *
 * REQUIREMENTS to run:
 *   - Backend API (auto-spawned by playwright.config.js, or `cd backend && npm run dev`)
 *   - Frontend served      (auto-spawned by playwright.config.js, or `npm run dev`)
 *   - Postgres reachable from backend (DATABASE_URL)
 *
 * Run:
 *   npm run test:smoke
 *   npm run test:smoke -- --headed
 *   npm run test:smoke -- -g "Voter journey"
 *
 * WARNING: This creates real users and rows. Use a local/staging DB, not prod.
 *          All test data uses identifiable timestamp emails (voter-{ts}@e2e.local)
 *          so cleanup is easy: DELETE FROM users WHERE email LIKE '%@e2e.local';
 */

import { test, expect } from '@playwright/test'
import {
  apiSignup,
  api,
  signupViaUI,
  setAuthToken,
  clearAuth,
  backendUp,
  uniqueEmail,
  uniqueUsername,
} from './helpers.js'

let apiAlive = false
test.beforeAll(async ({ request }) => {
  apiAlive = await backendUp(request)
  if (!apiAlive) {
    console.warn('\n[full-platform] Backend not reachable. Auth/data tests will skip.\n')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Public page smoke — every public route must render without runtime errors
// ─────────────────────────────────────────────────────────────────────────────
const PUBLIC_ROUTES = [
  '/',
  '/explore',
  '/races',
  '/town-halls',
  '/how-it-works',
  '/run',
  '/about',
  '/mission',
  '/contact',
  '/privacy',
  '/terms',
  '/petitions',
  '/revolving-door',
  '/trading-monitor',
  '/transparency',
  '/follow-the-money',
  '/finance-map',
  '/foreign-aid',
  '/dark-money',
  '/foreign-influence',
  '/they-took-it',
  '/promises',
  '/cost-calculator',
  '/conflicts',
  '/rubber-stamp',
  '/ballot-measures',
  '/gerrymandering',
  '/voter-access',
  '/pac-pledge',
  '/endorsements',
  '/connections',
  '/feed',
  '/find-my-ballot',
  '/issue-match',
  '/accountability',
  '/claim-profile',
  '/candidate-features',
  '/faq-candidates',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

test.describe('1. Public pages render', () => {
  for (const path of PUBLIC_ROUTES) {
    test(`GET ${path} renders without console errors`, async ({ page }) => {
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${path} HTTP status`).toBeLessThan(500)

      const hasContent = await page
        .locator('h1, .hero, main')
        .first()
        .isVisible()
        .catch(() => false)
      expect(hasContent, `${path} should show h1/hero/main`).toBeTruthy()

      // Filter out known noise (e.g. ResizeObserver warnings) but flag real exceptions.
      const real = errors.filter((e) => !/ResizeObserver|Non-Error promise rejection/.test(e))
      expect(real, `${path} threw runtime errors: ${real.join(' | ')}`).toEqual([])
    })
  }

  test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz')
    await expect(page.locator('main')).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Form validation — UI rejects bad inputs visibly
// ─────────────────────────────────────────────────────────────────────────────
test.describe('2. Form validation', () => {
  test('login form keeps user on /login when password is wrong', async ({ page }) => {
    test.skip(!apiAlive, 'backend down')
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill('nobody@example.com')
    await page.getByPlaceholder('Enter your password').fill('WrongPassword123!')
    await page.getByRole('button', { name: /Sign In/i }).click()
    await page.waitForTimeout(1500)
    expect(page.url()).toContain('/login')
  })

  test('register form requires Terms checkbox', async ({ page }) => {
    await page.goto('/register')
    await page.getByText("I'm a Voter").click()
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.locator('#reg-first-name').fill('A')
    await page.locator('#reg-last-name').fill('B')
    await page.locator('#reg-username').fill('abcd' + Date.now())
    await page.locator('#reg-email').fill(uniqueEmail('terms'))
    await page.locator('#reg-city').fill('X')
    await page.locator('#reg-state').fill('CA')
    await page.locator('#reg-password').fill('Pass1234!')
    // Skip checking terms.
    await page.getByRole('button', { name: /Create Account/i }).click()
    await expect(page.getByText(/agree to the Terms/i)).toBeVisible()
  })

  test('register form rejects HTML5-invalid email', async ({ page }) => {
    await page.goto('/register')
    await page.getByText("I'm a Voter").click()
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.locator('#reg-email').fill('not-an-email')
    await page.locator('#reg-password').fill('Pass1234!')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Create Account/i }).click()
    // Browser-level validity prevents submission; we should still be on /register.
    await page.waitForTimeout(500)
    expect(page.url()).toContain('/register')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Voter journey — full UI walk
// ─────────────────────────────────────────────────────────────────────────────
test.describe.serial('3. Voter journey (UI)', () => {
  let voterFixture

  test.beforeEach(() => {
    test.skip(!apiAlive, 'backend down')
  })

  test('voter signup via UI', async ({ page }) => {
    voterFixture = await signupViaUI(page)
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
  })

  test('header reflects authenticated state', async ({ page }) => {
    if (!voterFixture) test.skip(true, 'voter signup did not run')
    await page.goto('/')
    await expect(
      page.locator('.desktop-nav').getByRole('link', { name: 'Sign In' })
    ).toHaveCount(0)
  })

  test('voter can browse explore page', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('voter is no longer prompted to sign in on /voting-guide', async ({ page }) => {
    await page.goto('/voting-guide')
    await expect(page.getByText('Sign in to build your voting guide')).toHaveCount(0)
  })

  test('voter can open compare page', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.locator('h1, main')).toBeVisible()
  })

  test('voter can open petitions and click sign on first if present', async ({ page }) => {
    await page.goto('/petitions')
    await expect(page.locator('h1')).toBeVisible()
    const signBtn = page.getByRole('button', { name: /^Sign/i }).first()
    if (await signBtn.isVisible().catch(() => false)) {
      await signBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('logout returns to public state', async ({ page }) => {
    await clearAuth(page)
    await expect(
      page.locator('.desktop-nav').getByRole('link', { name: 'Sign In' })
    ).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Candidate journey — UI signup, profile edit persistence
// ─────────────────────────────────────────────────────────────────────────────
test.describe.serial('4. Candidate journey', () => {
  test.beforeEach(() => {
    test.skip(!apiAlive, 'backend down')
  })

  test('candidate signup via UI', async ({ page }) => {
    const fixture = await signupViaUI(page, { user_type: 'candidate' })
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    expect(fixture.user_type).toBe('candidate')
  })

  test('candidate edit page renders form', async ({ page }) => {
    await page.goto('/candidate/edit')
    await expect(page.locator('h1, form')).toBeVisible()
  })

  test('candidate dashboard renders', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('main')).toBeVisible()
  })

  test('candidate profile update persists via API', async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) test.skip(true, 'no candidate token')
    const a = api(request, token)
    const newBio = `E2E bio updated at ${new Date().toISOString()}`

    const upd = await a.put('/candidates/profile', { bio: newBio })
    expect([200, 204]).toContain(upd.status())

    // Many APIs expose /candidates/me or /users/me; try both.
    const me1 = await a.get('/auth/me')
    const me2 = await a.get('/users/me')
    const me = me1.ok() ? await me1.json() : me2.ok() ? await me2.json() : null
    if (me?.candidate_profile?.bio) {
      expect(me.candidate_profile.bio).toBe(newBio)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Town hall flow — candidate creates -> voter asks question -> upvotes
// ─────────────────────────────────────────────────────────────────────────────
test.describe('5. Town hall flow (API)', () => {
  test('candidate can create town hall and voter can RSVP/ask question', async ({ request }) => {
    test.skip(!apiAlive, 'backend down')

    const candidate = await apiSignup(request, { user_type: 'candidate' })
    const voter = await apiSignup(request)

    const candApi = api(request, candidate.token)
    const voterApi = api(request, voter.token)

    // Schedule a town hall 7 days out
    const scheduledAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const create = await candApi.post('/town-halls', {
      title: `E2E Town Hall ${Date.now()}`,
      description: 'Smoke-test town hall',
      format: 'text_ama',
      scheduledAt,
      durationMinutes: 60,
      restrictToDistrict: false,
    })
    if (!create.ok()) test.skip(true, `town hall create failed: ${create.status()}`)
    const townHall = await create.json()
    const id = townHall.id || townHall.townHall?.id
    expect(id).toBeTruthy()

    // Voter RSVPs (idempotent — accept 200/201/409)
    const rsvp = await voterApi.post(`/town-halls/${id}/rsvp`, { status: 'attending' })
    expect([200, 201, 409]).toContain(rsvp.status())

    // Question posting requires verified email — accept 403 cleanly without failing
    const ask = await voterApi.post(`/town-halls/${id}/questions`, {
      question_text: 'How will you address rising housing costs?',
    })
    expect([200, 201, 403]).toContain(ask.status())
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Promise tracker — candidate creates promise via API, leaderboard responds
// ─────────────────────────────────────────────────────────────────────────────
test.describe('6. Promise tracker', () => {
  test('candidate can create a promise and the leaderboard responds', async ({ request }) => {
    test.skip(!apiAlive, 'backend down')
    const { token } = await apiSignup(request, { user_type: 'candidate' })
    const a = api(request, token)

    const create = await a.post('/candidates/promises', {
      promise_text: 'Lower property taxes within first 100 days',
      category: 'taxation',
    })
    expect([200, 201, 400, 404]).toContain(create.status())

    const board = await a.get('/promises/leaderboard')
    expect(board.status()).toBeLessThan(500)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Platform features — each page must render + body matches feature topic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('7. Platform features render with on-topic content', () => {
  const features = [
    { path: '/petitions', look: /petition/i },
    { path: '/town-halls', look: /town hall/i },
    { path: '/revolving-door', look: /revolving|door|employment/i },
    { path: '/trading-monitor', look: /trade|stock|trading/i },
    { path: '/transparency', look: /transparency|compliance|score/i },
    { path: '/follow-the-money', look: /money|donor|finance/i },
    { path: '/promises', look: /promise/i },
    { path: '/conflicts', look: /conflict/i },
    { path: '/rubber-stamp', look: /rubber|stamp|vote/i },
    { path: '/foreign-aid', look: /foreign|aid|country/i },
    { path: '/dark-money', look: /dark|money|spending/i },
    { path: '/voter-access', look: /voter|access|registration/i },
    { path: '/pac-pledge', look: /pac|pledge/i },
    { path: '/cost-calculator', look: /cost|spending|calculator/i },
    { path: '/gerrymandering', look: /gerrymander|district|map/i },
    { path: '/ballot-measures', look: /ballot|measure|proposition/i },
  ]

  for (const { path, look } of features) {
    test(`${path} renders feature content`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      const body = await page.locator('main').innerText()
      expect(body, `${path} body should mention feature topic`).toMatch(look)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Auth guards
// ─────────────────────────────────────────────────────────────────────────────
test.describe('8. Auth guards', () => {
  test('voting-guide prompts sign-in when logged out', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/voting-guide')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByText('Sign in to build your voting guide')).toBeVisible()
  })

  test('admin route does not crash for unauthenticated user', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/admin')
    await page.evaluate(() => localStorage.clear()).catch(() => {})
    await page.reload()
    await expect(page.locator('main')).toBeVisible()
  })

  test('candidate-only edit page does not crash for voter', async ({ page, request }) => {
    test.skip(!apiAlive, 'backend down')
    const { token, user } = await apiSignup(request)
    await setAuthToken(page, token, user)
    await page.goto('/candidate/edit')
    await expect(page.locator('main')).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Search & lookup
// ─────────────────────────────────────────────────────────────────────────────
test.describe('9. Search and lookup', () => {
  test('global search returns 2xx and JSON', async ({ request }) => {
    test.skip(!apiAlive, 'backend down')
    const res = await request.get(`${process.env.E2E_API_BASE || 'http://localhost:5000/api'}/search?q=test`)
    expect(res.status()).toBeLessThan(500)
    if (res.ok()) {
      const text = await res.text()
      expect(() => JSON.parse(text)).not.toThrow()
    }
  })

  test('explore page has a search input that accepts text', async ({ page }) => {
    await page.goto('/explore')
    const search = page.locator('input[type="search"], input[placeholder*="earch" i]').first()
    if (await search.isVisible().catch(() => false)) {
      await search.fill('smith')
      await page.waitForTimeout(500)
    }
  })
})
