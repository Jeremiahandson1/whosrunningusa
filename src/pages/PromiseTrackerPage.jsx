import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, Filter, ChevronLeft, ChevronRight, Award, XCircle, Clock, HelpCircle } from 'lucide-react'
import api from '../utils/api'

const PARTY_OPTIONS = [
  { value: '', label: 'All Parties' },
  { value: 'DEM', label: 'Democrat' },
  { value: 'REP', label: 'Republican' },
  { value: 'IND', label: 'Independent' },
]

const OFFICE_OPTIONS = [
  { value: '', label: 'All Offices' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'local', label: 'Local' },
]

const SORT_OPTIONS = [
  { value: 'score', label: 'Promise Score' },
  { value: 'most_kept', label: 'Most Kept' },
  { value: 'most_broken', label: 'Most Broken' },
]

const PARTY_COLORS = {
  DEM: { bg: '#eff6ff', color: '#1d4ed8' },
  REP: { bg: '#fef2f2', color: '#b91c1c' },
  IND: { bg: '#f5f3ff', color: '#6d28d9' },
}

function scoreColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#ca8a04'
  return '#dc2626'
}

function PartyBadge({ party }) {
  const style = PARTY_COLORS[party] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
      {party || 'N/A'}
    </span>
  )
}

function PromiseBar({ kept, broken, in_progress, pending }) {
  const total = (kept || 0) + (broken || 0) + (in_progress || 0) + (pending || 0)
  if (total === 0) return null
  const pct = (n) => ((n || 0) / total) * 100
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', width: '100%' }}>
      {kept > 0 && <div style={{ width: `${pct(kept)}%`, background: '#16a34a' }} title={`${kept} kept`} />}
      {in_progress > 0 && <div style={{ width: `${pct(in_progress)}%`, background: '#ca8a04' }} title={`${in_progress} in progress`} />}
      {broken > 0 && <div style={{ width: `${pct(broken)}%`, background: '#dc2626' }} title={`${broken} broken`} />}
      {pending > 0 && <div style={{ width: `${pct(pending)}%`, background: '#94a3b8' }} title={`${pending} pending`} />}
    </div>
  )
}

function PromiseTrackerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [politicians, setPoliticians] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const party = searchParams.get('party') || ''
  const office_level = searchParams.get('office_level') || ''
  const state = searchParams.get('state') || ''
  const sort = searchParams.get('sort') || 'score'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (party) params.set('party', party)
      if (office_level) params.set('office_level', office_level)
      if (state) params.set('state', state)

      const data = await api.get(`/promises/leaderboard?${params.toString()}`)
      setPoliticians(data.politicians || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)

      // Derive stats from first page if no separate stats endpoint
      if (data.stats) {
        setStats(data.stats)
      } else if (data.politicians && data.politicians.length > 0) {
        const all = data.politicians
        const totalKept = all.reduce((s, p) => s + (p.kept || 0), 0)
        const totalBroken = all.reduce((s, p) => s + (p.broken || 0), 0)
        const totalInProgress = all.reduce((s, p) => s + (p.in_progress || 0), 0)
        const totalPending = all.reduce((s, p) => s + (p.pending || 0), 0)
        const avgScore = all.length > 0
          ? Math.round(all.reduce((s, p) => s + (p.score || 0), 0) / all.length)
          : 0
        setStats({
          total_politicians: data.total || all.length,
          total_promises: totalKept + totalBroken + totalInProgress + totalPending,
          total_kept: totalKept,
          total_broken: totalBroken,
          avg_score: avgScore,
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to load promise tracker')
    } finally {
      setLoading(false)
    }
  }, [page, sort, party, office_level, state])

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
          <CheckCircle size={36} /> Promise Tracker
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Every campaign promise. Met, broken, in progress, expired. The score follows them forever.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Politicians Tracked', value: stats.total_politicians, icon: <Award size={20} /> },
              { label: 'Total Promises', value: stats.total_promises, icon: <CheckCircle size={20} /> },
              { label: 'Promises Kept', value: stats.total_kept, icon: <CheckCircle size={20} color="#16a34a" /> },
              { label: 'Promises Broken', value: stats.total_broken, icon: <XCircle size={20} color="#dc2626" /> },
              { label: 'Avg Score', value: stats.avg_score != null ? `${stats.avg_score}%` : 'N/A', icon: <Award size={20} color="#ca8a04" /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                </div>
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
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={party} onChange={e => updateFilter('party', e.target.value)}>
            {PARTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={office_level} onChange={e => updateFilter('office_level', e.target.value)}>
            {OFFICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="text"
            placeholder="State (e.g. CA)..."
            value={state}
            onChange={e => updateFilter('state', e.target.value.toUpperCase().slice(0, 2))}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 130 }}
          />
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading promise data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && politicians.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <CheckCircle size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No promise data found.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && politicians.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} politician{total !== 1 ? 's' : ''} found</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {politicians.map(pol => {
                const kept = pol.kept || 0
                const broken = pol.broken || 0
                const in_progress = pol.in_progress || 0
                const pending = pol.pending || 0
                const totalPromises = kept + broken + in_progress + pending
                const score = pol.score != null ? pol.score : (totalPromises > 0 ? Math.round((kept / totalPromises) * 100) : 0)

                return (
                  <div key={pol.politician_id || pol.candidate_id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', flexWrap: 'wrap' }}>
                      {/* Avatar / Name / Party */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <Link to={`/candidate/${pol.politician_id || pol.candidate_id}`} style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', textDecoration: 'none' }}>
                            {pol.display_name || pol.name}
                          </Link>
                          <PartyBadge party={pol.party_affiliation || pol.party} />
                          {pol.state && <span style={{ fontSize: 13, color: '#475569' }}>{pol.state}</span>}
                        </div>
                        {pol.official_title && (
                          <div style={{ fontSize: 13, color: '#64748b' }}>{pol.official_title}</div>
                        )}
                      </div>

                      {/* Score */}
                      <div style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>
                          {score}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>SCORE</div>
                      </div>
                    </div>

                    {/* Promise bar + stats */}
                    <div style={{ padding: '0 24px 20px' }}>
                      <PromiseBar kept={kept} broken={broken} in_progress={in_progress} pending={pending} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={14} color="#16a34a" />
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{kept} kept</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <XCircle size={14} color="#dc2626" />
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>{broken} broken</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={14} color="#ca8a04" />
                          <span style={{ color: '#ca8a04', fontWeight: 600 }}>{in_progress} in progress</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <HelpCircle size={14} color="#94a3b8" />
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{pending} pending</span>
                        </span>
                        <span style={{ color: '#64748b', marginLeft: 'auto' }}>
                          {totalPromises} total locked promise{totalPromises !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <Link
                          to={`/candidate/${pol.politician_id || pol.candidate_id}?tab=promises`}
                          style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                        >
                          View all promises &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
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

export default PromiseTrackerPage
