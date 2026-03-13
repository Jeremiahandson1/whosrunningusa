import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RacesPage from '../RacesPage'

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
    if (endpoint.includes('/races')) return Promise.resolve({ races: [] })
    if (endpoint.includes('/elections')) return Promise.resolve({ elections: [] })
    return Promise.resolve({})
  })
})

describe('RacesPage', () => {
  it('renders the page heading', () => {
    renderWithRouter(<RacesPage />)
    expect(screen.getByText('Browse Races')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderWithRouter(<RacesPage />)
    expect(screen.getByText(/See every race on your ballot/i)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<RacesPage />)
    expect(screen.getByText('Loading races...')).toBeInTheDocument()
  })

  it('renders the scope filter', () => {
    renderWithRouter(<RacesPage />)
    expect(screen.getByText('All Levels')).toBeInTheDocument()
  })

  it('shows races when data loads', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/races')) {
        return Promise.resolve({
          races: [{ id: 1, name: 'US Senate - Wisconsin', candidate_count: 3 }],
        })
      }
      if (endpoint.includes('/elections')) return Promise.resolve({ elections: [] })
      return Promise.resolve({})
    })

    renderWithRouter(<RacesPage />)
    await waitFor(() => {
      expect(screen.getByText('US Senate - Wisconsin')).toBeInTheDocument()
      expect(screen.getByText('3 candidates')).toBeInTheDocument()
    })
  })

  it('shows empty state when no races', async () => {
    renderWithRouter(<RacesPage />)
    await waitFor(() => {
      expect(screen.getByText('No races found')).toBeInTheDocument()
    })
  })

  it('calls API with correct endpoints', async () => {
    renderWithRouter(<RacesPage />)
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/races')
      expect(api.get).toHaveBeenCalledWith('/elections')
    })
  })
})
