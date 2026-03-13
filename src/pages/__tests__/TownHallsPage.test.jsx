import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TownHallsPage from '../TownHallsPage'

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

import api from '../../utils/api'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ townHalls: [] })
})

describe('TownHallsPage', () => {
  it('renders the page heading', () => {
    renderWithRouter(<TownHallsPage />)
    expect(screen.getByText('Town Halls')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderWithRouter(<TownHallsPage />)
    expect(screen.getByText(/Attend live video or text-based/i)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<TownHallsPage />)
    expect(screen.getByText('Loading upcoming town halls...')).toBeInTheDocument()
  })

  it('shows empty state when no town halls', async () => {
    renderWithRouter(<TownHallsPage />)
    await waitFor(() => {
      expect(screen.getByText('No upcoming town halls')).toBeInTheDocument()
    })
  })

  it('renders town halls when data loads', async () => {
    api.get.mockResolvedValue({
      townHalls: [
        {
          id: 1,
          title: 'Education Q&A',
          candidate_name: 'Jane Doe',
          candidate_id: 10,
          format: 'video',
          scheduled_at: '2026-06-01T18:00:00Z',
          description: 'Discussing education policy',
        },
      ],
    })

    renderWithRouter(<TownHallsPage />)
    await waitFor(() => {
      expect(screen.getByText('Education Q&A')).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
      expect(screen.getByText('Discussing education policy')).toBeInTheDocument()
    })
  })

  it('calls the upcoming town halls API', async () => {
    renderWithRouter(<TownHallsPage />)
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/town-halls/upcoming')
    })
  })
})
