import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Filter, ChevronLeft, ChevronRight, Search, TrendingUp, Shield, Calendar, DollarSign } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'
import DataSyncingBanner from '../components/DataSyncingBanner'

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'date', label: 'Most Recent' },
  { value: 'amount', label: 'Largest Amount' },
]

const SEVERITY_STYLES = {
  critical: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', label: 'CRITICAL' },
  high: { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa', label: 'HIGH' },
  medium: { bg: '#fefce8', color: '#854d0e', border: '#fef08a', label: 'MEDIUM' },
  low: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', label: 'LOW' },
}

const PARTY_COLORS = {
  DEM: { bg: '#eff6ff', color: '#1d4ed8' },
  REP: { bg: '#fef2f2', color: '#b91c1c' },
  IND: { bg: '#f5f3ff', color: '#6d28d9' },
}

function PartyBadge({ party }) {
  const style = PARTY_COLORS[party] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
      {party || 'N/A'}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low
  return (
    <span style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.5px' }}>
      {style.label}
    </span>
  )
}

function formatAmount(low, high) {
  const fmt = (n) => {
    if (!n) return '?'
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
    return `$${n.toLocaleString()}`
  }
  if (low && high) return `${fmt(low)} – ${fmt(high)}`
  if (high) return `up to ${fmt(high)}`
  if (low) return `${fmt(low)}+`
  return 'Undisclosed'
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function ConflictsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [conflicts, setConflicts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const severity = searchParams.get('severity') || ''
  const sort = searchParams.get('sort') || 'severity'
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (severity) params.set('severity', severity)
      if (search) params.set('search', search)

      const [conflictData, statsData] = await Promise.all([
        api.get(`/conflicts?${params.toString()}`),
        api.get('/conflicts/stats'),
      ])
      setConflicts(conflictData.conflicts || [])
      setTotal(conflictData.total || 0)
      setTotalPages(conflictData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load conflict data')
    } finally {
      setLoading(false)
    }
  }, [page, sort, severity, search])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  // Debounced search
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) updateFilter('search', searchInput)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AlertTriangle size={36} /> Conflict of Interest Scanner
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 660, marginLeft: 'auto', marginRight: 'auto' }}>
          Every vote where the politician or their family held financial interests in the outcome. Trade data cross-referenced with voting records.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {!loading && !error && total === 0 && (
          <DataSyncingBanner feature="conflict-of-interest analysis" />
        )}

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Conflicts', value: stats.total_conflicts, icon: <AlertTriangle size={20} /> },
              { label: 'Critical', value: stats.critical_count, icon: <Shield size={20} color="#dc2626" /> },
              { label: 'High Severity', value: stats.high_count, icon: <AlertTriangle size={20} color="#ea580c" /> },
              { label: 'Officials Flagged', value: stats.officials_flagged, icon: <TrendingUp size={20} /> },
              { label: 'Total Trade Value', value: stats.total_trade_value ? formatAmount(stats.total_trade_value, null) : 'N/A', icon: <DollarSign size={20} color="#ca8a04" /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : (s.value || 0)}
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
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search politician, ticker, bill..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={severity} onChange={e => updateFilter('severity', e.target.value)}>
            {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Scanning for conflicts...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && conflicts.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <AlertTriangle size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No conflicts found.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && conflicts.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} conflict{total !== 1 ? 's' : ''} found</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {conflicts.map(conflict => {
                const sevStyle = SEVERITY_STYLES[conflict.severity] || SEVERITY_STYLES.low
                return (
                  <div
                    key={conflict.id}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      overflow: 'hidden',
                      borderLeft: `4px solid ${sevStyle.color}`,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Link
                            to={`/candidate/${conflict.politician_id}`}
                            style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', textDecoration: 'none' }}
                          >
                            {conflict.politician_name || conflict.display_name}
                          </Link>
                          <PartyBadge party={conflict.party_affiliation || conflict.party} />
                        </div>
                        {conflict.official_title && (
                          <div style={{ fontSize: 13, color: '#64748b' }}>{conflict.official_title}</div>
                        )}
                      </div>
                      <SeverityBadge severity={conflict.severity} />
                    </div>

                    {/* Description — the key line */}
                    <div style={{ padding: '0 20px 16px' }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', lineHeight: 1.5, margin: 0 }}>
                        {conflict.description}
                      </p>
                    </div>

                    {/* Details grid */}
                    <div style={{ padding: '0 20px 20px' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 12,
                        padding: 16,
                        background: '#f8fafc',
                        borderRadius: 10,
                      }}>
                        {conflict.ticker && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>TICKER</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{conflict.ticker}</div>
                          </div>
                        )}
                        {conflict.trade_type && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>TRADE TYPE</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: conflict.trade_type === 'buy' ? '#16a34a' : '#dc2626', textTransform: 'uppercase' }}>
                              {conflict.trade_type}
                            </div>
                          </div>
                        )}
                        {(conflict.amount_low || conflict.amount_high) && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>AMOUNT RANGE</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                              {formatAmount(conflict.amount_low, conflict.amount_high)}
                            </div>
                          </div>
                        )}
                        {conflict.trade_date && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>TRADE DATE</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={13} /> {formatDate(conflict.trade_date)}
                            </div>
                          </div>
                        )}
                        {conflict.vote_date && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>VOTE DATE</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={13} /> {formatDate(conflict.vote_date)}
                            </div>
                          </div>
                        )}
                        {conflict.time_gap_days != null && (
                          <div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>TIME GAP</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: conflict.time_gap_days <= 30 ? '#dc2626' : '#1e293b' }}>
                              {conflict.time_gap_days} day{conflict.time_gap_days !== 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Source links */}
                    {(conflict.source_url || conflict.trade_source_url || conflict.vote_source_url) && (
                      <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13 }}>
                        {conflict.source_url && (
                          <SourceCitation
                            value="Conflict source"
                            sourceUrl={conflict.source_url}
                            sourceLabel={conflict.source_label || 'Source'}
                            sourceDate={conflict.source_date}
                          />
                        )}
                        {conflict.trade_source_url && (
                          <SourceCitation
                            value="Trade disclosure"
                            sourceUrl={conflict.trade_source_url}
                            sourceLabel="Financial Disclosure"
                          />
                        )}
                        {conflict.vote_source_url && (
                          <SourceCitation
                            value="Vote record"
                            sourceUrl={conflict.vote_source_url}
                            sourceLabel="Congressional Record"
                          />
                        )}
                      </div>
                    )}
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

export default ConflictsPage
