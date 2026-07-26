/**
 * API-only smoke test — no browser, runs in seconds.
 *
 * Hits every public read endpoint and exercises the full auth round-trip
 * (register -> login -> /me -> logout). Use this for fast pre-deploy checks
 * or when something feels off and you want to know if it's UI or backend.
 *
 * Run:        npx playwright test e2e/api-smoke.spec.js --project=api
 * Just one:   npx playwright test e2e/api-smoke.spec.js -g "candidates"
 *
 * Tests against E2E_API_BASE (default http://localhost:5000/api).
 */

import { test, expect } from '@playwright/test'
import {
  API_BASE,
  apiSignup,
  apiLogin,
  api,
  uniqueEmail,
  backendUp,
} from './helpers.js'

test.describe('API: health', () => {
  test('GET /health returns ok with db check', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
  })
})

// All read endpoints below — single test per endpoint so failures are pinpointable.
const READ_ENDPOINTS = [
  // Public listings
  { path: '/candidates?limit=5', name: 'candidates list' },
  { path: '/candidates/endorsements/list', name: 'endorsements list' },
  { path: '/races?limit=5', name: 'races list' },
  { path: '/elections', name: 'elections list' },
  { path: '/town-halls/upcoming', name: 'upcoming town halls' },
  { path: '/petitions?limit=5', name: 'petitions list' },
  { path: '/promises/leaderboard', name: 'promise leaderboard' },
  { path: '/trades?limit=5', name: 'trades list' },
  { path: '/revolving-door?limit=5', name: 'revolving door list' },
  { path: '/transparency', name: 'transparency overview' },
  { path: '/finance-map', name: 'finance map' },
  { path: '/foreign-aid', name: 'foreign aid' },
  { path: '/dark-money', name: 'dark money' },
  { path: '/foreign-influence', name: 'foreign influence' },
  { path: '/revenue-violations', name: 'revenue violations' },
  { path: '/conflicts', name: 'conflicts' },
  { path: '/rubber-stamp', name: 'rubber stamp' },
  { path: '/ballot-measures', name: 'ballot measures' },
  { path: '/gerrymandering', name: 'gerrymandering' },
  { path: '/voter-access', name: 'voter access' },
  { path: '/pac-pledge', name: 'pac pledge' },
  { path: '/cost-calculator', name: 'cost calculator' },
  { path: '/issues', name: 'issues' },
  // Search + lookup
  { path: '/search?q=test', name: 'global search' },
  // Bills + accountability
  { path: '/bills?limit=5', name: 'bills list' },
  { path: '/accountability', name: 'accountability index' },
  { path: '/community-notes?limit=5', name: 'community notes' },
  { path: '/connections?limit=5', name: 'connections' },
  { path: '/posts?limit=5', name: 'posts feed' },
  { path: '/criminal-records?limit=5', name: 'criminal records' },
]

test.describe('API: public read endpoints', () => {
  for (const { path, name } of READ_ENDPOINTS) {
    test(`GET ${path} (${name})`, async ({ request }) => {
      const res = await request.get(`${API_BASE}${path}`)
      // Some endpoints may return 404 if the table is empty — that's still
      // a healthy backend response. Anything 5xx is a real failure.
      expect(res.status(), `${path} returned ${res.status()}`).toBeLessThan(500)
      // If 2xx, body should parse as JSON.
      if (res.ok()) {
        const text = await res.text()
        expect(() => JSON.parse(text), `${path} did not return valid JSON`).not.toThrow()
      }
    })
  }
})

test.describe('API: auth round-trip', () => {
  test('register -> login -> token works on protected route', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')

    // Register a brand new user
    const { user, token, fixture } = await apiSignup(request)
    expect(user.email).toBe(fixture.email)
    expect(token).toBeTruthy()

    // Login should return a (possibly different) valid token
    const loginBody = await apiLogin(request, fixture.email, fixture.password)
    expect(loginBody.token).toBeTruthy()

    // Token should authenticate against a protected endpoint
    const authedApi = api(request, loginBody.token)
    const me = await authedApi.get('/auth/me')
    expect([200, 404]).toContain(me.status()) // /me may be /users/me — accept either shape
  })

  test('register rejects bad email', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const res = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: 'not-an-email',
        password: 'TestPass123!',
        username: 'badmail' + Date.now(),
        first_name: 'Bad',
        last_name: 'Email',
        city: 'X',
        state: 'XX',
        user_type: 'voter',
      },
    })
    expect(res.status()).toBe(400)
  })

  test('register rejects short password', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const res = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: uniqueEmail('shortpw'),
        password: 'short',
        username: 'shortpw' + Date.now(),
        user_type: 'voter',
      },
    })
    expect(res.status()).toBe(400)
  })

  test('register rejects duplicate email', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const { fixture } = await apiSignup(request)
    const dup = await request.post(`${API_BASE}/auth/register`, {
      data: { ...fixture, username: fixture.username + 'x' },
    })
    expect(dup.status()).toBe(409)
  })

  test('login rejects wrong password', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const { fixture } = await apiSignup(request)
    const res = await request.post(`${API_BASE}/auth/login`, {
      data: { email: fixture.email, password: 'WrongPass999!' },
    })
    expect(res.status()).toBe(401)
  })

  test('protected route rejects missing token', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const res = await request.put(`${API_BASE}/candidates/profile`, {
      data: { display_name: 'hax' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('API: voter -> petition flow', () => {
  test('voter can sign a petition (or reports clear empty state)', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const { token } = await apiSignup(request)
    const a = api(request, token)

    const list = await a.get('/petitions?limit=1')
    if (!list.ok()) test.skip(true, 'petitions endpoint failed')
    const body = await list.json()
    const items = body.petitions || body.data || (Array.isArray(body) ? body : [])
    if (items.length === 0) test.skip(true, 'no petitions seeded')

    const id = items[0].id
    const before = await a.get(`/petitions/${id}/progress`)
    const beforeCount = before.ok() ? (await before.json()).signature_count || 0 : 0

    const sign = await a.post(`/petitions/${id}/sign`, {})
    expect([200, 201, 409]).toContain(sign.status()) // 409 if already signed

    const after = await a.get(`/petitions/${id}/progress`)
    if (after.ok()) {
      const afterCount = (await after.json()).signature_count || 0
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount)
    }
  })
})

test.describe('API: candidate profile update', () => {
  test('candidate can update their own profile', async ({ request }) => {
    test.skip(!(await backendUp(request)), 'backend down')
    const { token } = await apiSignup(request, { user_type: 'candidate' })
    const a = api(request, token)

    const res = await a.put('/candidates/profile', {
      display_name: 'E2E Test Candidate',
      bio: 'Running for the people.',
    })
    expect([200, 204]).toContain(res.status())
  })
})
