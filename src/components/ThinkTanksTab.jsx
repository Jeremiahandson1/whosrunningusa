import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Building2, DollarSign, Users, FileText, ArrowRightLeft, ExternalLink, AlertTriangle } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

function formatDollars(amount) {
  if (!amount) return '$0'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${Number(amount).toLocaleString()}`
}

const DONOR_TYPE_LABELS = {
  foreign_government: 'Foreign Government',
  foreign_corporate: 'Foreign Corporate',
  domestic_corporate: 'Domestic Corporate',
  foundation: 'Foundation',
  individual: 'Individual',
}

const DONOR_TYPE_COLORS = {
  foreign_government: { bg: '#fef2f2', color: '#dc2626' },
  foreign_corporate: { bg: '#fefce8', color: '#ca8a04' },
  domestic_corporate: { bg: '#f1f5f9', color: '#475569' },
  foundation: { bg: '#eff6ff', color: '#2563eb' },
  individual: { bg: '#f0fdf4', color: '#16a34a' },
}

function ThinkTanksTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [thinkTanks, setThinkTanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const search = searchParams.get('tt_search') || ''
  const sort = searchParams.get('tt_sort') || 'foreign_funding'
  const page = parseInt(searchParams.get('tt_page') || '1', 10)

  const fetchThinkTanks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (search) params.set('search', search)
      const data = await api.get(`/foreign-influence/think-tanks?${params.toString()}`)
      setThinkTanks(data.think_tanks || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || 'Failed to load think tanks')
    } finally {
      setLoading(false)
    }
  }, [page, sort, search])

  useEffect(() => { fetchThinkTanks() }, [fetchThinkTanks])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'tt_page') next.set('tt_page', '1')
    next.set('tab', 'think-tanks')
    setSearchParams(next)
  }

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetailLoading(true)
    try {
      const data = await api.get(`/foreign-influence/think-tanks/${id}`)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function groupFundingByType(funding) {
    if (!funding || funding.length === 0) return []
    const groups = {}
    funding.forEach(f => {
      const type = f.donor_type || 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(f)
    })
    return Object.entries(groups)
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          <Search size={16} /> Search
        </span>
        <input
          type="text"
          placeholder="Search think tanks..."
          value={search}
          onChange={e => updateFilter('tt_search', e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 220 }}
        />
        <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('tt_sort', e.target.value)}>
          <option value="foreign_funding">Most Foreign Funding</option>
          <option value="revenue">Highest Revenue</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
          <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p>Loading think tanks...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
      )}

      {/* Empty */}
      {!loading && !error && thinkTanks.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
          <Building2 size={48} color="#94a3b8" />
          <p style={{ fontSize: 18, marginTop: 12 }}>No think tanks found.</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && thinkTanks.length > 0 && (
        <>
          <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} think tank{total !== 1 ? 's' : ''} found</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {thinkTanks.map(tt => (
              <div key={tt.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleExpand(tt.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', cursor: 'pointer', flexWrap: 'wrap' }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={20} color="#2563eb" />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{tt.name}</span>
                      {tt.website && (
                        <a href={tt.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#94a3b8', display: 'flex' }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#475569', marginTop: 4, flexWrap: 'wrap' }}>
                      {tt.total_revenue > 0 && <span>Revenue: {formatDollars(tt.total_revenue)}</span>}
                      {tt.staff_count > 0 && <span>{tt.staff_count} staff</span>}
                      {tt.publication_count > 0 && <span>{tt.publication_count} publication{tt.publication_count !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {tt.total_foreign_funding > 0 && (
                      <span style={{ background: '#fef2f2', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: '#dc2626' }}>
                        <DollarSign size={12} style={{ verticalAlign: 'middle' }} /> {formatDollars(tt.total_foreign_funding)} foreign
                      </span>
                    )}
                    {tt.revolving_door_count > 0 && (
                      <span style={{ background: '#fef2f2', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                        <ArrowRightLeft size={12} style={{ verticalAlign: 'middle' }} /> {tt.revolving_door_count} revolving door
                      </span>
                    )}
                    {expandedId === tt.id ? <ChevronUp size={18} color="#475569" /> : <ChevronDown size={18} color="#475569" />}
                  </div>
                </div>

                {expandedId === tt.id && (
                  <div style={{ padding: '0 24px 24px', borderTop: '1px solid #f1f5f9' }}>
                    {detailLoading && (
                      <div style={{ textAlign: 'center', padding: 32, color: '#475569' }}>
                        <div style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    )}
                    {!detailLoading && detail && (
                      <div style={{ marginTop: 16 }}>
                        {/* Funding section */}
                        {detail.funding && detail.funding.length > 0 && (
                          <div style={{ marginBottom: 24 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <DollarSign size={16} /> Funding Sources
                            </h4>
                            {groupFundingByType(detail.funding).map(([type, donors]) => {
                              const cfg = DONOR_TYPE_COLORS[type] || { bg: '#f1f5f9', color: '#475569' }
                              return (
                                <div key={type} style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, color: cfg.color }}>
                                    {DONOR_TYPE_LABELS[type] || type}
                                  </div>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                          <th style={{ padding: '6px 12px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Donor</th>
                                          <th style={{ padding: '6px 12px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Amount</th>
                                          <th style={{ padding: '6px 12px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Year</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {donors.map((d, i) => (
                                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '6px 12px', color: '#1e293b' }}>
                                              {d.source_url ? (
                                                <SourceCitation value={d.donor_name} sourceUrl={d.source_url} sourceLabel={d.source_label} />
                                              ) : d.donor_name}
                                            </td>
                                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: cfg.color }}>{formatDollars(d.amount)}</td>
                                            <td style={{ padding: '6px 12px', color: '#94a3b8' }}>{d.year || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Staff section */}
                        {detail.staff && detail.staff.length > 0 && (
                          <div style={{ marginBottom: 24 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users size={16} /> Staff
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {detail.staff.map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                                  <Users size={14} color="#475569" style={{ flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    {s.candidate_id ? (
                                      <Link to={`/candidate/${s.candidate_id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                                        {s.name}
                                      </Link>
                                    ) : (
                                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
                                    )}
                                    {s.title && <span style={{ color: '#475569' }}> — {s.title}</span>}
                                  </div>
                                  {s.is_revolving_door && (
                                    <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                                      Revolving Door
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Publications section */}
                        {detail.publications && detail.publications.length > 0 && (
                          <div style={{ marginBottom: 24 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <FileText size={16} /> Publications
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {detail.publications.map((pub, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                                  <FileText size={14} color="#475569" style={{ flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{pub.title}</span>
                                    {pub.date && <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>{new Date(pub.date).toLocaleDateString()}</span>}
                                  </div>
                                  {pub.congressional_record_url && (
                                    <a href={pub.congressional_record_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                      Congressional Record <ExternalLink size={12} />
                                    </a>
                                  )}
                                  {pub.source_url && !pub.congressional_record_url && (
                                    <SourceCitation value="Source" sourceUrl={pub.source_url} sourceLabel={pub.source_label} />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Influence chain summary */}
                        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: 12, padding: 20, color: '#fff' }}>
                          <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={16} color="#fbbf24" /> Influence Chain
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 8, fontWeight: 600 }}>
                              Foreign money in
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: 20 }}>&rarr;</span>
                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 8, fontWeight: 600 }}>
                              Policy recommendations out
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: 20 }}>&rarr;</span>
                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 8, fontWeight: 600 }}>
                              Government officials cycling through
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, paddingBottom: 32 }}>
              <button disabled={page <= 1} onClick={() => updateFilter('tt_page', String(page - 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => updateFilter('tt_page', String(page + 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

export default ThinkTanksTab
