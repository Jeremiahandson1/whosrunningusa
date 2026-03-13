import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

// Suppress console.error for expected errors in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function ThrowingComponent() {
  throw new Error('Test error')
}

function GoodComponent() {
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument()
  })

  it('renders a Go Home button in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )
    const btn = screen.getByText('Go Home')
    expect(btn).toBeInTheDocument()
    expect(btn.tagName).toBe('BUTTON')
  })
})
