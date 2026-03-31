import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Shield, Search, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Users, ArrowUpDown } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const CATEGORY_LABELS = {
  voter_id: 'Voter ID',
  early_voting: 'Early Voting',
  mail_voting: 'Mail Voting',
  registration: 'Registration',
}

function scoreColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#ca8a04'
  return '#dc2626'
}

function scoreBg(score) {
  if (score >= 75) return '#f0fdf4'
  if (score >= 50) return '#fefce8'
  return '#fef2f2'
}

function ScoreBadge({ score, label, small }) {
  const size = small ? 12 : 14
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '2px 6px' : '4px 10px',
      borderRadius: 6, fontSize: size, fontWeight: 600,
      color: scoreColor(score), background: scoreBg(score),
    }}>
      {label && <span style={{ fontWeight: 400, color: '#64748b', fontSize: size - 1 }}>{label}</span>}
      {score}
    </span>
  )
}

function LawBadge({ type }) {
  const colors = {
    voter_id: { bg: '#ede9fe', color: '#7c3aed' },
    early_voting: { bg: '#e0f2fe', color: '#0284c7' },
    mail_voting: { bg: '#fef3c7', color: '#b45309' },
    registration: { bg: '#fce7f3', color: '#be185d' },
    other: { bg: '#f1f5f9', color: '#475569' },
  }
  const c = colors[type] || colors.other
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, textTransform: 'uppercase',
    }}>
      {CATEGORY_LABELS[type] || type}
    </span>
  )
}

function RestrictionBadge({ isRestrictive }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: isRestrictive ? '#fef2f2' : '#f0fdf4',
      color: isRestrictive ? '#dc2626' : '#16a34a',
    }}>
      {isRestrictive ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
      {isRestrictive ? 'Restrictive' : 'Expansive'}
    </span>
  )
}

function StateDetail({ stateCode }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/voter-access/state/${stateCode}`)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [stateCode])

  if (loading) return <div style={{ padding: 16, color: '#64748b' }}>Loading state details...</div>
  if (error) return <div style={{ padding: 16, color: '#dc2626' }}>{error}</div>
  if (!data || !data.laws || data.laws.length === 0) {
    return <div style={{ padding: 16, color: '#64748b' }}>No law data available for this state.</div>
  }

  return (
    <div style={{ padding: '12px 0 0' }}>
      {data.laws.map((law, i) => (
        <div key={law.id || i} style={{
          padding: 14, marginBottom: 10, background: '#f8fafc',
          borderRadius: 8, border: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{law.title}</span>
            <LawBadge type={law.law_type} />
            <RestrictionBadge isRestrictive={law.is_restrictive} />
          </div>

          {law.impacts && law.impacts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Populations affected:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {law.impacts.map((imp, j) => (
                  <span key={j} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: '#fef2f2', color: '#991b1b', fontWeight: 500,
                  }}>
                    <Users size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                    {imp.demographic_group}
                    {imp.affected_population && (
                      <span style={{ marginLeft: 4, color: '#dc2626', fontWeight: 700 }}>
                        ({Number(imp.affected_population).toLocaleString()})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {law.sponsors && law.sponsors.length > 0 && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Sponsors:</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {law.sponsors.map((s, j) => (
                  <Link key={j} to={`/candidate/${s.candidate_id}`} style={{
                    fontSize: 12, color: '#1e3a5f', textDecoration: 'none',
                    padding: '2px 8px', background: '#e0f2fe', borderRadius: 4,
                  }}>
                    {s.name}
                    {s.top_donor && (
                      <span style={{ color: '#64748b', marginLeft: 4 }}>
                        (top donor: {s.top_donor})
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {law.source_url && (
            <div style={{ marginTop: 6 }}>
              <SourceCitation
                value="View source"
                sourceUrl={law.source_url}
                sourceLabel={law.source_label || 'State Legislature'}
                sourceDate={law.enacted_date}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'score_asc', label: 'Worst access first' },
  { value: 'score_desc', label: 'Best access first' },
  { value: 'name', label: 'State name A-Z' },
]

export default function VoterAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [states, setStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedState, setExpandedState] = useState(null)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [sort, setSort] = useState(searchParams.get('sort') || 'score_asc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/voter-access/states')
      .then(d => { if (!cancelled) setStates(d.states || d || []) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const updateParam = useCallback((key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) next.set(key, val)
      else next.delete(key)
      return next
    })
  }, [setSearchParams])

  const handleSortChange = (val) => {
    setSort(val)
    updateParam('sort', val)
  }

  const handleSearchChange = (val) => {
    setSearch(val)
    updateParam('q', val || null)
  }

  const filteredStates = React.useMemo(() => {
    let list = [...states]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.state_code || '').toLowerCase().includes(q)
      )
    }
    if (sort === 'score_asc') list.sort((a, b) => (a.overall_score ?? 100) - (b.overall_score ?? 100))
    else if (sort === 'score_desc') list.sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
    else list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list
  }, [states, search, sort])

  const toggleExpand = (code) => {
    setExpandedState(prev => prev === code ? null : code)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', padding: '40px 20px', marginBottom: 32,
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
        borderRadius: 16, color: '#fff',
      }}>
        <Shield size={48} style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px' }}>Voter Access Tracker</h1>
        <p style={{ fontSize: 15, maxWidth: 600, margin: '0 auto', opacity: 0.9, lineHeight: 1.5 }}>
          Every state law affecting ballot access. Side by side with who it affects most
          — and who funded the politicians who passed it.
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search state..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8,
              border: '1px solid #cbd5e1', fontSize: 14, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowUpDown size={14} style={{ color: '#64748b' }} />
          <select
            value={sort}
            onChange={e => handleSortChange(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
              fontSize: 13, background: '#fff', cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error / Loading */}
      {error && (
        <div style={{
          padding: 16, background: '#fef2f2', color: '#dc2626',
          borderRadius: 8, marginBottom: 20, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading state data...</div>
      ) : filteredStates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
          {search ? 'No states match your search.' : 'No voter access data available.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredStates.map(state => {
            const isExpanded = expandedState === state.state_code
            const score = state.overall_score ?? 0

            return (
              <div key={state.state_code} style={{
                background: '#fff', borderRadius: 12,
                border: '1px solid #e2e8f0', overflow: 'hidden',
                boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
              }}>
                <button
                  onClick={() => toggleExpand(state.state_code)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', border: 'none', background: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {/* Score circle */}
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: scoreBg(score), color: scoreColor(score),
                    fontWeight: 800, fontSize: 16, flexShrink: 0,
                    border: `2px solid ${scoreColor(score)}`,
                  }}>
                    {score}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                      {state.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {['voter_id', 'early_voting', 'mail_voting', 'registration'].map(cat => (
                        state[cat] != null && (
                          <ScoreBadge key={cat} score={state[cat]} label={CATEGORY_LABELS[cat]} small />
                        )
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {state.restrictive_count != null && (
                      <span style={{
                        fontSize: 12, color: '#dc2626', fontWeight: 600,
                        background: '#fef2f2', padding: '2px 8px', borderRadius: 4,
                      }}>
                        {state.restrictive_count} restrictive
                      </span>
                    )}
                    {state.expansive_count != null && (
                      <span style={{
                        fontSize: 12, color: '#16a34a', fontWeight: 600,
                        background: '#f0fdf4', padding: '2px 8px', borderRadius: 4,
                      }}>
                        {state.expansive_count} expansive
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                  </div>
                </button>

                {isExpanded && <StateDetail stateCode={state.state_code} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
