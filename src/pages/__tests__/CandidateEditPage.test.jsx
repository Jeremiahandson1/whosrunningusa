import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CandidateEditPage from '../CandidateEditPage'

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockUser = { id: 'u1', user_type: 'candidate', candidate_profile_id: 'cp-1' }

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}))

import api from '../../utils/api'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/candidate/edit']}>
      <Routes>
        <Route path="/candidate/edit" element={<CandidateEditPage />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  // Default mocks for profile load
  api.get.mockImplementation((endpoint) => {
    if (endpoint.includes('/candidates/cp-1')) {
      return Promise.resolve({
        candidate: {
          display_name: 'Jane Doe',
          official_title: 'Mayor',
          party_affiliation: 'D',
          campaign_email: '',
          campaign_phone: '',
          full_bio: '',
          education: '',
          professional_background: '',
          twitter_handle: '',
          facebook_handle: '',
        },
      })
    }
    if (endpoint.includes('/criminal-records/my-records')) {
      return Promise.resolve({ records: [] })
    }
    return Promise.resolve({})
  })
})

describe('CandidateEditPage', () => {
  it('loads and displays profile form', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Mayor')).toBeInTheDocument()
    })
  })

  it('shows criminal records section', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Criminal Record Disclosure')).toBeInTheDocument()
      expect(screen.getByText('No records disclosed.')).toBeInTheDocument()
    })
  })

  it('shows add record button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Add Record')).toBeInTheDocument()
    })
  })

  it('displays existing criminal records', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates/cp-1')) {
        return Promise.resolve({
          candidate: { display_name: 'Jane Doe', official_title: '', party_affiliation: '' },
        })
      }
      if (endpoint.includes('/criminal-records/my-records')) {
        return Promise.resolve({
          records: [
            { id: 'r1', offense: 'DUI', disposition: 'convicted', year: 2019, moderation_status: 'approved', source: 'self_reported' },
            { id: 'r2', offense: 'Theft', disposition: 'dismissed', moderation_status: 'pending', source: 'system_pulled' },
          ]
        })
      }
      return Promise.resolve({})
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('DUI')).toBeInTheDocument()
      expect(screen.getByText('Theft')).toBeInTheDocument()
      expect(screen.getByText('Public')).toBeInTheDocument()
      expect(screen.getByText('Pending Review')).toBeInTheDocument()
    })
  })

  it('shows edit button for self-reported and statement button for system-pulled', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates/cp-1')) {
        return Promise.resolve({
          candidate: { display_name: 'Jane Doe', official_title: '', party_affiliation: '' },
        })
      }
      if (endpoint.includes('/criminal-records/my-records')) {
        return Promise.resolve({
          records: [
            { id: 'r1', offense: 'DUI', disposition: 'convicted', moderation_status: 'approved', source: 'self_reported' },
            { id: 'r2', offense: 'Theft', disposition: 'dismissed', moderation_status: 'approved', source: 'system_pulled' },
          ]
        })
      }
      return Promise.resolve({})
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Add Statement')).toBeInTheDocument()
    })
  })

  it('opens add record form when button is clicked', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Add Record')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add Record'))
    expect(screen.getByPlaceholderText('Description of the offense')).toBeInTheDocument()
    expect(screen.getByText('Save Record')).toBeInTheDocument()
  })
})
