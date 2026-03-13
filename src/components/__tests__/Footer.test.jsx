import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Footer from '../Footer'

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Footer', () => {
  it('renders the brand name', () => {
    renderWithRouter(<Footer />)
    expect(screen.getByText('WhosRunningUSA')).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    renderWithRouter(<Footer />)
    expect(screen.getByText('"Earn Our Vote"')).toBeInTheDocument()
  })

  it('renders voter links section', () => {
    renderWithRouter(<Footer />)
    expect(screen.getByText('For Voters')).toBeInTheDocument()
    expect(screen.getByText('Find Candidates')).toBeInTheDocument()
    expect(screen.getByText('Browse Races')).toBeInTheDocument()
    expect(screen.getByText('Compare Candidates')).toBeInTheDocument()
    expect(screen.getByText('Build Voting Guide')).toBeInTheDocument()
  })

  it('renders candidate links section', () => {
    renderWithRouter(<Footer />)
    expect(screen.getByText('For Candidates')).toBeInTheDocument()
    expect(screen.getByText('Run For Office')).toBeInTheDocument()
    expect(screen.getByText('Host Town Halls')).toBeInTheDocument()
  })

  it('renders company links section', () => {
    renderWithRouter(<Footer />)
    expect(screen.getByText('Company')).toBeInTheDocument()
    expect(screen.getByText('About Us')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
  })

  it('renders copyright with current year', () => {
    renderWithRouter(<Footer />)
    const year = new Date().getFullYear()
    expect(screen.getByText(`\u00A9 ${year} WhosRunningUSA. All rights reserved.`)).toBeInTheDocument()
  })
})
