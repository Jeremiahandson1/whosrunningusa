import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContactPage from '../ContactPage'

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
})

describe('ContactPage', () => {
  it('renders the page heading', () => {
    renderWithRouter(<ContactPage />)
    expect(screen.getByText('Contact Us')).toBeInTheDocument()
  })

  it('renders the contact info section', () => {
    renderWithRouter(<ContactPage />)
    expect(screen.getByText('Get in Touch')).toBeInTheDocument()
    expect(screen.getByText('support@whosrunningusa.com')).toBeInTheDocument()
  })

  it('renders the form field labels', () => {
    renderWithRouter(<ContactPage />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    // "Email" appears both in contact info and as a form label
    const emailTexts = screen.getAllByText('Email')
    expect(emailTexts.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Subject')).toBeInTheDocument()
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('renders the send button', () => {
    renderWithRouter(<ContactPage />)
    expect(screen.getByText('Send Message')).toBeInTheDocument()
  })

  it('renders text inputs and textarea', () => {
    renderWithRouter(<ContactPage />)
    // 3 text/email inputs + 1 textarea
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBe(4) // name, email, subject, message(textarea)
  })

  it('shows success message after submission', async () => {
    api.post.mockResolvedValue({})
    renderWithRouter(<ContactPage />)

    const inputs = screen.getAllByRole('textbox')
    // inputs: [name, email, subject, message]
    fireEvent.change(inputs[0], { target: { value: 'John' } })
    fireEvent.change(inputs[1], { target: { value: 'john@test.com' } })
    fireEvent.change(inputs[2], { target: { value: 'Test subject' } })
    fireEvent.change(inputs[3], { target: { value: 'Hello there' } })

    fireEvent.click(screen.getByText('Send Message'))

    await waitFor(() => {
      expect(screen.getByText('Message Sent')).toBeInTheDocument()
      expect(screen.getByText(/Thank you for reaching out/i)).toBeInTheDocument()
    })
  })

  it('shows error on failed submission', async () => {
    api.post.mockRejectedValue(new Error('Server error'))
    renderWithRouter(<ContactPage />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'John' } })
    fireEvent.change(inputs[1], { target: { value: 'john@test.com' } })
    fireEvent.change(inputs[2], { target: { value: 'Test' } })
    fireEvent.change(inputs[3], { target: { value: 'Hi' } })

    fireEvent.click(screen.getByText('Send Message'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })
})
