import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const CANDIDATE_ID = 'c1a2b3c4-d5e6-7890-abcd-ef1234567890'
const RECORD_SELF_REPORTED = {
  id: 'rec-self-001',
  candidate_id: CANDIDATE_ID,
  offense: 'DUI – Driving Under the Influence',
  year: 2018,
  jurisdiction: 'Dane County, WI',
  jurisdiction_level: 'county',
  disposition: 'convicted',
  sentence: '6 months probation, license suspended 90 days',
  source: 'self_reported',
  candidate_statement: 'I take full responsibility for this mistake and have been sober since 2019.',
  is_public: true,
  moderation_status: 'approved',
  created_at: '2025-11-02T14:30:00Z',
  updated_at: '2025-11-02T14:30:00Z',
}

const RECORD_SYSTEM_PULLED = {
  id: 'rec-sys-002',
  candidate_id: CANDIDATE_ID,
  offense: 'Misdemeanor Trespassing',
  year: 2015,
  jurisdiction: 'Milwaukee County, WI',
  jurisdiction_level: 'county',
  disposition: 'dismissed',
  sentence: null,
  source: 'system_pulled',
  candidate_statement: null,
  is_public: true,
  moderation_status: 'approved',
  created_at: '2025-10-15T09:00:00Z',
  updated_at: '2025-10-15T09:00:00Z',
}

const CANDIDATE_PROFILE = {
  id: CANDIDATE_ID,
  display_name: 'Sarah Mitchell',
  party_affiliation: 'Independent',
  office_sought: 'State Senate District 14',
  bio: 'Community advocate and small business owner.',
  website: 'https://mitchellforsenate.com',
  candidate_verified: true,
  photo_url: null,
  criminalRecords: [RECORD_SELF_REPORTED, RECORD_SYSTEM_PULLED],
  positions: [],
  endorsements: [],
  endorsementsGiven: [],
  isFollowing: false,
}

const PENDING_RECORD = {
  id: 'rec-pending-003',
  candidate_id: 'c9999999-0000-0000-0000-000000000001',
  candidate_name: 'James Rivera',
  offense: 'Tax Evasion',
  year: 2021,
  jurisdiction: 'Federal',
  jurisdiction_level: 'federal',
  disposition: 'convicted',
  sentence: '2 years supervised release, restitution',
  source: 'system_pulled',
  candidate_statement: null,
  is_public: false,
  moderation_status: 'pending',
  created_at: '2026-03-10T11:00:00Z',
}

const AUTH_TOKEN = 'mock-jwt-token-for-testing'
const ADMIN_TOKEN = 'mock-admin-jwt-token'

// ---------------------------------------------------------------------------
// Helpers — set localStorage auth before navigation
// ---------------------------------------------------------------------------

async function loginAsCandidate(page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('token', token)
    window.localStorage.setItem('user', JSON.stringify({
      id: 'u-candidate-001',
      email: 'sarah@mitchell.com',
      user_type: 'candidate',
      display_name: 'Sarah Mitchell',
    }))
  }, AUTH_TOKEN)
}

async function loginAsAdmin(page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('token', token)
    window.localStorage.setItem('user', JSON.stringify({
      id: 'u-admin-001',
      email: 'admin@whosrunningusa.com',
      user_type: 'admin',
      display_name: 'Admin User',
    }))
  }, ADMIN_TOKEN)
}

// ---------------------------------------------------------------------------
// 1. Viewing criminal records on the candidate profile page
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Public Candidate Profile', () => {
  test('displays approved criminal records with offense, disposition, and statement', async ({ page }) => {
    // Intercept the candidate detail API
    await page.route('**/api/candidates/' + CANDIDATE_ID, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidate: CANDIDATE_PROFILE }),
      })
    )
    // Intercept ancillary calls that the page may make
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/questions*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: [] }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/voting-record*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ votes: [], stats: { total_votes: 0 } }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/sponsorships*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sponsorships: [] }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/events*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) })
    )

    await page.goto(`/candidate/${CANDIDATE_ID}`)

    // Section heading
    await expect(page.getByText('Criminal Record')).toBeVisible()

    // Self-reported record content
    await expect(page.getByText('DUI – Driving Under the Influence')).toBeVisible()
    await expect(page.getByText('Disposition: Convicted')).toBeVisible()
    await expect(page.getByText('Year: 2018')).toBeVisible()
    await expect(page.getByText('Self-Reported')).toBeVisible()
    await expect(page.getByText(/I take full responsibility/)).toBeVisible()

    // System-pulled record content
    await expect(page.getByText('Misdemeanor Trespassing')).toBeVisible()
    await expect(page.getByText('Disposition: Dismissed')).toBeVisible()
    await expect(page.getByText('Public Record')).toBeVisible()
  })

  test('does not show criminal record section when candidate has no records', async ({ page }) => {
    const candidateNoRecords = { ...CANDIDATE_PROFILE, criminalRecords: [] }
    await page.route('**/api/candidates/' + CANDIDATE_ID, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidate: candidateNoRecords }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/questions*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: [] }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/voting-record*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ votes: [], stats: { total_votes: 0 } }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/sponsorships*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sponsorships: [] }) })
    )
    await page.route('**/api/candidates/' + CANDIDATE_ID + '/events*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) })
    )

    await page.goto(`/candidate/${CANDIDATE_ID}`)
    await expect(page.getByText('Criminal Record')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 2. Candidate self-reporting a criminal record
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Candidate Self-Report', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCandidate(page)

    // Intercept profile load for the edit page
    await page.route('**/api/candidates/profile', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CANDIDATE_ID,
          display_name: 'Sarah Mitchell',
          party_affiliation: 'Independent',
          office_sought: 'State Senate District 14',
          bio: 'Community advocate.',
          website: 'https://mitchellforsenate.com',
          photo_url: null,
        }),
      })
    )

    // Intercept my-records
    await page.route('**/api/criminal-records/my-records', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) })
    )
  })

  test('opens the self-report form and submits a new record', async ({ page }) => {
    // Intercept POST to create a record
    let postedBody = null
    await page.route('**/api/criminal-records', (route) => {
      if (route.request().method() === 'POST') {
        postedBody = route.request().postDataJSON()
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'rec-new-004',
            candidate_id: CANDIDATE_ID,
            offense: postedBody?.offense || 'Shoplifting',
            year: postedBody?.year || 2020,
            jurisdiction: postedBody?.jurisdiction || 'Cook County, IL',
            jurisdiction_level: postedBody?.jurisdictionLevel || 'county',
            disposition: postedBody?.disposition || 'convicted',
            sentence: postedBody?.sentence || '40 hours community service',
            source: 'self_reported',
            candidate_statement: postedBody?.candidateStatement || '',
            is_public: true,
            moderation_status: 'approved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/candidate/edit')

    // Section should be visible
    await expect(page.getByText('Criminal Record Disclosure')).toBeVisible()
    await expect(page.getByText('No records disclosed.')).toBeVisible()

    // Open the add form
    await page.getByRole('button', { name: /Add Record/i }).click()

    // Fill in the form
    await page.getByPlaceholder('Description of the offense').fill('Shoplifting')
    await page.getByPlaceholder('e.g. 2019').fill('2020')
    await page.getByPlaceholder('e.g. Cook County, IL').fill('Cook County, IL')

    // Select jurisdiction level
    const jurisdictionSelect = page.locator('select').filter({ has: page.locator('option[value="county"]') }).first()
    await jurisdictionSelect.selectOption('county')

    // Select disposition
    const dispositionSelect = page.locator('select').filter({ has: page.locator('option[value="convicted"]') }).last()
    await dispositionSelect.selectOption('convicted')

    await page.getByPlaceholder('e.g. 6 months probation').fill('40 hours community service')
    await page.getByPlaceholder('Your statement about this record').fill('I was young and made a mistake. I have learned from it.')

    // Submit
    await page.getByRole('button', { name: /Save Record/i }).click()

    // The new record should now appear in the list
    await expect(page.getByText('Shoplifting')).toBeVisible()
  })

  test('Save Record button is disabled when required fields are empty', async ({ page }) => {
    await page.goto('/candidate/edit')
    await page.getByRole('button', { name: /Add Record/i }).click()

    const saveBtn = page.getByRole('button', { name: /Save Record/i })
    await expect(saveBtn).toBeDisabled()

    // Fill only offense — still disabled (no disposition)
    await page.getByPlaceholder('Description of the offense').fill('Test offense')
    await expect(saveBtn).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 3. Editing a self-reported record
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Edit Self-Reported Record', () => {
  test('shows edit form and saves updated offense', async ({ page }) => {
    await loginAsCandidate(page)

    await page.route('**/api/candidates/profile', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CANDIDATE_ID,
          display_name: 'Sarah Mitchell',
          party_affiliation: 'Independent',
          office_sought: 'State Senate District 14',
          bio: 'Community advocate.',
          website: '',
          photo_url: null,
        }),
      })
    )

    await page.route('**/api/criminal-records/my-records', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [RECORD_SELF_REPORTED] }),
      })
    )

    // Intercept PUT for update
    await page.route('**/api/criminal-records/' + RECORD_SELF_REPORTED.id, (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...RECORD_SELF_REPORTED, ...body, updated_at: new Date().toISOString() }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/candidate/edit')

    // Existing record should be visible
    await expect(page.getByText('DUI – Driving Under the Influence')).toBeVisible()
    await expect(page.getByText('Self-Reported')).toBeVisible()

    // Click Edit button
    await page.getByRole('button', { name: 'Edit' }).click()

    // The inline edit form should appear with the offense pre-filled
    const offenseInput = page.locator('input[placeholder="Offense"]')
    await expect(offenseInput).toBeVisible()
    await expect(offenseInput).toHaveValue('DUI – Driving Under the Influence')

    // Change the offense text
    await offenseInput.fill('DUI – First Offense, No Injuries')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    // Updated record should be shown
    await expect(page.getByText('DUI – First Offense, No Injuries')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 4. Deleting a self-reported record
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Delete Self-Reported Record', () => {
  test('removes the record from the list after confirmation', async ({ page }) => {
    await loginAsCandidate(page)

    await page.route('**/api/candidates/profile', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CANDIDATE_ID,
          display_name: 'Sarah Mitchell',
          party_affiliation: 'Independent',
          office_sought: 'State Senate District 14',
          bio: '',
          website: '',
          photo_url: null,
        }),
      })
    )

    await page.route('**/api/criminal-records/my-records', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [RECORD_SELF_REPORTED] }),
      })
    )

    // Intercept DELETE
    let deleteRequested = false
    await page.route('**/api/criminal-records/' + RECORD_SELF_REPORTED.id, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequested = true
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Record deleted' }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/candidate/edit')

    // Record is visible
    await expect(page.getByText('DUI – Driving Under the Influence')).toBeVisible()

    // Accept the confirm dialog that will pop up
    page.on('dialog', (dialog) => dialog.accept())

    // Click the delete button (Trash2 icon button inside the record row)
    const recordRow = page.locator('div').filter({ hasText: 'DUI – Driving Under the Influence' }).first()
    const deleteBtn = recordRow.locator('button').filter({ has: page.locator('svg') }).last()
    await deleteBtn.click()

    // Record should be gone
    await expect(page.getByText('DUI – Driving Under the Influence')).not.toBeVisible()
    expect(deleteRequested).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Adding a statement to a system-pulled record
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Add Statement to System-Pulled Record', () => {
  test('opens statement form and saves candidate statement', async ({ page }) => {
    await loginAsCandidate(page)

    await page.route('**/api/candidates/profile', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CANDIDATE_ID,
          display_name: 'Sarah Mitchell',
          party_affiliation: 'Independent',
          office_sought: 'State Senate District 14',
          bio: '',
          website: '',
          photo_url: null,
        }),
      })
    )

    await page.route('**/api/criminal-records/my-records', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [RECORD_SYSTEM_PULLED] }),
      })
    )

    // Intercept PUT for statement endpoint
    await page.route('**/api/criminal-records/' + RECORD_SYSTEM_PULLED.id + '/statement', (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...RECORD_SYSTEM_PULLED,
            candidate_statement: body.candidateStatement,
            updated_at: new Date().toISOString(),
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto('/candidate/edit')

    // System-pulled record should be visible
    await expect(page.getByText('Misdemeanor Trespassing')).toBeVisible()
    await expect(page.getByText('Public Record')).toBeVisible()

    // Click "Add Statement" button (shown for system-pulled records without a statement)
    await page.getByRole('button', { name: /Add Statement/i }).click()

    // Statement textarea should appear
    const statementInput = page.getByPlaceholder('Your statement about this record')
    await expect(statementInput).toBeVisible()
    await statementInput.fill('These charges were dropped. I was not involved in the incident.')

    // Save
    await page.getByRole('button', { name: /Save Statement/i }).click()

    // Statement should now show on the record
    await expect(page.getByText(/These charges were dropped/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 6. Admin moderation queue — viewing pending records
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Admin Moderation Queue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)

    // Intercept admin queue endpoint
    await page.route('**/api/admin/criminal-records/queue*', (route) => {
      const url = new URL(route.request().url())
      const status = url.searchParams.get('status') || 'pending'
      if (status === 'pending') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ records: [PENDING_RECORD] }),
        })
      } else if (status === 'approved') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            records: [{
              ...RECORD_SELF_REPORTED,
              candidate_name: 'Sarah Mitchell',
              moderation_notes: 'Verified against court records.',
            }],
          }),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ records: [] }),
        })
      }
    })
  })

  test('renders the pending moderation queue with record details', async ({ page }) => {
    await page.goto('/admin/criminal-records')

    // Page heading
    await expect(page.getByRole('heading', { name: 'Criminal Records' })).toBeVisible()

    // Filter tabs
    await expect(page.getByRole('button', { name: 'pending' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'approved' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'rejected' })).toBeVisible()

    // Pending record details
    await expect(page.getByText('James Rivera')).toBeVisible()
    await expect(page.getByText('Tax Evasion')).toBeVisible()
    await expect(page.getByText('Disposition: Convicted')).toBeVisible()
    await expect(page.getByText('System-Pulled')).toBeVisible()

    // Moderation controls should be visible
    await expect(page.getByRole('button', { name: /Approve/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Reject/i })).toBeVisible()
    await expect(page.getByPlaceholder(/Moderation notes/i)).toBeVisible()
  })

  test('switching to approved tab shows approved records', async ({ page }) => {
    await page.goto('/admin/criminal-records')

    await page.getByRole('button', { name: 'approved' }).click()

    await expect(page.getByText('Sarah Mitchell')).toBeVisible()
    await expect(page.getByText('DUI – Driving Under the Influence')).toBeVisible()

    // Approve/Reject buttons should NOT appear on non-pending records
    await expect(page.getByRole('button', { name: /Approve/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Reject/i })).not.toBeVisible()
  })

  test('switching to rejected tab with no records shows empty state', async ({ page }) => {
    await page.goto('/admin/criminal-records')

    await page.getByRole('button', { name: 'rejected' }).click()

    await expect(page.getByText('No rejected records')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 7. Admin approving / rejecting a record
// ---------------------------------------------------------------------------

test.describe('Criminal Records — Admin Approve & Reject', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)

    await page.route('**/api/admin/criminal-records/queue*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [PENDING_RECORD] }),
      })
    )
  })

  test('approving a record removes it from the pending queue', async ({ page }) => {
    let moderationPayload = null
    await page.route('**/api/admin/criminal-records/' + PENDING_RECORD.id + '/moderate', (route) => {
      moderationPayload = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...PENDING_RECORD, moderation_status: 'approved', is_public: true }),
      })
    })

    await page.goto('/admin/criminal-records')

    // Record is visible
    await expect(page.getByText('Tax Evasion')).toBeVisible()

    // Add optional moderation notes
    await page.getByPlaceholder(/Moderation notes/i).fill('Verified via federal court records.')

    // Click Approve
    await page.getByRole('button', { name: /Approve/i }).click()

    // Record should disappear from the queue
    await expect(page.getByText('Tax Evasion')).not.toBeVisible()
    await expect(page.getByText('The moderation queue is clear.')).toBeVisible()

    // Verify the payload sent to the API
    expect(moderationPayload).toEqual({
      status: 'approved',
      notes: 'Verified via federal court records.',
    })
  })

  test('rejecting a record removes it from the pending queue', async ({ page }) => {
    let moderationPayload = null
    await page.route('**/api/admin/criminal-records/' + PENDING_RECORD.id + '/moderate', (route) => {
      moderationPayload = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...PENDING_RECORD, moderation_status: 'rejected', is_public: false }),
      })
    })

    await page.goto('/admin/criminal-records')
    await expect(page.getByText('Tax Evasion')).toBeVisible()

    // Add rejection reason
    await page.getByPlaceholder(/Moderation notes/i).fill('Duplicate entry — already exists under a different name.')

    // Click Reject
    await page.getByRole('button', { name: /Reject/i }).click()

    // Record should be removed from queue
    await expect(page.getByText('Tax Evasion')).not.toBeVisible()

    expect(moderationPayload).toEqual({
      status: 'rejected',
      notes: 'Duplicate entry — already exists under a different name.',
    })
  })

  test('Add System Record button opens the admin add form', async ({ page }) => {
    await page.goto('/admin/criminal-records')

    // Click the Add System Record button
    await page.getByRole('button', { name: /Add System Record/i }).click()

    // The add form should appear
    await expect(page.getByText('Add System-Pulled Record')).toBeVisible()
    await expect(page.getByPlaceholder('Search candidate by name...')).toBeVisible()
    await expect(page.getByPlaceholder('Description of the offense')).toBeVisible()

    // Cancel closes the form
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Add System-Pulled Record')).not.toBeVisible()
  })
})
