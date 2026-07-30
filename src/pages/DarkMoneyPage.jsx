import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EyeOff, ChevronLeft, ChevronRight, DollarSign, Users, AlertTriangle, Filter } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const PARTY_COLORS = {
  DEM: { bg: '#eff6ff', color: '#2563eb', label: 'DEM' },
  REP: { bg: '#fef2f2', color: '#dc2626', label: 'REP' },
  IND: { bg: '#f5f3ff', color: '#7c3aed', label: 'IND' },
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

function formatAmount(num) {
  if (num == null || isNaN(num)) return '$0'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toLocaleString()}`
}

function DarkMoneyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [candidates, setCandidates] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const party = searchParams.get('party') || ''
  const office = searchParams.get('office') || ''
  const state = searchParams.get('state') || ''
  const cycle = searchParams.get('cycle') || '2026'
  const sort = searchParams.get('sort') || 'unaccounted'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('cycle', cycle)
      params.set('sort', sort)
      if (party) params.set('party', party)
      if (office) params.set('office', office)
      if (state) params.set('state', state)

      const [listData, statsData] = await Promise.all([
        api.get(`/dark-money?${params.toString()}`),
        api.get('/dark-money/stats'),
      ])
      setCandidates(listData.candidates || [])
      setTotal(listData.total || 0)
      setTotalPages(listData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load dark money data')
    } finally {
      setLoading(false)
    }
  }, [page, party, office, state, cycle, sort])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  function getPartyStyle(p) {
    const match = PARTY_COLORS[p]
    if (match) return match
    return { bg: '#f1f5f9', color: '#475569', label: p || '—' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <EyeOff size={36} /> Dark Money Tracker
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
          Outside spending minus disclosed sources equals the dark money floor — what we can't trace. Every figure sourced to FEC filings.
        </p>
      </section>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Outside Spending', value: formatAmount(stats.total_outside_spending), icon: <DollarSign size={18} /> },
              { label: 'Total Unaccounted', value: formatAmount(stats.total_unaccounted), icon: <EyeOff size={18} color="#dc2626" /> },
              { label: 'Candidates Tracked', value: (stats.candidates_tracked || 0).toLocaleString(), icon: <Users size={18} /> },
              { label: 'Avg Dark Money %', value: `${stats.avg_dark_money_pct || 0}%`, icon: <AlertTriangle size={18} color="#ca8a04" /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{s.label}</div>
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
            <option value="">All Parties</option>
            <option value="DEM">Democrat</option>
            <option value="REP">Republican</option>
            <option value="IND">Independent</option>
            <option value="other">Other</option>
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={office} onChange={e => updateFilter('office', e.target.value)}>
            <option value="">All Offices</option>
            <option value="federal">Federal</option>
            <option value="state">State</option>
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={state} onChange={e => updateFilter('state', e.target.value)}>
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={cycle} onChange={e => updateFilter('cycle', e.target.value)}>
            {[2026, 2024, 2022, 2020].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="unaccounted">Unaccounted Amount</option>
            <option value="dark_pct">Dark Money %</option>
            <option value="total_outside">Total Outside Spending</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading dark money data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && candidates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <EyeOff size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No dark money data found matching your filters.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && candidates.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total.toLocaleString()} candidate{total !== 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {candidates.map(c => {
                const partyStyle = getPartyStyle(c.party)
                const disclosedPct = c.total_outside_spending > 0
                  ? ((c.disclosed_amount / c.total_outside_spending) * 100)
                  : 0
                const unaccountedPct = 100 - disclosedPct

                return (
                  <div key={c.candidate_id || c.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px' }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Link to={`/candidate/${c.candidate_id || c.id}`} style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', textDecoration: 'none' }}>
                                {c.display_name || c.name}
                              </Link>
                              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: partyStyle.bg, color: partyStyle.color }}>
                                {partyStyle.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                              {[c.state, c.office_level].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                        {c.dark_money_percentage != null && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>
                              {Number(c.dark_money_percentage).toFixed(1)}%
                            </div>
                            <div style={{ fontSize: 11, color: '#475569' }}>dark money</div>
                          </div>
                        )}
                      </div>

                      {/* Three numbers */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                            <SourceCitation
                              value={formatAmount(c.total_outside_spending)}
                              sourceUrl={c.fec_url}
                              sourceLabel="FEC Filing"
                              sourceDate={c.fec_date}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>Total Outside Spending</div>
                        </div>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#475569' }}>
                            <SourceCitation
                              value={formatAmount(c.disclosed_amount)}
                              sourceUrl={c.fec_url}
                              sourceLabel="FEC Filing"
                            />
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>Disclosed</div>
                        </div>
                        <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>
                            <SourceCitation
                              value={formatAmount(c.unaccounted_amount)}
                              sourceUrl={c.fec_url}
                              sourceLabel="FEC Filing"
                            />
                          </div>
                          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>Unaccounted</div>
                        </div>
                      </div>

                      {/* Percentage bar */}
                      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#e2e8f0', marginBottom: 12 }}>
                        {disclosedPct > 0 && (
                          <div
                            title={`Disclosed: ${disclosedPct.toFixed(1)}%`}
                            style={{ width: `${disclosedPct}%`, background: '#94a3b8', transition: 'width 0.3s' }}
                          />
                        )}
                        {unaccountedPct > 0 && (
                          <div
                            title={`Unaccounted: ${unaccountedPct.toFixed(1)}%`}
                            style={{ width: `${unaccountedPct}%`, background: '#dc2626', transition: 'width 0.3s' }}
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#475569', marginBottom: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                          Disclosed ({disclosedPct.toFixed(1)}%)
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                          Unaccounted ({unaccountedPct.toFixed(1)}%)
                        </span>
                      </div>

                      {/* C4 group badge */}
                      {c.c4_group_count > 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fefce8', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                          <AlertTriangle size={12} />
                          {c.c4_group_count} 501(c)(4) group{c.c4_group_count !== 1 ? 's' : ''} — zero donor disclosure
                        </div>
                      )}

                      {/* Floor estimate disclaimer */}
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: '#94a3b8', marginTop: 4 }}>
                        Floor estimate. Actual unaccounted spending is likely higher.
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

export default DarkMoneyPage
