import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, login: mockLogin }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders the welcome heading', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('renders create account link', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByText('Create one free')).toBeInTheDocument()
  })

  it('renders forgot password link', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
  })

  it('calls login on form submission', async () => {
    mockLogin.mockResolvedValue({})
    renderWithRouter(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByText('Sign In'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123')
    })
  })

  it('shows error on failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))
    renderWithRouter(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'bad@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByText('Sign In'))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})
