import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader, ArrowRight } from 'lucide-react'
import api from '../utils/api'

function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const userId = searchParams.get('userId')

  const [status, setStatus] = useState('verifying') // verifying | success | error | invalid
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token || !userId) {
      setStatus('invalid')
      return
    }

    api.post('/auth/verify-email', { token, userId })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setErrorMsg(err.message || 'Verification failed')
      })
  }, [token, userId])

  return (
    <div style={{
      minHeight: 'calc(100vh - 72px - 200px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '3rem 1.5rem',
      background: 'linear-gradient(180deg, var(--slate-100) 0%, var(--slate-50) 100%)'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
          {status === 'verifying' && (
            <>
              <Loader size={48} style={{ color: 'var(--navy-600)', marginBottom: '1.5rem', animation: 'spin 1s linear infinite' }} />
              <h2 style={{ marginBottom: '0.5rem' }}>Verifying your email...</h2>
              <p style={{ color: 'var(--slate-600)' }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1.5rem' }} />
              <h2 style={{ marginBottom: '0.5rem' }}>Email Verified!</h2>
              <p style={{ color: 'var(--slate-600)', marginBottom: '2rem' }}>
                Your email has been verified successfully. You can now access all features.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>
                Continue to Sign In <ArrowRight size={18} />
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={48} style={{ color: 'var(--error)', marginBottom: '1.5rem' }} />
              <h2 style={{ marginBottom: '0.5rem' }}>Verification Failed</h2>
              <p style={{ color: 'var(--slate-600)', marginBottom: '2rem' }}>
                {errorMsg === 'Email already verified'
                  ? 'Your email has already been verified. You can sign in now.'
                  : 'The verification link is invalid or has expired. Please sign in and request a new verification email.'}
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>
                Go to Sign In <ArrowRight size={18} />
              </Link>
            </>
          )}

          {status === 'invalid' && (
            <>
              <XCircle size={48} style={{ color: 'var(--error)', marginBottom: '1.5rem' }} />
              <h2 style={{ marginBottom: '0.5rem' }}>Invalid Link</h2>
              <p style={{ color: 'var(--slate-600)', marginBottom: '2rem' }}>
                This verification link is missing required information. Please check your email and try clicking the link again.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>
                Go to Sign In <ArrowRight size={18} />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailPage
