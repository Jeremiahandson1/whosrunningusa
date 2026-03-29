import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserCheck, Search, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
]

const STATUS_CONFIG = {
  pending: { color: '#ca8a04', bg: '#fefce8', icon: <Clock size={16} />, label: 'Pending Review' },
  approved: { color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle size={16} />, label: 'Approved' },
  rejected: { color: '#dc2626', bg: '#fef2f2', icon: <XCircle size={16} />, label: 'Rejected' },
  needs_info: { color: '#7c3aed', bg: '#faf5ff', icon: <AlertCircle size={16} />, label: 'Needs More Info' },
}

function ClaimProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState('choose') // choose, existing, new, submitted
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [myClaims, setMyClaims] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // New profile form
  const [form, setForm] = useState({
    official_name: '',
    fec_candidate_id: '',
    office_sought: '',
    state: '',
    party: '',
    campaign_url: '',
  })

  useEffect(() => {
    if (!user) return
    api.get('/candidate-claims/mine', true).then(data => {
      setMyClaims(data.claims || [])
    }).catch(() => {})
  }, [user])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const data = await api.get(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchResults(data.candidates || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  async function submitClaim(claimType) {
    setSubmitting(true)
    setError(null)
    try {
      const body = claimType === 'existing'
        ? { claim_type: 'existing', candidate_profile_id: selectedProfile.id }
        : { claim_type: 'new', ...form }

      await api.post('/candidate-claims', body, true)
      setStep('submitted')
      // Refresh claims
      const data = await api.get('/candidate-claims/mine', true)
      setMyClaims(data.claims || [])
    } catch (err) {
      setError(err.message || 'Failed to submit claim')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <UserCheck size={48} color="#1e293b" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: '16px 0 8px' }}>Claim Your Profile</h1>
          <p style={{ color: '#475569', marginBottom: 24 }}>Sign in to claim and manage your candidate profile on WhosRunningUSA.</p>
          <Link to="/login" style={{ display: 'inline-block', padding: '12px 32px', background: '#1e293b', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
          <p style={{ fontSize: 14, color: '#475569', marginTop: 12 }}>
            Don't have an account? <Link to="/register" style={{ color: '#1e293b', fontWeight: 600 }}>Register here</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 6vw, 64px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <UserCheck size={32} /> Candidate Self-Registration
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: '#94a3b8', margin: 0, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          Claim your existing profile or register as a new candidate. Update your positions, respond to voters, and control your narrative.
        </p>
      </section>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Existing claims */}
        {myClaims.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Your Claims</h2>
            {myClaims.map(c => {
              const cfg = STATUS_CONFIG[c.verification_status] || STATUS_CONFIG.pending
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: cfg.color }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.profile_name || c.official_name || 'New Profile'}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      Submitted {new Date(c.submitted_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Step: Choose */}
        {step === 'choose' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <button
              onClick={() => setStep('existing')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontSize: 16, fontWeight: 600, color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div>
                <div>Claim Existing Profile</div>
                <div style={{ fontSize: 14, fontWeight: 400, color: '#475569', marginTop: 4 }}>Find and claim a profile already on WhosRunningUSA</div>
              </div>
              <Search size={24} color="#475569" />
            </button>
            <button
              onClick={() => setStep('new')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontSize: 16, fontWeight: 600, color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div>
                <div>Register as New Candidate</div>
                <div style={{ fontSize: 14, fontWeight: 400, color: '#475569', marginTop: 4 }}>Create a new candidate profile from scratch</div>
              </div>
              <UserCheck size={24} color="#475569" />
            </button>
          </div>
        )}

        {/* Step: Search existing */}
        {step === 'existing' && !selectedProfile && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <button onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#475569', marginBottom: 16 }}>
              &larr; Back
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Find Your Profile</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name..."
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <button onClick={handleSearch} disabled={searchLoading} style={{ padding: '10px 20px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div>
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedProfile(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', textAlign: 'left', marginBottom: 8 }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                      {(c.display_name || c.name || '?')[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.display_name || c.name}</div>
                      {c.race_name && <div style={{ fontSize: 13, color: '#475569' }}>{c.race_name}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchResults.length === 0 && searchQuery && !searchLoading && (
              <p style={{ color: '#475569', fontSize: 14 }}>
                No profiles found. <button onClick={() => setStep('new')} style={{ background: 'none', border: 'none', color: '#1e293b', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Register as new candidate</button>
              </p>
            )}
          </div>
        )}

        {/* Confirm existing profile claim */}
        {step === 'existing' && selectedProfile && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <button onClick={() => setSelectedProfile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#475569', marginBottom: 16 }}>
              &larr; Back to search
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Confirm Your Claim</h2>
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{selectedProfile.display_name || selectedProfile.name}</div>
              {selectedProfile.race_name && <div style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>{selectedProfile.race_name}</div>}
            </div>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
              By claiming this profile, you're stating that you are this candidate or their authorized representative.
              Our team will verify your identity before granting access.
            </p>
            {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{error}</div>}
            <button
              onClick={() => submitClaim('existing')}
              disabled={submitting}
              style={{ padding: '12px 28px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
            >
              {submitting ? 'Submitting...' : 'Submit Claim'}
            </button>
          </div>
        )}

        {/* Step: New profile */}
        {step === 'new' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <button onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#475569', marginBottom: 16 }}>
              &larr; Back
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Register as New Candidate</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Full Name *</label>
                <input type="text" value={form.official_name} onChange={e => setForm({ ...form, official_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>FEC Candidate ID (optional)</label>
                <input type="text" value={form.fec_candidate_id} onChange={e => setForm({ ...form, fec_candidate_id: e.target.value })} placeholder="e.g. H8CA52155"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Office Sought</label>
                <input type="text" value={form.office_sought} onChange={e => setForm({ ...form, office_sought: e.target.value })} placeholder="e.g. U.S. House, District 12"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>State</label>
                  <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Party</label>
                  <select value={form.party} onChange={e => setForm({ ...form, party: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
                    <option value="">Select party</option>
                    <option value="Democrat">Democrat</option>
                    <option value="Republican">Republican</option>
                    <option value="Independent">Independent</option>
                    <option value="Libertarian">Libertarian</option>
                    <option value="Green">Green</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Campaign Website (optional)</label>
                <input type="url" value={form.campaign_url} onChange={e => setForm({ ...form, campaign_url: e.target.value })} placeholder="https://..."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 14 }}>{error}</div>}

              <button
                onClick={() => submitClaim('new')}
                disabled={submitting || !form.official_name.trim()}
                style={{ padding: '12px 28px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', opacity: !form.official_name.trim() ? 0.5 : 1 }}
              >
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitted */}
        {step === 'submitted' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 40, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <CheckCircle size={48} color="#16a34a" />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '16px 0 8px' }}>Claim Submitted!</h2>
            <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 24 }}>
              Our team will review your claim and verify your identity. You'll receive a notification once your claim is processed.
              This usually takes 1-2 business days.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link to="/" style={{ padding: '10px 24px', background: '#1e293b', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
                Back to Home
              </Link>
              <button onClick={() => setStep('choose')} style={{ padding: '10px 24px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
                Submit Another Claim
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClaimProfilePage
