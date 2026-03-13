import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CandidatePage from '../CandidatePage'

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

const renderWithRoute = (id = '1') =>
  render(
    <MemoryRouter initialEntries={[`/candidate/${id}`]}>
      <Routes>
        <Route path="/candidate/:id" element={<CandidatePage />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CandidatePage', () => {
  it('shows loading state initially', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithRoute()
    expect(screen.getByText('Loading candidate profile...')).toBeInTheDocument()
  })

  it('shows not found when candidate is null', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates/')) return Promise.resolve(null)
      if (endpoint.includes('/questions/')) return Promise.resolve({ questions: [] })
      if (endpoint.includes('/town-halls/')) return Promise.resolve({ townHalls: [] })
      return Promise.resolve({})
    })
    renderWithRoute()
    await waitFor(() => {
      expect(screen.getByText('Candidate not found')).toBeInTheDocument()
    })
  })

  it('renders candidate profile when data loads', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates/')) {
        return Promise.resolve({
          candidate: {
            id: 1,
            display_name: 'John Smith',
            official_title: 'Mayor',
            state: 'WI',
            city: 'Madison',
            qa_response_rate: 90,
            total_questions_answered: 5,
            total_questions_received: 6,
            town_halls_held: 2,
            positions: [],
          },
        })
      }
      if (endpoint.includes('/questions/')) return Promise.resolve({ questions: [] })
      if (endpoint.includes('/town-halls/')) return Promise.resolve({ townHalls: [] })
      return Promise.resolve({})
    })

    renderWithRoute()
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Mayor')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
    })
  })

  it('renders tab navigation', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates/')) {
        return Promise.resolve({
          candidate: { id: 1, display_name: 'Test', positions: [] },
        })
      }
      if (endpoint.includes('/questions/')) return Promise.resolve({ questions: [] })
      if (endpoint.includes('/town-halls/')) return Promise.resolve({ townHalls: [] })
      return Promise.resolve({})
    })

    renderWithRoute()
    await waitFor(() => {
      expect(screen.getByText('positions')).toBeInTheDocument()
      expect(screen.getByText('Q&A')).toBeInTheDocument()
      expect(screen.getByText('events')).toBeInTheDocument()
      expect(screen.getByText('endorsements')).toBeInTheDocument()
    })
  })

  it('calls the correct API endpoints', async () => {
    api.get.mockImplementation((endpoint) => {
      if (endpoint.includes('/candidates/')) {
        return Promise.resolve({ candidate: { id: 1, display_name: 'X', positions: [] } })
      }
      if (endpoint.includes('/questions/')) return Promise.resolve({ questions: [] })
      if (endpoint.includes('/town-halls/')) return Promise.resolve({ townHalls: [] })
      return Promise.resolve({})
    })

    renderWithRoute('42')
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/candidates/42')
      expect(api.get).toHaveBeenCalledWith('/questions/candidate/42')
      expect(api.get).toHaveBeenCalledWith('/town-halls/candidate/42')
    })
  })
})
