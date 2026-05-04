import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Filter, ChevronLeft, ChevronRight, DollarSign, Clock, BarChart3 } from 'lucide-react'
import api from '../utils/api'
import DataSyncingBanner from '../components/DataSyncingBanner'

const FLAG_LABELS = {
  timing_suspicious: 'Suspicious Timing',
  committee_relevant: 'Committee Relevant',
  volume_unusual: 'Unusual Volume',
  pre_announcement: 'Pre-Announcement',
  late_disclosure: 'Late Disclosure',
  pattern_detected: 'Pattern Detected',
}

const FLAG_COLORS = {
  timing_suspicious: '#dc2626',
  committee_relevant: '#ca8a04',
  volume_unusual: '#ea580c',
  pre_announcement: '#dc2626',
  late_disclosure: '#7c3aed',
  pattern_detected: '#2563eb',
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

function TradingMonitorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [tab, setTab] = useState(searchParams.get('tab') || 'all')

  const sort = searchParams.get('sort') || 'date'
  const ticker = searchParams.get('ticker') || ''
  const flagged_only = searchParams.get('flagged_only') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (ticker) params.set('ticker', ticker)

      let endpoint = '/trades'
      if (tab === 'flagged') endpoint = '/trades/flagged'
      else if (flagged_only === 'true') params.set('flagged_only', 'true')

      const [tradeData, statsData] = await Promise.all([
        api.get(`${endpoint}?${params.toString()}`),
        api.get('/trades/stats'),
      ])
      setTrades(tradeData.trades || [])
      setTotal(tradeData.total || 0)
      setTotalPages(tradeData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load trades')
    } finally {
      setLoading(false)
    }
  }, [page, sort, ticker, tab, flagged_only])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  function switchTab(newTab) {
    setTab(newTab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', newTab)
    next.set('page', '1')
    setSearchParams(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <BarChart3 size={36} /> Trading Activity Monitor
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Tracking stock trades by government officials. Flagging unusual activity connected to committee assignments and legislation.
        </p>
      </section>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {!loading && !error && total === 0 && (
          <DataSyncingBanner feature="official trading activity" />
        )}

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Trades', value: stats.total_trades, icon: <TrendingUp size={18} /> },
              { label: 'Officials', value: stats.total_politicians, icon: <DollarSign size={18} /> },
              { label: 'Unique Tickers', value: stats.unique_tickers, icon: <BarChart3 size={18} /> },
              { label: 'Flags Raised', value: stats.total_flags, icon: <AlertTriangle size={18} /> },
              { label: 'Suspicious Timing', value: stats.suspicious_timing, icon: <Clock size={18} color="#dc2626" /> },
              { label: 'Late Disclosures', value: stats.late_disclosures, icon: <Clock size={18} color="#7c3aed" /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{(s.value || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
          {[
            { key: 'all', label: 'All Trades' },
            { key: 'flagged', label: 'Flagged Only' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              style={{
                padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 14, color: tab === t.key ? '#1e293b' : '#475569',
                borderBottom: tab === t.key ? '2px solid #1e293b' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search ticker (e.g. AAPL)..."
            value={ticker}
            onChange={e => updateFilter('ticker', e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 180 }}
          />
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="date">Most Recent</option>
            <option value="amount">Largest Amount</option>
            <option value="disclosure_delay">Longest Disclosure Delay</option>
            <option value="flags">Most Flags</option>
          </select>
        </div>

        {/* Loading/Error/Empty */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading trades...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {!loading && !error && trades.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <BarChart3 size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No trades found.</p>
          </div>
        )}

        {/* Trades table */}
        {!loading && !error && trades.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>{total.toLocaleString()} trade{total !== 1 ? 's' : ''}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Official</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Ticker</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Type</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Amount</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Trade Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Disclosure Delay</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <Link to={`/candidate/${t.politician_id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {t.profile_photo_url ? (
                            <img src={t.profile_photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>
                              {(t.display_name || '?')[0]}
                            </div>
                          )}
                          <div>
                            <div>{t.display_name}</div>
                            <div style={{ fontSize: 11, color: '#475569', fontWeight: 400 }}>{[t.party_affiliation, t.fec_state].filter(Boolean).join(' · ')}</div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>
                        {t.ticker || '—'}
                        {t.asset_name && t.asset_name !== t.ticker && (
                          <div style={{ fontSize: 11, color: '#475569', fontWeight: 400, fontFamily: 'inherit', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.asset_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: t.trade_type === 'purchase' ? '#f0fdf4' : t.trade_type === 'sale' ? '#fef2f2' : '#f1f5f9',
                          color: t.trade_type === 'purchase' ? '#16a34a' : t.trade_type === 'sale' ? '#dc2626' : '#475569',
                          textTransform: 'capitalize',
                        }}>
                          {t.trade_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {formatAmount(t.amount_range_low, t.amount_range_high)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {t.trade_date ? new Date(t.trade_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {t.days_to_disclose != null ? (
                          <span style={{
                            fontWeight: 600,
                            color: t.days_to_disclose > 45 ? '#dc2626' : t.days_to_disclose > 30 ? '#ca8a04' : '#16a34a',
                          }}>
                            {t.days_to_disclose}d
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {t.flags && t.flags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {t.flags.slice(0, 3).map((f, i) => (
                              <span key={i} style={{
                                padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                                background: `${FLAG_COLORS[f.flag_type] || '#475569'}15`,
                                color: FLAG_COLORS[f.flag_type] || '#475569',
                                whiteSpace: 'nowrap',
                              }}>
                                {FLAG_LABELS[f.flag_type] || f.flag_type}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

        {/* Top traders */}
        {stats && stats.top_traders && stats.top_traders.length > 0 && (
          <div style={{ marginTop: 32, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Most Active Traders</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {stats.top_traders.map(t => (
                <Link key={t.politician_id} to={`/candidate/${t.politician_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid #f1f5f9', borderRadius: 10 }}>
                  {t.profile_photo_url ? (
                    <img src={t.profile_photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569' }}>
                      {(t.display_name || '?')[0]}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{t.display_name}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{t.trade_count} trades · {t.flag_count} flags</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TradingMonitorPage
