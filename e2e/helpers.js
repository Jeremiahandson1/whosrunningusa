/**
 * Shared helpers for end-to-end specs.
 *
 * Exposes:
 *   - uniqueId / uniqueEmail / uniqueUsername — collision-free identifiers per run
 *   - apiSignup / apiLogin                    — fast auth via API (no UI clicks)
 *   - signupViaUI                             — drives the real /register form
 *   - api(token)                              — fetch helper that adds Bearer header
 *   - clearAuth(page)                         — wipes localStorage between flows
 *
 * E2E_API_BASE controls where the API lives. Defaults to http://localhost:5000/api.
 */

export const API_BASE = process.env.E2E_API_BASE || 'http://localhost:5000/api'

let counter = 0
const RUN_STAMP = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

/** Globally unique within a single test run. */
export function uniqueId(label = 'x') {
  counter += 1
  return `${label}-${RUN_STAMP}-${counter}`
}

export function uniqueEmail(label = 'user') {
  return `${uniqueId(label)}@e2e.local`.toLowerCase()
}

export function uniqueUsername(label = 'user') {
  // Username regex on backend is /^[a-zA-Z0-9_]+$/, so strip dashes.
  return uniqueId(label).replace(/-/g, '_')
}

/** Build a complete user payload with sane defaults. */
export function userFixture(overrides = {}) {
  const label = overrides.user_type === 'candidate' ? 'cand' : 'voter'
  return {
    email: uniqueEmail(label),
    username: uniqueUsername(label),
    password: 'TestPass123!',
    first_name: 'Test',
    last_name: 'User',
    city: 'Madison',
    state: 'WI',
    user_type: 'voter',
    ...overrides,
  }
}

/** POST /auth/register and return { user, token, fixture }. */
export async function apiSignup(request, overrides = {}) {
  const fixture = userFixture(overrides)
  const res = await request.post(`${API_BASE}/auth/register`, { data: fixture })
  if (!res.ok()) {
    throw new Error(`apiSignup failed: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json()
  return { user: body.user, token: body.token, fixture }
}

/** POST /auth/login. */
export async function apiLogin(request, email, password) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  })
  if (!res.ok()) {
    throw new Error(`apiLogin failed: ${res.status()} ${await res.text()}`)
  }
  return res.json()
}

/** Fill out the real /register form and submit. Asserts JWT lands in localStorage. */
export async function signupViaUI(page, overrides = {}) {
  const fixture = userFixture(overrides)
  await page.goto('/register')

  if (fixture.user_type === 'candidate') {
    await page.getByText("I'm Running for Office").click()
  } else {
    await page.getByText("I'm a Voter").click()
  }
  await page.getByRole('button', { name: /Continue/i }).click()

  await page.locator('#reg-first-name').fill(fixture.first_name)
  await page.locator('#reg-last-name').fill(fixture.last_name)
  await page.locator('#reg-username').fill(fixture.username)
  await page.locator('#reg-email').fill(fixture.email)
  await page.locator('#reg-city').fill(fixture.city)
  await page.locator('#reg-state').fill(fixture.state)
  await page.locator('#reg-password').fill(fixture.password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Create Account/i }).click()

  await page.waitForFunction(() => !!localStorage.getItem('token'), null, {
    timeout: 15000,
  })
  return fixture
}

/** Inject an auth token directly into localStorage so subsequent navigations are authenticated. */
export async function setAuthToken(page, token, user = null) {
  await page.goto('/')
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('token', t)
      if (u) localStorage.setItem('user', JSON.stringify(u))
    },
    [token, user]
  )
}

export async function clearAuth(page) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  })
}

/** Authenticated fetch wrapper. Usage: const res = await api(request, token).get('/me') */
export function api(request, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return {
    get: (path, opts = {}) =>
      request.get(`${API_BASE}${path}`, { headers, ...opts }),
    post: (path, data, opts = {}) =>
      request.post(`${API_BASE}${path}`, { headers, data, ...opts }),
    put: (path, data, opts = {}) =>
      request.put(`${API_BASE}${path}`, { headers, data, ...opts }),
    delete: (path, opts = {}) =>
      request.delete(`${API_BASE}${path}`, { headers, ...opts }),
  }
}

/** Probe /health once and return true/false. */
export async function backendUp(request) {
  try {
    const res = await request.get(`${API_BASE}/health`, { timeout: 5000 })
    return res.ok()
  } catch {
    return false
  }
}
