import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Vote, ChevronLeft, ChevronRight, Filter, BarChart3, Users } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const PARTY_COLORS = {
  DEM: { bg: '#eff6ff', color: '#2563eb', label: 'DEM' },
  REP: { bg: '#fef2f2', color: '#dc2626', label: 'REP' },
  IND: { bg: '#f5f3ff', color: '#7c3aed', label: 'IND' },
  LIB: { bg: '#fefce8', color: '#ca8a04', label: 'LIB' },
  GRN: { bg: '#f0fdf4', color: '#16a34a', label: 'GRN' },
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const CYCLES = ['2026', '2024', '2022', '2020']

function loyaltyBarColor(pct) {
  if (pct >= 90) return '#2563eb'
  if (pct >= 70) return '#6366f1'
  return '#16a34a'
}

function donorBarColor(pct) {
  if (pct >= 80) return '#dc2626'
  if (pct >= 50) return '#ea580c'
  return '#ca8a04'
}

function RubberStampPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [politicians, setPoliticians] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const party = searchParams.get('party') || ''
  const chamber = searchParams.get('chamber') || ''
  const state = searchParams.get('state') || ''
  const cycle = searchParams.get('cycle') || '2024'
  const sort = searchParams.get('sort') || 'party_loyalty'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      params.set('cycle', cycle)
      if (party) params.set('party', party)
      if (chamber) params.set('chamber', chamber)
      if (state) params.set('state', state)

      const [listData, statsData] = await Promise.all([
        api.get(`/rubber-stamp?${params.toString()}`),
        api.get(`/rubber-stamp/stats?cycle=${cycle}`),
      ])
      setPoliticians(listData.politicians || [])
      setTotal(listData.total || 0)
      setTotalPages(listData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load rubber stamp data')
    } finally {
      setLoading(false)
    }
  }, [page, sort, party, chamber, state, cycle])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  const selectStyle = { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Vote size={36} /> The Rubber Stamp Score
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Are they a representative or a rubber stamp? Party loyalty vs donor alignment — two numbers that tell the whole story.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Politicians Scored', value: stats.total_scored, icon: <Users size={20} /> },
              { label: 'Avg Party Loyalty', value: `${stats.avg_party_loyalty || 0}%`, icon: <BarChart3 size={20} /> },
              { label: 'Avg Donor Alignment', value: `${stats.avg_donor_alignment || 0}%`, icon: <BarChart3 size={20} color="#dc2626" /> },
              { label: 'Rubber Stamps (>80/80)', value: stats.rubber_stamp_count || 0, icon: <Vote size={20} color="#dc2626" /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
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
          <select style={selectStyle} value={party} onChange={e => updateFilter('party', e.target.value)}>
            <option value="">All Parties</option>
            <option value="DEM">Democrat</option>
            <option value="REP">Republican</option>
            <option value="IND">Independent</option>
          </select>
          <select style={selectStyle} value={chamber} onChange={e => updateFilter('chamber', e.target.value)}>
            <option value="">All Chambers</option>
            <option value="senate">Senate</option>
            <option value="house">House</option>
            <option value="state">State</option>
          </select>
          <select style={selectStyle} value={state} onChange={e => updateFilter('state', e.target.value)}>
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={selectStyle} value={cycle} onChange={e => updateFilter('cycle', e.target.value)}>
            {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={selectStyle} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="party_loyalty">Party Loyalty</option>
            <option value="donor_alignment">Donor Alignment</option>
            <option value="most_independent">Most Independent</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading rubber stamp scores...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && politicians.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569', maxWidth: 520, margin: '0 auto' }}>
            <Vote size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12, fontWeight: 600 }}>No rubber stamp scores yet for this cycle.</p>
            <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
              Scores compare a member's party-line voting rate against their donor alignment. They populate as voting records sync in.
            </p>
            <Link to="/explore" style={{ display: 'inline-block', marginTop: 16, color: '#9f1239', fontWeight: 600 }}>
              Browse candidates instead →
            </Link>
          </div>
        )}

        {/* Results */}
        {!loading && !error && politicians.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} politician{total !== 1 ? 's' : ''} scored</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {politicians.map(pol => {
                const partyInfo = PARTY_COLORS[pol.party] || { bg: '#f1f5f9', color: '#475569', label: pol.party || '?' }
                const isRubberStamp = (pol.party_loyalty_pct || 0) > 80 && (pol.donor_alignment_pct || 0) > 80
                return (
                  <div key={pol.politician_id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', border: isRubberStamp ? '2px solid #dc2626' : '1px solid transparent' }}>
                    <div style={{ padding: '20px 24px' }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        <Link to={`/candidate/${pol.politician_id}`} style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', textDecoration: 'none' }}>
                          {pol.display_name}
                        </Link>
                        <span style={{ background: partyInfo.bg, color: partyInfo.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                          {partyInfo.label}
                        </span>
                        <span style={{ fontSize: 13, color: '#475569' }}>{[pol.state, pol.office].filter(Boolean).join(' · ')}</span>
                        {isRubberStamp && (
                          <span style={{ background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, marginLeft: 'auto' }}>
                            RUBBER STAMP
                          </span>
                        )}
                      </div>

                      {/* Two big numbers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                        {/* Party Loyalty */}
                        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Party Loyalty</div>
                          <SourceCitation
                            value={<span style={{ fontSize: 32, fontWeight: 800, color: loyaltyBarColor(pol.party_loyalty_pct || 0) }}>{pol.party_loyalty_pct || 0}%</span>}
                            sourceUrl={pol.loyalty_source_url}
                            sourceLabel={pol.loyalty_source_label || 'Voting record'}
                          />
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pol.party_loyalty_pct || 0}%`, background: loyaltyBarColor(pol.party_loyalty_pct || 0), borderRadius: 4, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                        {/* Donor Alignment */}
                        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Donor Alignment</div>
                          <SourceCitation
                            value={<span style={{ fontSize: 32, fontWeight: 800, color: donorBarColor(pol.donor_alignment_pct || 0) }}>{pol.donor_alignment_pct || 0}%</span>}
                            sourceUrl={pol.donor_source_url}
                            sourceLabel={pol.donor_source_label || 'Donor-vote analysis'}
                          />
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pol.donor_alignment_pct || 0}%`, background: donorBarColor(pol.donor_alignment_pct || 0), borderRadius: 4, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      </div>

                      {/* Stats line */}
                      <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>{pol.total_votes || 0} total votes</span>
                        <span>{pol.votes_with_party || 0} with party</span>
                        <span>{pol.votes_with_donors || 0} with donors</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{pol.independent_votes || 0} independent</span>
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

export default RubberStampPage
