import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from '../Header'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, logout: vi.fn() }),
}))

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Header', () => {
  it('renders the logo text', () => {
    renderWithRouter(<Header />)
    expect(screen.getByText('WR')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderWithRouter(<Header />)
    expect(screen.getByText('Find Candidates')).toBeInTheDocument()
    expect(screen.getByText('Races')).toBeInTheDocument()
    expect(screen.getByText('Town Halls')).toBeInTheDocument()
    expect(screen.getByText('How It Works')).toBeInTheDocument()
  })

  it('renders sign in and get started links when logged out', () => {
    renderWithRouter(<Header />)
    const signInLinks = screen.getAllByText('Sign In')
    expect(signInLinks.length).toBeGreaterThan(0)
    const getStartedLinks = screen.getAllByText('Get Started')
    expect(getStartedLinks.length).toBeGreaterThan(0)
  })

  it('toggles mobile menu on button click', () => {
    renderWithRouter(<Header />)
    const toggleBtn = screen.getByLabelText('Toggle menu')
    expect(toggleBtn).toBeInTheDocument()
    fireEvent.click(toggleBtn)
    // After opening, mobile nav links should appear
    const mobileLinks = screen.getAllByText('Find Candidates')
    expect(mobileLinks.length).toBeGreaterThanOrEqual(2)
  })
})
