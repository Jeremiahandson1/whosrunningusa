import React from 'react'
import { Sentry } from '../utils/sentry'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error)
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
          <h2 style={{ marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.href = '/'
            }}
          >
            Go Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
