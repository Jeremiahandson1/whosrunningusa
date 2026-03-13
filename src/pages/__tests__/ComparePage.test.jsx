import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ComparePage from '../ComparePage'

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '../../utils/api'

const renderWithRouter = (ui, { initialEntries = ['/compare'] } = {}) =>
  render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ candidates: [] })
})

describe('ComparePage', () => {
  it('renders the page heading', () => {
    renderWithRouter(<ComparePage />)
    expect(screen.getByText('Compare Candidates')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderWithRouter(<ComparePage />)
    expect(screen.getByText(/side-by-side on the issues/i)).toBeInTheDocument()
  })

  it('renders the search input for manual comparison', () => {
    renderWithRouter(<ComparePage />)
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument()
  })

  it('renders the empty state with browse races link', () => {
    renderWithRouter(<ComparePage />)
    expect(screen.getByText('Compare candidates in a race')).toBeInTheDocument()
    expect(screen.getByText('Browse Races')).toBeInTheDocument()
  })

  it('renders search button', () => {
    renderWithRouter(<ComparePage />)
    expect(screen.getByText('Search')).toBeInTheDocument()
  })
})
