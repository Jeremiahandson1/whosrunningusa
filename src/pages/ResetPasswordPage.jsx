import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../utils/api'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const userId = searchParams.get('userId')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const invalid = !token || !userId

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, userId, newPassword: password })
      setSuccess(true)
      setTimeout(() => navigate('/login', { state: { message: 'Password reset successful. Please sign in.' } }), 3000)
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
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
          <h1 style={{ marginBottom: '0.5rem' }}>Set New Password</h1>
          <p style={{ color: 'var(--slate-600)' }}>
            {success ? 'Your password has been reset' : 'Enter your new password below'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {invalid ? (
            <div style={{ textAlign: 'center' }}>
              <AlertCircle size={48} style={{ color: 'var(--error)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--slate-700)', marginBottom: '1.5rem' }}>
                Invalid or missing reset link. Please request a new password reset.
              </p>
              <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%' }}>
                Request New Reset Link
              </Link>
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--slate-700)', marginBottom: '1.5rem' }}>
                Your password has been reset successfully. Redirecting to sign in...
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                <ArrowLeft size={18} /> Sign In Now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={{ paddingLeft: '3rem' }}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    style={{ paddingLeft: '3rem' }}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
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

export default ResetPasswordPage
