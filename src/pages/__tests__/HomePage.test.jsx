import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../HomePage'

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '../../utils/api'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockImplementation((endpoint) => {
    if (endpoint.includes('/candidates')) return Promise.resolve({ candidates: [] })
    if (endpoint.includes('/elections')) return Promise.resolve({ elections: [] })
    if (endpoint.includes('/town-halls')) return Promise.resolve({ townHalls: [] })
    return Promise.resolve({})
  })
})

describe('HomePage', () => {
  it('renders the hero heading', async () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText(/earn your vote/i)).toBeInTheDocument()
  })

  it('renders the search input', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByPlaceholderText(/Search by candidate name/i)).toBeInTheDocument()
  })

  it('renders CTA links', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Find Your Candidates')).toBeInTheDocument()
    expect(screen.getAllByText('Run For Office').length).toBeGreaterThan(0)
  })

  it('renders election countdown section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText('Next Election')).toBeInTheDocument()
    expect(screen.getByText('Days')).toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
    expect(screen.getByText('Minutes')).toBeInTheDocument()
  })

  it('calls API endpoints on mount', async () => {
    renderWithRouter(<HomePage />)
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/candidates?limit=3')
      expect(api.get).toHaveBeenCalledWith('/elections')
      expect(api.get).toHaveBeenCalledWith('/town-halls/upcoming?limit=2')
    })
  })

  it('renders featured candidates when API returns data', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates')) {
        return Promise.resolve({
          candidates: [
            { id: 1, display_name: 'Jane Doe', qa_response_rate: 85, total_questions_answered: 10 },
          ],
        })
      }
      if (endpoint.includes('/elections')) return Promise.resolve({ elections: [] })
      if (endpoint.includes('/town-halls')) return Promise.resolve({ townHalls: [] })
      return Promise.resolve({})
    })

    renderWithRouter(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText('Featured Candidates')).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
  })

  it('shows fallback when no town halls', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText(/No upcoming town halls yet/i)).toBeInTheDocument()
  })
})
