import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Users, CheckCircle, Clock, TrendingUp, Filter, Search, ChevronLeft, ChevronRight, Share2, Plus } from 'lucide-react'
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

function ProgressBar({ current, required, height = 8 }) {
  const pct = Math.min(100, (current / Math.max(required, 1)) * 100)
  const color = pct >= 100 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#ca8a04'
  return (
    <div style={{ background: '#e2e8f0', borderRadius: height / 2, height, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, background: color, borderRadius: height / 2, transition: 'width 0.5s ease' }} />
    </div>
  )
}

function PetitionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [petitions, setPetitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [signing, setSigning] = useState(null)

  const sort = searchParams.get('sort') || 'newest'
  const state = searchParams.get('state') || ''
  const target_type = searchParams.get('target_type') || ''
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchPetitions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (state) params.set('state', state)
      if (target_type) params.set('target_type', target_type)
      if (q) params.set('q', q)
      const data = await api.get(`/petitions?${params.toString()}`)
      setPetitions(data.petitions || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || 'Failed to load petitions')
    } finally {
      setLoading(false)
    }
  }, [page, sort, state, target_type, q])

  useEffect(() => { fetchPetitions() }, [fetchPetitions])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  async function handleSign(petitionId) {
    if (!user) return alert('Please sign in to sign petitions')
    setSigning(petitionId)
    try {
      const petition = petitions.find(p => p.id === petitionId)
      if (petition.user_signed) {
        await api.delete(`/petitions/${petitionId}/sign`, true)
        setPetitions(prev => prev.map(p => p.id === petitionId
          ? { ...p, user_signed: false, current_signatures: p.current_signatures - 1, progress_pct: ((p.current_signatures - 1) / p.required_signatures) * 100 }
          : p))
      } else {
        await api.post(`/petitions/${petitionId}/sign`, {}, true)
        setPetitions(prev => prev.map(p => p.id === petitionId
          ? { ...p, user_signed: true, current_signatures: p.current_signatures + 1, progress_pct: ((p.current_signatures + 1) / p.required_signatures) * 100 }
          : p))
      }
    } catch (err) {
      alert(err.message || 'Failed to sign petition')
    } finally {
      setSigning(null)
    }
  }

  function handleShare(petition) {
    const url = `${window.location.origin}/petitions?highlight=${petition.id}`
    const text = `Sign this petition: "${petition.title}" — ${petition.current_signatures.toLocaleString()} signatures so far`
    if (navigator.share) {
      navigator.share({ title: petition.title, text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => {})
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <FileText size={36} /> Petitions
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Digital signature collection with real-time progress tracking. Your voice, verified and counted.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
            <Filter size={16} /> Filters
          </span>

          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search petitions..."
              value={q}
              onChange={e => updateFilter('q', e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569', minWidth: 130 }} value={state} onChange={e => updateFilter('state', e.target.value)}>
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569', minWidth: 130 }} value={target_type} onChange={e => updateFilter('target_type', e.target.value)}>
            <option value="">All Types</option>
            <option value="federal">Federal</option>
            <option value="state">State</option>
            <option value="local">Local</option>
            <option value="agency">Agency</option>
            <option value="general">General</option>
          </select>

          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569', minWidth: 130 }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="newest">Newest</option>
            <option value="signatures">Most Signatures</option>
            <option value="trending">Trending</option>
            <option value="deadline">Deadline Soon</option>
          </select>

          {user && (
            <Link to="/petitions/create" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e293b', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <Plus size={16} /> Start Petition
            </Link>
          )}
        </div>

        {/* Loading / Error / Empty */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading petitions...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center', fontWeight: 500 }}>{error}</div>
        )}

        {!loading && !error && petitions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569', maxWidth: 520, margin: '0 auto' }}>
            <FileText size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12, fontWeight: 600 }}>No petitions yet.</p>
            <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
              Petitions are created by voters to demand action from elected officials. Be the first — or browse ongoing accountability work.
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && petitions.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>
              {total.toLocaleString()} petition{total !== 1 ? 's' : ''} found
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {petitions.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div style={{ padding: 'clamp(16px, 3vw, 24px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: 'clamp(1rem, 2vw, 1.15rem)', fontWeight: 700, color: '#1e293b' }}>
                          {p.title}
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#475569' }}>
                          {p.target_type && (
                            <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 999, fontWeight: 600, textTransform: 'capitalize' }}>
                              {p.target_type}
                            </span>
                          )}
                          {p.state && <span>{p.state}</span>}
                          {p.target_entity && <span>To: {p.target_entity}</span>}
                          {p.target_politician_name && <span>To: {p.target_politician_name}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => handleShare(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#475569', display: 'flex' }} title="Share">
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>

                    {p.plain_language_summary && (
                      <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 16px', lineHeight: 1.5 }}>
                        {p.plain_language_summary.length > 200 ? p.plain_language_summary.slice(0, 200) + '...' : p.plain_language_summary}
                      </p>
                    )}
                    {!p.plain_language_summary && p.description && (
                      <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 16px', lineHeight: 1.5 }}>
                        {p.description.length > 200 ? p.description.slice(0, 200) + '...' : p.description}
                      </p>
                    )}

                    {/* Progress */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>
                          {p.current_signatures.toLocaleString()} signatures
                        </span>
                        <span>{p.required_signatures.toLocaleString()} needed</span>
                      </div>
                      <ProgressBar current={p.current_signatures} required={p.required_signatures} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        <span>{Math.round(p.progress_pct)}% complete</span>
                        {p.deadline && <span><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} /> Deadline: {new Date(p.deadline).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleSign(p.id)}
                        disabled={signing === p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '10px 20px', borderRadius: 8, border: 'none',
                          fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          background: p.user_signed ? '#f1f5f9' : '#1e293b',
                          color: p.user_signed ? '#475569' : '#fff',
                        }}
                      >
                        <CheckCircle size={16} />
                        {p.user_signed ? 'Signed' : 'Sign This Petition'}
                      </button>
                      <Link
                        to={`/petitions/${p.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontWeight: 600, color: '#475569', textDecoration: 'none' }}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, paddingBottom: 32 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter('page', String(page + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PetitionsPage
