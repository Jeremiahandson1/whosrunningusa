import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, ChevronLeft, ChevronRight, Filter, DollarSign, Building2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const CATEGORIES = [
  { value: 'taxes', label: 'Taxes & Revenue' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'environment', label: 'Environment' },
  { value: 'labor', label: 'Labor & Employment' },
  { value: 'criminal_justice', label: 'Criminal Justice' },
  { value: 'elections', label: 'Elections & Voting' },
  { value: 'housing', label: 'Housing' },
  { value: 'cannabis', label: 'Cannabis' },
  { value: 'other', label: 'Other' },
]

function formatAmount(num) {
  if (num == null || isNaN(num)) return '$0'
  const abs = Math.abs(num)
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`
  return `$${abs.toLocaleString()}`
}

function MeasureCard({ measure }) {
  const [expanded, setExpanded] = useState(false)

  const forTotal = measure.funding_for_total || 0
  const againstTotal = measure.funding_against_total || 0
  const maxFunding = Math.max(forTotal, againstTotal, 1)
  const corporateFor = measure.corporate_funding_for || 0
  const corporateAgainst = measure.corporate_funding_against || 0
  const totalCorporate = corporateFor + corporateAgainst
  const yesPercent = measure.yes_percent != null ? measure.yes_percent : null
  const statusColor = measure.status === 'passed' ? '#16a34a' : measure.status === 'failed' ? '#dc2626' : '#ca8a04'

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{measure.measure_number || 'Measure'}</span>
              <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                {measure.state}
              </span>
              {measure.category && (
                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                  {measure.category}
                </span>
              )}
              {measure.status && (
                <span style={{ background: `${statusColor}15`, color: statusColor, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>
                  {measure.status}
                </span>
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#1e293b', lineHeight: 1.3 }}>{measure.title}</div>
            {measure.description && (
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{measure.description.slice(0, 200)}{measure.description.length > 200 ? '...' : ''}</div>
            )}
          </div>
        </div>

        {/* Vote result bar */}
        {yesPercent !== null && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: '#16a34a' }}>Yes: {yesPercent.toFixed(1)}%</span>
              <span style={{ color: '#dc2626' }}>No: {(100 - yesPercent).toFixed(1)}%</span>
            </div>
            <div style={{ height: 10, background: '#fecaca', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${yesPercent}%`, background: '#16a34a', borderRadius: 5, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}

        {/* Two-column funding */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          {/* For */}
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>For</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
              <SourceCitation
                value={formatAmount(forTotal)}
                sourceUrl={measure.funding_for_source_url}
                sourceLabel={measure.funding_for_source_label || 'Campaign finance data'}
              />
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>{measure.funders_for_count || 0} funder{(measure.funders_for_count || 0) !== 1 ? 's' : ''}</div>
            <div style={{ height: 6, background: '#bbf7d0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(forTotal / maxFunding) * 100}%`, background: '#16a34a', borderRadius: 3 }} />
            </div>
          </div>
          {/* Against */}
          <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Against</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>
              <SourceCitation
                value={formatAmount(againstTotal)}
                sourceUrl={measure.funding_against_source_url}
                sourceLabel={measure.funding_against_source_label || 'Campaign finance data'}
              />
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>{measure.funders_against_count || 0} funder{(measure.funders_against_count || 0) !== 1 ? 's' : ''}</div>
            <div style={{ height: 6, background: '#fecaca', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(againstTotal / maxFunding) * 100}%`, background: '#dc2626', borderRadius: 3 }} />
            </div>
          </div>
        </div>

        {/* Corporate callout */}
        {totalCorporate > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Building2 size={16} color="#ca8a04" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
              Corporate money: {formatAmount(totalCorporate)}
            </span>
            {corporateFor > 0 && <span style={{ fontSize: 12, color: '#16a34a' }}>({formatAmount(corporateFor)} for)</span>}
            {corporateAgainst > 0 && <span style={{ fontSize: 12, color: '#dc2626' }}>({formatAmount(corporateAgainst)} against)</span>}
          </div>
        )}

        {/* Expand toggle */}
        {(measure.funders_for || measure.funders_against) && (
          <button onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide' : 'Show'} funding breakdown
          </button>
        )}
      </div>

      {/* Expanded funding detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* For funders */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>For ({measure.funders_for?.length || 0} funders)</div>
              {(measure.funders_for || []).map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{f.name}</span>
                    {f.type && (
                      <span style={{ fontSize: 11, color: '#475569', background: f.type === 'corporate' ? '#fefce8' : '#f1f5f9', padding: '1px 6px', borderRadius: 999, marginLeft: 6 }}>
                        {f.type}
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>{formatAmount(f.amount)}</span>
                </div>
              ))}
              {(!measure.funders_for || measure.funders_for.length === 0) && (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>No funder data available</div>
              )}
            </div>
            {/* Against funders */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Against ({measure.funders_against?.length || 0} funders)</div>
              {(measure.funders_against || []).map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{f.name}</span>
                    {f.type && (
                      <span style={{ fontSize: 11, color: '#475569', background: f.type === 'corporate' ? '#fefce8' : '#f1f5f9', padding: '1px 6px', borderRadius: 999, marginLeft: 6 }}>
                        {f.type}
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, color: '#b91c1c', whiteSpace: 'nowrap' }}>{formatAmount(f.amount)}</span>
                </div>
              ))}
              {(!measure.funders_against || measure.funders_against.length === 0) && (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>No funder data available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BallotMeasuresPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [measures, setMeasures] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const stateFilter = searchParams.get('state') || ''
  const category = searchParams.get('category') || ''
  const status = searchParams.get('status') || ''
  const sort = searchParams.get('sort') || 'recent'
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (stateFilter) params.set('state', stateFilter)
      if (category) params.set('category', category)
      if (status) params.set('status', status)
      if (search) params.set('search', search)

      const [listData, statsData] = await Promise.all([
        api.get(`/ballot-measures?${params.toString()}`),
        api.get('/ballot-measures/stats'),
      ])
      setMeasures(listData.measures || [])
      setTotal(listData.total || 0)
      setTotalPages(listData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load ballot measures')
    } finally {
      setLoading(false)
    }
  }, [page, sort, stateFilter, category, status, search])

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
          <FileText size={36} /> Ballot Measure Tracker
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
          Who funded every ballot measure — for and against. Corporate money funding or fighting the measures that affect their bottom line.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Measures Tracked', value: stats.total_measures, icon: <FileText size={20} /> },
              { label: 'Total Funding', value: formatAmount(stats.total_funding), icon: <DollarSign size={20} /> },
              { label: 'Corporate Spending', value: formatAmount(stats.corporate_spending), icon: <Building2 size={20} color="#ca8a04" /> },
              { label: 'States', value: stats.states_count, icon: <FileText size={20} color="#2563eb" /> },
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search measures..."
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
              style={{ padding: '8px 12px 8px 30px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569', width: 180 }}
            />
          </div>
          <select style={selectStyle} value={stateFilter} onChange={e => updateFilter('state', e.target.value)}>
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={selectStyle} value={category} onChange={e => updateFilter('category', e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select style={selectStyle} value={status} onChange={e => updateFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select style={selectStyle} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="recent">Most Recent</option>
            <option value="funding">Most Funding</option>
            <option value="votes">Most Votes</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading ballot measures...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && measures.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <FileText size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No ballot measures found matching your filters.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && measures.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} measure{total !== 1 ? 's' : ''} found</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {measures.map(m => <MeasureCard key={m.id} measure={m} />)}
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

export default BallotMeasuresPage
