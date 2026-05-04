import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, AlertTriangle, Building2, Filter, ChevronLeft, ChevronRight, Share2, ArrowRightLeft } from 'lucide-react'
import api from '../utils/api'
import DataSyncingBanner from '../components/DataSyncingBanner'

const FLAG_TYPES = [
  { value: 'cooling_period_violation', label: 'Cooling Period Violation' },
  { value: 'industry_conflict', label: 'Industry Conflict' },
  { value: 'lobbying_restriction', label: 'Lobbying Restriction' },
  { value: 'committee_overlap', label: 'Committee Overlap' },
]

function SeverityBadge({ severity }) {
  const color = severity >= 7 ? '#dc2626' : severity >= 4 ? '#ca8a04' : '#16a34a'
  const bg = severity >= 7 ? '#fef2f2' : severity >= 4 ? '#fefce8' : '#f0fdf4'
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
      Severity {severity}/10
    </span>
  )
}

function RevolvingDoorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [politicians, setPoliticians] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const sort = searchParams.get('sort') || 'flags'
  const state = searchParams.get('state') || ''
  const flag_type = searchParams.get('flag_type') || ''
  const is_lobbying = searchParams.get('lobbying') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (state) params.set('state', state)
      if (flag_type) params.set('flag_type', flag_type)
      if (is_lobbying) params.set('is_lobbying', is_lobbying)

      const [listData, statsData] = await Promise.all([
        api.get(`/revolving-door?${params.toString()}`),
        api.get('/revolving-door/stats'),
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
  }, [page, sort, state, flag_type, is_lobbying])

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
          <ArrowRightLeft size={36} /> The Revolving Door
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Where do officials go after leaving office? Tracking the pipeline between government and industry.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {!loading && !error && total === 0 && (
          <DataSyncingBanner feature="revolving door tracking" />
        )}

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Officials Tracked', value: stats.total_politicians, icon: <Briefcase size={20} /> },
              { label: 'Employments', value: stats.total_employments, icon: <Building2 size={20} /> },
              { label: 'Lobbying Jobs', value: stats.lobbying_positions, icon: <ArrowRightLeft size={20} /> },
              { label: 'Flags Raised', value: stats.total_flags, icon: <AlertTriangle size={20} /> },
              { label: 'Cooling Violations', value: stats.cooling_violations, icon: <AlertTriangle size={20} color="#dc2626" /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{(s.value || 0).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
            <Filter size={16} /> Filters
          </span>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={flag_type} onChange={e => updateFilter('flag_type', e.target.value)}>
            <option value="">All Flag Types</option>
            {FLAG_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={is_lobbying} onChange={e => updateFilter('lobbying', e.target.value)}>
            <option value="">All Positions</option>
            <option value="true">Lobbying Only</option>
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="flags">Most Flags</option>
            <option value="severity">Highest Severity</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>

        {/* Loading/Error/Empty */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading revolving door data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {!loading && !error && politicians.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <ArrowRightLeft size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No revolving door data found.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && politicians.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} official{total !== 1 ? 's' : ''} found</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {politicians.map(pol => (
                <div key={pol.politician_id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                    {pol.profile_photo_url ? (
                      <img src={pol.profile_photo_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569', fontSize: 18, flexShrink: 0 }}>
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        {pol.employment_count} position{pol.employment_count !== 1 ? 's' : ''}
                      </span>
                      {pol.flag_count > 0 && (
                        <span style={{ background: '#fef2f2', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                          {pol.flag_count} flag{pol.flag_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {pol.has_lobbying && (
                        <span style={{ background: '#fefce8', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#ca8a04' }}>
                          Lobbying
                        </span>
                      )}
                      {pol.max_severity > 0 && <SeverityBadge severity={pol.max_severity} />}
                    </div>
                  </div>
                  {/* Employments list */}
                  {pol.employments && (
                    <div style={{ padding: '12px 24px' }}>
                      {pol.employments.slice(0, 3).map((emp, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < Math.min(pol.employments.length, 3) - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 14 }}>
                          <Building2 size={16} color="#475569" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{emp.employer}</span>
                            {emp.position_title && <span style={{ color: '#475569' }}> — {emp.position_title}</span>}
                          </div>
                          {emp.industry && <span style={{ fontSize: 12, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>{emp.industry}</span>}
                          {emp.is_lobbying && <span style={{ fontSize: 11, color: '#ca8a04', fontWeight: 700 }}>LOBBYING</span>}
                        </div>
                      ))}
                      {pol.employments.length > 3 && (
                        <div style={{ fontSize: 13, color: '#475569', padding: '8px 0', fontWeight: 500 }}>
                          +{pol.employments.length - 3} more position{pol.employments.length - 3 !== 1 ? 's' : ''}
                        </div>
                      )}
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

export default RevolvingDoorPage
