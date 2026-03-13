import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'
import api from '../utils/api'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSubmitted(true)
    } catch (_err) {
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 72px - 200px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '3rem 1.5rem',
      background: 'linear-gradient(180deg, var(--slate-100) 0%, var(--slate-50) 100%)'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Reset Password</h1>
          <p style={{ color: 'var(--slate-600)' }}>
            {submitted
              ? 'Check your email for a reset link'
              : 'Enter your email and we\'ll send you a reset link'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--slate-700)', marginBottom: '1.5rem' }}>
                If an account exists with <strong>{email}</strong>, you'll receive a password reset link shortly.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                <ArrowLeft size={18} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={{ paddingLeft: '3rem' }}
                    required
                  />
                </div>
              </div>

              {error && <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--slate-200)' }}>
            <p style={{ color: 'var(--slate-600)', fontSize: '0.9375rem' }}>
              Remember your password?{' '}
              <Link to="/login" style={{ fontWeight: 600, color: 'var(--navy-700)' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
