import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from '../RegisterPage'

const mockRegister = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, register: mockRegister }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RegisterPage', () => {
  it('renders the join heading', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByText('Join WhosRunningUSA')).toBeInTheDocument()
  })

  it('renders account type selection on step 1', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByText("I'm a Voter")).toBeInTheDocument()
    expect(screen.getByText("I'm Running for Office")).toBeInTheDocument()
  })

  it('renders continue button', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByText('Continue')).toBeInTheDocument()
  })

  it('shows step 2 form after selecting voter and clicking continue', () => {
    renderWithRouter(<RegisterPage />)
    fireEvent.click(screen.getByText("I'm a Voter"))
    fireEvent.click(screen.getByText('Continue'))

    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
    expect(screen.getByText('Email Address')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('shows step 2 form for candidate type', () => {
    renderWithRouter(<RegisterPage />)
    fireEvent.click(screen.getByText("I'm Running for Office"))
    fireEvent.click(screen.getByText('Continue'))

    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText(/identity verification/i)).toBeInTheDocument()
  })

  it('renders sign in link', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('renders terms and privacy links', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })
})
