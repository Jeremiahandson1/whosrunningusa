import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VotingGuidePage from '../VotingGuidePage'

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '../../utils/api'

let mockUser = null

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}))

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = null
  api.get.mockResolvedValue({ elections: [] })
})

describe('VotingGuidePage', () => {
  describe('logged out', () => {
    it('renders the heading', () => {
      renderWithRouter(<VotingGuidePage />)
      expect(screen.getByText('Voting Guide Builder')).toBeInTheDocument()
    })

    it('prompts the user to sign in', () => {
      renderWithRouter(<VotingGuidePage />)
      expect(screen.getByText(/Sign in to build your voting guide/i)).toBeInTheDocument()
    })

    it('shows sign in and create account links', () => {
      renderWithRouter(<VotingGuidePage />)
      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.getByText('Create Account')).toBeInTheDocument()
    })
  })

  describe('logged in', () => {
    beforeEach(() => {
      mockUser = { id: 1, first_name: 'Test', email: 'test@test.com' }
      api.get.mockImplementation((endpoint) => {
        if (endpoint.includes('/elections')) return Promise.resolve({ elections: [] })
        if (endpoint.includes('/voting-guide')) return Promise.resolve({ guide: null })
        if (endpoint.includes('/races')) return Promise.resolve({ races: [] })
        return Promise.resolve({})
      })
    })

    it('renders the logged-in heading', async () => {
      renderWithRouter(<VotingGuidePage />)
      await waitFor(() => {
        expect(screen.getByText('Your Voting Guide')).toBeInTheDocument()
      })
    })

    it('calls elections API', async () => {
      renderWithRouter(<VotingGuidePage />)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/elections')
      })
    })
  })
})
