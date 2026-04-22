import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, CheckCircle, XCircle, AlertCircle, Filter, ChevronLeft, ChevronRight, Shield } from 'lucide-react'
import api from '../utils/api'

const REQUIREMENT_TYPES = [
  { value: 'body_camera', label: 'Body Camera' },
  { value: 'foia_response', label: 'FOIA Response' },
  { value: 'meeting_recording', label: 'Meeting Recording' },
  { value: 'financial_disclosure', label: 'Financial Disclosure' },
  { value: 'lobbying_disclosure', label: 'Lobbying Disclosure' },
  { value: 'campaign_finance', label: 'Campaign Finance' },
]

const STATUS_CONFIG = {
  compliant: { color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle size={14} />, label: 'Compliant' },
  partial: { color: '#ca8a04', bg: '#fefce8', icon: <AlertCircle size={14} />, label: 'Partial' },
  non_compliant: { color: '#dc2626', bg: '#fef2f2', icon: <XCircle size={14} />, label: 'Non-Compliant' },
  unknown: { color: '#475569', bg: '#f1f5f9', icon: <AlertCircle size={14} />, label: 'Unknown' },
  exempt: { color: '#7c3aed', bg: '#faf5ff', icon: <Shield size={14} />, label: 'Exempt' },
}

function ComplianceBar({ compliant, partial, non_compliant, total }) {
  if (!total) return null
  const c = (compliant / total) * 100
  const p = (partial / total) * 100
  const n = (non_compliant / total) * 100
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#e2e8f0', width: '100%' }}>
      {c > 0 && <div style={{ width: `${c}%`, background: '#16a34a' }} />}
      {p > 0 && <div style={{ width: `${p}%`, background: '#ca8a04' }} />}
      {n > 0 && <div style={{ width: `${n}%`, background: '#dc2626' }} />}
    </div>
  )
}

function TransparencyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [politicians, setPoliticians] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const sort = searchParams.get('sort') || 'score'
  const state = searchParams.get('state') || ''
  const requirement_type = searchParams.get('type') || ''
  const compliance_status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (state) params.set('state', state)
      if (requirement_type) params.set('requirement_type', requirement_type)
      if (compliance_status) params.set('compliance_status', compliance_status)

      const [listData, statsData] = await Promise.all([
        api.get(`/transparency?${params.toString()}`),
        api.get('/transparency/stats'),
      ])
      setPoliticians(listData.politicians || [])
      setTotal(listData.total || 0)
      setTotalPages(listData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [page, sort, state, requirement_type, compliance_status])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Eye size={36} /> Transparency Compliance
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Which officials comply with body camera requirements, financial disclosure rules, and recording mandates?
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Requirements Tracked', value: stats.total_requirements },
              { label: 'Officials Tracked', value: stats.total_politicians_tracked },
              { label: 'Avg Compliance Score', value: `${stats.avg_compliance_score || 0}%` },
              { label: 'Compliant Records', value: stats.compliant_total },
              { label: 'Non-Compliant', value: stats.non_compliant_total },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Compliance by type */}
        {stats && stats.by_type && stats.by_type.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>Compliance by Category</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {stats.by_type.map(t => {
                const typeLabel = REQUIREMENT_TYPES.find(r => r.value === t.requirement_type)?.label || t.requirement_type
                const score = Number(t.avg_score)
                const hasData = Number.isFinite(score) && score > 0
                return (
                  <div key={t.requirement_type} style={{ padding: 12, border: '1px solid #f1f5f9', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{typeLabel}</div>
                    {hasData ? (
                      <div style={{ fontSize: 22, fontWeight: 800, color: score >= 70 ? '#16a34a' : score >= 40 ? '#ca8a04' : '#dc2626' }}>
                        {Math.round(score)}%
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', padding: '4px 0' }}>
                        Not yet tracked
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      {t.requirement_count} requirements{hasData ? ` · ${t.non_compliant} non-compliant` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
            <Filter size={16} /> Filters
          </span>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={requirement_type} onChange={e => updateFilter('type', e.target.value)}>
            <option value="">All Types</option>
            {REQUIREMENT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={compliance_status} onChange={e => updateFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            <option value="compliant">Compliant</option>
            <option value="partial">Partial</option>
            <option value="non_compliant">Non-Compliant</option>
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="score">Lowest Score First</option>
            <option value="score_desc">Highest Score First</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Loading/Error/Empty */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading compliance data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {!loading && !error && politicians.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <Eye size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No compliance data found.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && politicians.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} official{total !== 1 ? 's' : ''} tracked</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {politicians.map(pol => (
                <div key={pol.politician_id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 'clamp(16px, 3vw, 24px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    {pol.profile_photo_url ? (
                      <img src={pol.profile_photo_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569', fontSize: 16, flexShrink: 0 }}>
                        {(pol.display_name || '?')[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <Link to={`/candidate/${pol.politician_id}`} style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', textDecoration: 'none' }}>
                        {pol.display_name}
                      </Link>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                        {[pol.party_affiliation, pol.fec_state, pol.official_title].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 28, fontWeight: 800,
                        color: pol.avg_score >= 70 ? '#16a34a' : pol.avg_score >= 40 ? '#ca8a04' : '#dc2626',
                      }}>
                        {Math.round(pol.avg_score || 0)}%
                      </div>
                      <div style={{ fontSize: 11, color: '#475569' }}>compliance score</div>
                    </div>
                  </div>

                  <ComplianceBar
                    compliant={pol.compliant_count}
                    partial={pol.partial_count}
                    non_compliant={pol.non_compliant_count}
                    total={pol.total_requirements}
                  />

                  <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontSize: 12 }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{pol.compliant_count} compliant</span>
                    <span style={{ color: '#ca8a04', fontWeight: 600 }}>{pol.partial_count} partial</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{pol.non_compliant_count} non-compliant</span>
                    <span style={{ color: '#475569' }}>{pol.total_requirements} total requirements</span>
                  </div>

                  {/* Requirement breakdown */}
                  {pol.requirements && pol.requirements.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {pol.requirements.slice(0, 6).map((r, i) => {
                        const cfg = STATUS_CONFIG[r.compliance_status] || STATUS_CONFIG.unknown
                        return (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 6, fontSize: 12,
                            background: cfg.bg, color: cfg.color, fontWeight: 500,
                          }}>
                            {cfg.icon}
                            {REQUIREMENT_TYPES.find(rt => rt.value === r.requirement_type)?.label || r.requirement_type}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, paddingBottom: 32 }}>
                <button disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => updateFilter('page', String(page + 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
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

export default TransparencyPage
