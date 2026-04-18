import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { XCircle, CheckCircle, Shield, Filter, ChevronLeft, ChevronRight, DollarSign, HandCoins } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const STATUS_OPTIONS = [
  { value: '', label: 'All Pledges' },
  { value: 'active', label: 'Active' },
  { value: 'violated', label: 'Broken' },
  { value: 'kept', label: 'Kept' },
]

const PARTY_OPTIONS = [
  { value: '', label: 'All Parties' },
  { value: 'Democratic', label: 'Democrat' },
  { value: 'Republican', label: 'Republican' },
  { value: 'Independent', label: 'Independent' },
]

function formatMoney(n) {
  if (!n) return '$0'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${Number(n).toLocaleString()}`
}

function StatusBadge({ status }) {
  if (status === 'kept') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
        background: '#f0fdf4', color: '#16a34a',
      }}>
        <CheckCircle size={13} /> Pledge Kept
      </span>
    )
  }
  if (status === 'violated') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
        background: '#fef2f2', color: '#dc2626',
      }}>
        <XCircle size={13} /> Pledge Broken
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
      background: '#eff6ff', color: '#2563eb',
    }}>
      <Shield size={13} /> Active
    </span>
  )
}

function partyColor(party) {
  if (!party) return '#64748b'
  const p = party.toLowerCase()
  if (p.includes('democrat')) return '#2563eb'
  if (p.includes('republican')) return '#dc2626'
  return '#7c3aed'
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{
      flex: '1 1 160px', padding: 20, background: '#fff',
      borderRadius: 12, border: '1px solid #e2e8f0',
      textAlign: 'center',
    }}>
      <Icon size={24} style={{ color, marginBottom: 8 }} />
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function PacPledgePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pledges, setPledges] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const status = searchParams.get('status') || ''
  const party = searchParams.get('party') || ''
  const state = searchParams.get('state') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const updateParam = useCallback((key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      next.set('page', '1')
      return next
    })
  }, [setSearchParams])

  const setPage = useCallback((p) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
  }, [setSearchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (status) params.set('status', status)
    if (party) params.set('party', party)
    if (state) params.set('state', state)

    Promise.all([
      api.get(`/pac-pledge?${params}`),
      api.get('/pac-pledge/stats'),
    ])
      .then(([pledgeData, statsData]) => {
        if (cancelled) return
        setPledges(pledgeData.pledges || pledgeData.data || [])
        setTotal(pledgeData.total || 0)
        setTotalPages(pledgeData.total_pages || pledgeData.totalPages || 1)
        setStats(statsData)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, status, party, state])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', padding: '40px 20px', marginBottom: 32,
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
        borderRadius: 16, color: '#fff',
      }}>
        <HandCoins size={48} style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px' }}>Corporate PAC Pledge Tracker</h1>
        <p style={{ fontSize: 15, maxWidth: 600, margin: '0 auto', opacity: 0.9, lineHeight: 1.5 }}>
          Who pledged to reject corporate PAC money. Who kept the pledge. Who broke it.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatCard label="Total Pledged" value={stats.total_pledged ?? 0} color="#1e3a5f" icon={Shield} />
          <StatCard label="Pledge Kept" value={stats.kept ?? 0} color="#16a34a" icon={CheckCircle} />
          <StatCard
            label={`Broken${stats.total_violation_amount ? ` (${formatMoney(stats.total_violation_amount)})` : ''}`}
            value={stats.violated ?? 0}
            color="#dc2626"
            icon={XCircle}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24,
        alignItems: 'center',
      }}>
        <Filter size={16} style={{ color: '#64748b' }} />
        {STATUS_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => updateParam('status', o.value)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: '1px solid', cursor: 'pointer',
              background: status === o.value ? '#1e3a5f' : '#fff',
              color: status === o.value ? '#fff' : '#475569',
              borderColor: status === o.value ? '#1e3a5f' : '#cbd5e1',
            }}
          >
            {o.label}
          </button>
        ))}
        <select
          value={party}
          onChange={e => updateParam('party', e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
            fontSize: 13, background: '#fff', cursor: 'pointer',
          }}
        >
          {PARTY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="State (e.g. CA)"
          value={state}
          onChange={e => updateParam('state', e.target.value.toUpperCase().slice(0, 2))}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
            fontSize: 13, width: 100,
          }}
        />
      </div>

      {error && (
        <div style={{
          padding: 16, background: '#fef2f2', color: '#dc2626',
          borderRadius: 8, marginBottom: 20, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading pledges...</div>
      ) : pledges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>No pledges found.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pledges.map(p => (
              <div key={p.id} style={{
                padding: 18, background: '#fff', borderRadius: 12,
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Link to={`/candidate/${p.candidate_id}`} style={{
                    fontWeight: 700, fontSize: 16, color: '#0f172a', textDecoration: 'none',
                  }}>
                    {p.candidate_name || p.name || 'Unknown'}
                  </Link>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    background: partyColor(p.party) + '18', color: partyColor(p.party),
                  }}>
                    {p.party || 'Unknown'}
                  </span>
                  {p.state && (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{p.state}</span>
                  )}
                  <StatusBadge status={p.status} />
                </div>

                {p.pledge_date && (
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                    Pledged: {new Date(p.pledge_date).toLocaleDateString()}
                  </div>
                )}

                {p.pledge_text && (
                  <div style={{
                    fontSize: 13, color: '#475569', fontStyle: 'italic',
                    padding: '8px 12px', background: '#f8fafc', borderRadius: 6, marginBottom: 8,
                    borderLeft: '3px solid #cbd5e1',
                  }}>
                    "{p.pledge_text}"
                  </div>
                )}

                {p.status === 'violated' && (p.violation_amount || p.violation_details) && (
                  <div style={{
                    padding: '10px 14px', background: '#fef2f2', borderRadius: 8,
                    border: '1px solid #fecaca', marginTop: 8,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontWeight: 700, fontSize: 13, color: '#dc2626', marginBottom: 4,
                    }}>
                      <DollarSign size={14} />
                      Violation: {p.violation_amount ? formatMoney(p.violation_amount) : 'Amount undisclosed'}
                    </div>
                    {p.violation_details && (
                      <div style={{ fontSize: 12, color: '#991b1b' }}>{p.violation_details}</div>
                    )}
                  </div>
                )}

                {p.source_url && (
                  <div style={{ marginTop: 8 }}>
                    <SourceCitation
                      value="Source"
                      sourceUrl={p.source_url}
                      sourceLabel={p.source_label || 'Pledge record'}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 16, marginTop: 28,
            }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                  background: '#fff', cursor: page <= 1 ? 'default' : 'pointer',
                  opacity: page <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                  background: '#fff', cursor: page >= totalPages ? 'default' : 'pointer',
                  opacity: page >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
