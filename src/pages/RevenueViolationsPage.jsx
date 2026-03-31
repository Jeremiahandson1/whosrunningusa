import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, DollarSign, Shield, Building2, Users, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, FileText, Scale } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const CATEGORY_LABELS = {
  trust_fund_raid: 'Trust Fund Raid',
  corporate_bailout: 'Corporate Bailout',
  pension_failure: 'Pension Failure',
}

const CATEGORY_STYLES = {
  trust_fund_raid: { background: '#334155', color: '#e2e8f0' },
  corporate_bailout: { background: '#d97706', color: '#fff' },
  pension_failure: { background: '#dc2626', color: '#fff' },
}

function formatDollars(n) {
  if (!n && n !== 0) return '$0'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function RevenueViolationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [violations, setViolations] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const category = searchParams.get('category') || ''
  const sort = searchParams.get('sort') || 'amount'
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (category) params.set('category', category)
      if (search) params.set('search', search)

      const [listData, statsData] = await Promise.all([
        api.get(`/revenue-violations?${params.toString()}`),
        api.get('/revenue-violations/stats'),
      ])
      setViolations(listData.violations || [])
      setTotal(listData.total || 0)
      setTotalPages(listData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load violations')
    } finally {
      setLoading(false)
    }
  }, [page, sort, category, search])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  async function toggleDetail(id) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const data = await api.get(`/revenue-violations/${id}`)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AlertTriangle size={36} /> They Took It
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Every confirmed instance of dedicated American funds raided, diverted, or misused. Every number sourced to government records, court documents, or official audits.
        </p>
      </section>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Violations', value: (stats.total_violations || 0).toLocaleString(), icon: <AlertTriangle size={20} /> },
              { label: 'Total Dollars', value: formatDollars(stats.total_dollars), icon: <DollarSign size={20} /> },
              { label: 'Trust Fund Raids', value: (stats.trust_fund_raids || 0).toLocaleString(), icon: <Shield size={20} /> },
              { label: 'Corporate Bailouts', value: (stats.corporate_bailouts || 0).toLocaleString(), icon: <Building2 size={20} /> },
              { label: 'Pension Failures', value: (stats.pension_failures || 0).toLocaleString(), icon: <Users size={20} /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
          <select
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }}
            value={category}
            onChange={e => updateFilter('category', e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="trust_fund_raid">Trust Fund Raid</option>
            <option value="corporate_bailout">Corporate Bailout</option>
            <option value="pension_failure">Pension Failure</option>
          </select>
          <select
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }}
            value={sort}
            onChange={e => updateFilter('sort', e.target.value)}
          >
            <option value="amount">Dollar Amount</option>
            <option value="date">Date</option>
            <option value="name">Name</option>
          </select>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search violations..."
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading violations...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && violations.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <AlertTriangle size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No violations found.</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && violations.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total.toLocaleString()} violation{total !== 1 ? 's' : ''} found</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {violations.map(v => {
                const isExpanded = expandedId === v.id
                const catStyle = CATEGORY_STYLES[v.category] || { background: '#475569', color: '#fff' }
                return (
                  <div key={v.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleDetail(v.id)}
                      style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 24px', display: 'block' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{v.title}</h3>
                            <span style={{ ...catStyle, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                              {CATEGORY_LABELS[v.category] || v.category}
                            </span>
                          </div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                            {v.amount_display || formatDollars(v.amount)}
                          </div>
                          <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                            {v.description && v.description.length > 200
                              ? v.description.slice(0, 200) + '...'
                              : v.description}
                          </p>
                          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#64748b' }}>
                            {v.source_count > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FileText size={13} /> {v.source_count} source{v.source_count !== 1 ? 's' : ''}
                              </span>
                            )}
                            {v.actor_count > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Users size={13} /> {v.actor_count} linked actor{v.actor_count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ color: '#94a3b8', flexShrink: 0, paddingTop: 4 }}>
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #e2e8f0', padding: '24px' }}>
                        {detailLoading && (
                          <div style={{ textAlign: 'center', padding: 32, color: '#475569' }}>
                            <div style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          </div>
                        )}

                        {!detailLoading && detail && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Full description */}
                            {detail.description && (
                              <div>
                                <p style={{ margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.7 }}>{detail.description}</p>
                              </div>
                            )}

                            {/* What Was Taken */}
                            {detail.what_was_taken && (
                              <div style={{ background: '#fef2f2', borderRadius: 10, padding: 20, borderLeft: '4px solid #dc2626' }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <DollarSign size={16} /> What Was Taken
                                </h4>
                                <p style={{ margin: 0, fontSize: 14, color: '#7f1d1d', lineHeight: 1.6 }}>{detail.what_was_taken}</p>
                              </div>
                            )}

                            {/* Who Did It */}
                            {detail.who_did_it && (
                              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 20, borderLeft: '4px solid #475569' }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Who Did It</h4>
                                <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{detail.who_did_it}</p>
                              </div>
                            )}

                            {/* Accountability */}
                            {(detail.consequences_for_responsible || detail.consequences_for_harmed) && (
                              <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Scale size={16} /> Accountability
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                                  {detail.consequences_for_responsible && (
                                    <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 16 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>What happened to those responsible</div>
                                      <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{detail.consequences_for_responsible}</p>
                                    </div>
                                  )}
                                  {detail.consequences_for_harmed && (
                                    <div style={{ background: '#fef2f2', borderRadius: 10, padding: 16 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>What happened to those harmed</div>
                                      <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{detail.consequences_for_harmed}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Current Status */}
                            {detail.current_status && (
                              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 20, borderLeft: '4px solid #16a34a' }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#166534' }}>Current Status</h4>
                                <p style={{ margin: 0, fontSize: 14, color: '#14532d', lineHeight: 1.6 }}>{detail.current_status}</p>
                              </div>
                            )}

                            {/* Sources */}
                            {detail.sources && detail.sources.length > 0 && (
                              <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <FileText size={16} /> Sources ({detail.sources.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {detail.sources.map((src, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 14 }}>
                                      <ExternalLink size={14} color="#475569" style={{ flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <SourceCitation
                                          value={src.source_label || 'Source'}
                                          sourceUrl={src.source_url}
                                          sourceLabel={src.source_label}
                                          sourceDate={src.source_date}
                                        />
                                      </div>
                                      {src.source_type && (
                                        <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          {src.source_type}
                                        </span>
                                      )}
                                      {src.source_date && (
                                        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          {new Date(src.source_date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Connected Officials */}
                            {detail.actors && detail.actors.length > 0 && (
                              <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Users size={16} /> Connected Officials ({detail.actors.length})
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                  {detail.actors.map((actor, i) => (
                                    actor.candidate_id ? (
                                      <Link
                                        key={i}
                                        to={`/candidate/${actor.candidate_id}`}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#f1f5f9', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#1e293b' }}
                                      >
                                        <Users size={14} color="#475569" />
                                        {actor.name || actor.display_name}
                                        {actor.role && <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}> -- {actor.role}</span>}
                                      </Link>
                                    ) : (
                                      <span
                                        key={i}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#f8fafc', borderRadius: 10, fontSize: 14, color: '#475569' }}
                                      >
                                        {actor.name || actor.display_name}
                                        {actor.role && <span style={{ fontSize: 12, color: '#94a3b8' }}> -- {actor.role}</span>}
                                      </span>
                                    )
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Related Accountability Gaps */}
                            {detail.relatedGaps && detail.relatedGaps.length > 0 && (
                              <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Related Accountability Gaps</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {detail.relatedGaps.map((gap, i) => (
                                    <Link
                                      key={i}
                                      to="/accountability"
                                      style={{ padding: '6px 14px', background: '#fefce8', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#854d0e', textDecoration: 'none', border: '1px solid #fde68a' }}
                                    >
                                      {gap.title || gap.name || `Gap #${gap.id}`}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!detailLoading && !detail && (
                          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 14 }}>
                            Could not load violation details.
                          </div>
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
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter('page', String(page + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}
                >
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

export default RevenueViolationsPage
