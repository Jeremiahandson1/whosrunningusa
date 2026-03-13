import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const successMessage = location.state?.message

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
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
          <h1 style={{ marginBottom: '0.5rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--slate-600)' }}>Sign in to continue to WhosRunningUSA</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            {successMessage && (
              <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(47,133,90,0.08)', borderRadius: '6px', marginBottom: '1.25rem', color: 'var(--success)', fontSize: '0.875rem' }}>
                <CheckCircle size={16} /> {successMessage}
              </div>
            )}
            {error && (
              <div role="alert" aria-live="assertive" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(197,48,48,0.08)', borderRadius: '6px', marginBottom: '1.25rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="login-email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ paddingLeft: '3rem' }} required />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label htmlFor="login-password" style={{ fontWeight: 500, fontSize: '0.875rem' }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--burgundy-600)' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" style={{ paddingLeft: '3rem' }} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--slate-200)' }}>
            <p style={{ color: 'var(--slate-600)', fontSize: '0.9375rem' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ fontWeight: 600, color: 'var(--navy-700)' }}>Create one free</Link>
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/run" style={{ fontSize: '0.9375rem', color: 'var(--burgundy-600)', fontWeight: 500 }}>
            Running for office? Register as a candidate
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
