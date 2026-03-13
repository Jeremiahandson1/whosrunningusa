import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ExplorePage from '../ExplorePage'

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../components/USMap', () => ({
  default: () => <div data-testid="us-map">US Map</div>,
}))

import api from '../../utils/api'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ candidates: [] })
})

describe('ExplorePage', () => {
  it('renders the page heading', async () => {
    renderWithRouter(<ExplorePage />)
    expect(screen.getByText('Find Your Candidates')).toBeInTheDocument()
  })

  it('renders the search input', () => {
    renderWithRouter(<ExplorePage />)
    expect(screen.getByPlaceholderText(/Search candidates or races/i)).toBeInTheDocument()
  })

  it('renders the level filter dropdown', () => {
    renderWithRouter(<ExplorePage />)
    expect(screen.getByText('All Levels')).toBeInTheDocument()
  })

  it('renders the US map', () => {
    renderWithRouter(<ExplorePage />)
    expect(screen.getByTestId('us-map')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    api.get.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithRouter(<ExplorePage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows candidate count after loading', async () => {
    api.get.mockResolvedValue({
      candidates: [
        { id: 1, display_name: 'Test Candidate', qa_response_rate: 50 },
      ],
    })
    renderWithRouter(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('Test Candidate')).toBeInTheDocument()
    })
  })

  it('shows empty state when no candidates found', async () => {
    api.get.mockResolvedValue({ candidates: [] })
    renderWithRouter(<ExplorePage />)
    await waitFor(() => {
      expect(screen.getByText('No candidates found')).toBeInTheDocument()
    })
  })

  it('renders Search and Filters buttons', () => {
    renderWithRouter(<ExplorePage />)
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })
})
