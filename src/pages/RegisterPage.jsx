import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, CheckCircle, Users, Award, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function getPasswordStrength(password) {
  if (!password || password.length < 8) return { level: 'weak', label: 'Weak', color: '#c53030', width: '25%' }
  const hasLetters = /[a-zA-Z]/.test(password)
  const hasNumbers = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  if (hasLetters && hasNumbers && hasSpecial) return { level: 'strong', label: 'Strong', color: '#276749', width: '100%' }
  if (hasLetters && hasNumbers) return { level: 'good', label: 'Good', color: '#38a169', width: '75%' }
  return { level: 'fair', label: 'Fair', color: '#dd6b20', width: '50%' }
}

function PasswordStrength({ password }) {
  if (!password) return null
  const { label, color, width } = getPasswordStrength(password)
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--slate-200)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width, background: color, borderRadius: 2, transition: 'width 0.3s, background 0.3s' }} />
      </div>
      <div style={{ fontSize: '0.75rem', color, marginTop: '0.25rem', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function RegisterPage() {
  const [step, setStep] = useState(1)
  const [accountType, setAccountType] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    city: '',
    state: '',
    username: ''
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [termsError, setTermsError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step === 1 && accountType) {
      setStep(2)
      return
    }
    if (step === 2) {
      if (!agreedToTerms) {
        setTermsError('You must agree to the Terms of Service and Privacy Policy')
        return
      }
      setTermsError('')
      setError('')
      setLoading(true)
      try {
        await register({
          ...formData,
          user_type: accountType,
          username: formData.username || formData.email.split('@')[0],
        })
        navigate('/')
      } catch (err) {
        setError(err.message || 'Registration failed')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 72px - 200px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '3rem 1.5rem',
      background: 'linear-gradient(180deg, var(--slate-100) 0%, var(--slate-50) 100%)'
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Join WhosRunningUSA</h1>
          <p style={{ color: 'var(--slate-600)' }}>
            {step === 1
              ? 'Choose how you want to participate in democracy'
              : accountType === 'voter'
                ? 'Create your voter account'
                : 'Start your candidate registration'}
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && (
            <div role="alert" aria-live="assertive" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(197,48,48,0.08)', borderRadius: '6px', marginBottom: '1.25rem', color: 'var(--error)', fontSize: '0.875rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <button type="button" onClick={() => setAccountType('voter')} style={{
                  padding: '1.5rem', border: accountType === 'voter' ? '2px solid var(--navy-700)' : '2px solid var(--slate-200)',
                  borderRadius: '8px', background: accountType === 'voter' ? 'var(--slate-50)' : 'white',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '1rem', alignItems: 'flex-start', transition: 'all var(--transition-fast)'
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: accountType === 'voter' ? 'var(--navy-700)' : 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accountType === 'voter' ? 'white' : 'var(--slate-500)', flexShrink: 0 }}>
                    <Users size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.25rem', fontSize: '1.0625rem' }}>I'm a Voter</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Find candidates, ask questions, build your voting guide, and hold elected officials accountable.</div>
                  </div>
                  {accountType === 'voter' && <CheckCircle size={24} style={{ color: 'var(--navy-700)', flexShrink: 0 }} />}
                </button>

                <button type="button" onClick={() => setAccountType('candidate')} style={{
                  padding: '1.5rem', border: accountType === 'candidate' ? '2px solid var(--burgundy-600)' : '2px solid var(--slate-200)',
                  borderRadius: '8px', background: accountType === 'candidate' ? 'rgba(139, 41, 66, 0.05)' : 'white',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '1rem', alignItems: 'flex-start', transition: 'all var(--transition-fast)'
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: accountType === 'candidate' ? 'var(--burgundy-600)' : 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accountType === 'candidate' ? 'white' : 'var(--slate-500)', flexShrink: 0 }}>
                    <Award size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.25rem', fontSize: '1.0625rem' }}>I'm Running for Office</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Create your campaign profile, connect with voters, host town halls, and build grassroots support.</div>
                  </div>
                  {accountType === 'candidate' && <CheckCircle size={24} style={{ color: 'var(--burgundy-600)', flexShrink: 0 }} />}
                </button>
              </div>

              <button onClick={handleSubmit} disabled={!accountType} className="btn btn-primary" style={{ width: '100%', padding: '0.875rem', opacity: accountType ? 1 : 0.5, cursor: accountType ? 'pointer' : 'not-allowed' }}>
                Continue <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label htmlFor="reg-first-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>First Name</label>
                  <input id="reg-first-name" type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="First" required />
                </div>
                <div>
                  <label htmlFor="reg-last-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Last Name</label>
                  <input id="reg-last-name" type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} placeholder="Last" required />
                </div>
              </div>

              {accountType === 'voter' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="reg-username" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)', fontWeight: 500 }}>@</span>
                    <input id="reg-username" type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="username" style={{ paddingLeft: '2.5rem' }} required />
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.375rem' }}>This is how you'll appear in Q&A and discussions</p>
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="reg-email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                  <input id="reg-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" style={{ paddingLeft: '3rem' }} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label htmlFor="reg-city" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>City</label>
                  <input id="reg-city" type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Eau Claire" required />
                </div>
                <div>
                  <label htmlFor="reg-state" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>State</label>
                  <input id="reg-state" type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="WI" maxLength={2} required />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="reg-password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                  <input id="reg-password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="At least 8 characters" style={{ paddingLeft: '3rem' }} required minLength={8} />
                </div>
                <PasswordStrength password={formData.password} />
              </div>

              {accountType === 'candidate' && (
                <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                  <strong style={{ color: 'var(--navy-800)' }}>Next step:</strong> After creating your account, you'll complete identity verification to activate your candidate profile.
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => { setAgreedToTerms(e.target.checked); if (e.target.checked) setTermsError('') }}
                    style={{ marginTop: '0.125rem', width: '1.125rem', height: '1.125rem', flexShrink: 0, accentColor: 'var(--navy-700)' }}
                  />
                  <span>
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--navy-700)' }}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--navy-700)' }}>Privacy Policy</a>
                  </span>
                </label>
                {termsError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.5rem', color: 'var(--error)', fontSize: '0.8125rem' }}>
                    <AlertCircle size={14} /> {termsError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
                <button type="submit" className={`btn ${accountType === 'candidate' ? 'btn-accent' : 'btn-primary'}`} style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--slate-200)' }}>
            <p style={{ color: 'var(--slate-600)', fontSize: '0.9375rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ fontWeight: 600, color: 'var(--navy-700)' }}>Sign in</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

export default RegisterPage
