import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Globe, Filter, ChevronLeft, ChevronRight, Shield, AlertTriangle, Users, DollarSign, Building2, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'
import ThinkTanksTab from '../components/ThinkTanksTab'

function formatDollars(amount) {
  if (!amount) return '$0'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${Number(amount).toLocaleString()}`
}

const TABS = [
  { key: 'agents', label: 'Agents' },
  { key: 'principals', label: 'Principals' },
  { key: 'enforcement', label: 'Enforcement' },
  { key: 'think-tanks', label: 'Think Tanks' },
]

function AgentsTab({ searchParams, setSearchParams }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const country = searchParams.get('country') || ''
  const active = searchParams.get('active') || ''
  const search = searchParams.get('search') || ''
  const sort = searchParams.get('sort') || 'spend'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (country) params.set('country', country)
      if (active) params.set('active', active)
      if (search) params.set('search', search)
      const data = await api.get(`/foreign-influence/agents?${params.toString()}`)
      setAgents(data.agents || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [page, sort, country, active, search])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    next.set('tab', 'agents')
    setSearchParams(next)
  }

  async function toggleExpand(agentId) {
    if (expandedId === agentId) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(agentId)
    setDetailLoading(true)
    try {
      const data = await api.get(`/foreign-influence/agents/${agentId}`)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) return <Spinner message="Loading foreign agents..." />
  if (error) return <ErrorMsg message={error} />
  if (agents.length === 0) return <EmptyState icon={<Globe size={48} color="#94a3b8" />} message="No foreign agents found." />

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          <Filter size={16} /> Filters
        </span>
        <input
          type="text"
          placeholder="Search registrants..."
          value={search}
          onChange={e => updateFilter('search', e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 180 }}
        />
        <input
          type="text"
          placeholder="Country..."
          value={country}
          onChange={e => updateFilter('country', e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 140 }}
        />
        <button
          onClick={() => updateFilter('active', active === 'true' ? '' : 'true')}
          style={{
            padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: active === 'true' ? '#1e293b' : '#fff',
            color: active === 'true' ? '#fff' : '#475569',
          }}
        >
          Active Only
        </button>
        <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
          <option value="spend">Highest Spend</option>
          <option value="contacts">Most Contacts</option>
          <option value="recent">Most Recent</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} registrant{total !== 1 ? 's' : ''} found</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {agents.map(agent => (
          <div key={agent.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleExpand(agent.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', cursor: 'pointer', flexWrap: 'wrap' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={20} color="#2563eb" />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{agent.registrant_name}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                  Registered {agent.registration_date ? new Date(agent.registration_date).toLocaleDateString() : 'N/A'}
                  {agent.countries && agent.countries.length > 0 && ` · ${agent.countries.join(', ')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  background: agent.is_active ? '#f0fdf4' : '#f1f5f9',
                  color: agent.is_active ? '#16a34a' : '#94a3b8',
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                }}>
                  {agent.is_active ? 'Active' : 'Inactive'}
                </span>
                {agent.contract_count > 0 && (
                  <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    {agent.contract_count} contract{agent.contract_count !== 1 ? 's' : ''}
                  </span>
                )}
                {agent.contact_count > 0 && (
                  <span style={{ background: '#eff6ff', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                    {agent.contact_count} contact{agent.contact_count !== 1 ? 's' : ''}
                  </span>
                )}
                {agent.total_contract_value > 0 && (
                  <span style={{ background: '#fef2f2', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: '#dc2626' }}>
                    {formatDollars(agent.total_contract_value)}
                  </span>
                )}
                {expandedId === agent.id ? <ChevronUp size={18} color="#475569" /> : <ChevronDown size={18} color="#475569" />}
              </div>
            </div>

            {expandedId === agent.id && (
              <div style={{ padding: '0 24px 20px', borderTop: '1px solid #f1f5f9' }}>
                {detailLoading && <Spinner message="Loading details..." />}
                {!detailLoading && detail && (
                  <div style={{ marginTop: 16 }}>
                    {/* Contracts table */}
                    {detail.contracts && detail.contracts.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Contracts</h4>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Principal</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Country</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>Value</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Period</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.contracts.map((c, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>{c.principal_name}</td>
                                  <td style={{ padding: '8px 12px', color: '#475569' }}>{c.country}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatDollars(c.value)}</td>
                                  <td style={{ padding: '8px 12px', color: '#475569' }}>
                                    {c.start_date ? new Date(c.start_date).toLocaleDateString() : '?'} — {c.end_date ? new Date(c.end_date).toLocaleDateString() : 'ongoing'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Contacts list */}
                    {detail.contacts && detail.contacts.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Congressional Contacts</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {detail.contacts.map((contact, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                              <Users size={14} color="#475569" style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                {contact.politician_id ? (
                                  <Link to={`/candidate/${contact.politician_id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                                    {contact.politician_name}
                                  </Link>
                                ) : (
                                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{contact.politician_name}</span>
                                )}
                                {contact.contact_type && <span style={{ color: '#475569' }}> — {contact.contact_type}</span>}
                              </div>
                              {contact.date && <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(contact.date).toLocaleDateString()}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disbursements */}
                    {detail.disbursements && detail.disbursements.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Disbursements</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {detail.disbursements.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                              <DollarSign size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                              <span style={{ flex: 1, color: '#1e293b' }}>{d.description || d.purpose}</span>
                              <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatDollars(d.amount)}</span>
                              {d.date && <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(d.date).toLocaleDateString()}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => updateFilter('page', String(p))} />
    </>
  )
}

function PrincipalsTab({ searchParams, setSearchParams }) {
  const [principals, setPrincipals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const country = searchParams.get('country') || ''
  const govOnly = searchParams.get('gov_only') || ''
  const search = searchParams.get('search') || ''
  const sort = searchParams.get('sort') || 'spend'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchPrincipals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sort', sort)
      if (country) params.set('country', country)
      if (govOnly) params.set('gov_only', govOnly)
      if (search) params.set('search', search)
      const data = await api.get(`/foreign-influence/principals?${params.toString()}`)
      setPrincipals(data.principals || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || 'Failed to load principals')
    } finally {
      setLoading(false)
    }
  }, [page, sort, country, govOnly, search])

  useEffect(() => { fetchPrincipals() }, [fetchPrincipals])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    next.set('tab', 'principals')
    setSearchParams(next)
  }

  async function toggleExpand(principalId) {
    if (expandedId === principalId) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(principalId)
    setDetailLoading(true)
    try {
      const data = await api.get(`/foreign-influence/principals/${principalId}`)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) return <Spinner message="Loading foreign principals..." />
  if (error) return <ErrorMsg message={error} />
  if (principals.length === 0) return <EmptyState icon={<Globe size={48} color="#94a3b8" />} message="No foreign principals found." />

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          <Filter size={16} /> Filters
        </span>
        <input
          type="text"
          placeholder="Search principals..."
          value={search}
          onChange={e => updateFilter('search', e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 180 }}
        />
        <input
          type="text"
          placeholder="Country..."
          value={country}
          onChange={e => updateFilter('country', e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 140 }}
        />
        <button
          onClick={() => updateFilter('gov_only', govOnly === 'true' ? '' : 'true')}
          style={{
            padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: govOnly === 'true' ? '#1e293b' : '#fff',
            color: govOnly === 'true' ? '#fff' : '#475569',
          }}
        >
          Government Only
        </button>
        <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
          <option value="spend">Highest Spend</option>
          <option value="agents">Most Agents</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} principal{total !== 1 ? 's' : ''} found</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {principals.map(p => (
          <div key={p.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div
              onClick={() => toggleExpand(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', cursor: 'pointer', flexWrap: 'wrap' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: p.is_government ? '#fef2f2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {p.is_government ? <Shield size={20} color="#dc2626" /> : <Building2 size={20} color="#475569" />}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{p.country}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.is_government && (
                  <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                    Government
                  </span>
                )}
                {p.agent_count > 0 && (
                  <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    {p.agent_count} agent{p.agent_count !== 1 ? 's' : ''}
                  </span>
                )}
                {p.total_us_lobbying_spend > 0 && (
                  <span style={{ background: '#fefce8', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: '#ca8a04' }}>
                    {formatDollars(p.total_us_lobbying_spend)}
                  </span>
                )}
                {expandedId === p.id ? <ChevronUp size={18} color="#475569" /> : <ChevronDown size={18} color="#475569" />}
              </div>
            </div>

            {expandedId === p.id && (
              <div style={{ padding: '0 24px 20px', borderTop: '1px solid #f1f5f9' }}>
                {detailLoading && <Spinner message="Loading details..." />}
                {!detailLoading && detail && (
                  <div style={{ marginTop: 16 }}>
                    {/* Agents list */}
                    {detail.agents && detail.agents.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Registered Agents</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {detail.agents.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                              <Building2 size={14} color="#475569" style={{ flexShrink: 0 }} />
                              <span style={{ flex: 1, fontWeight: 600, color: '#1e293b' }}>{a.registrant_name}</span>
                              {a.contract_value && <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatDollars(a.contract_value)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Politician contacts */}
                    {detail.contacts && detail.contacts.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Politician Contacts</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {detail.contacts.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                              <Users size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                              {c.politician_id ? (
                                <Link to={`/candidate/${c.politician_id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none', flex: 1 }}>
                                  {c.politician_name}
                                </Link>
                              ) : (
                                <span style={{ flex: 1, fontWeight: 600, color: '#1e293b' }}>{c.politician_name}</span>
                              )}
                              {c.contact_type && <span style={{ color: '#475569', fontSize: 12 }}>{c.contact_type}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related votes */}
                    {detail.related_votes && detail.related_votes.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Related Votes</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {detail.related_votes.map((v, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ flex: 1, color: '#1e293b' }}>
                                {v.bill_number && <span style={{ fontWeight: 600 }}>{v.bill_number}: </span>}
                                {v.bill_title}
                              </span>
                              {v.date && <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(v.date).toLocaleDateString()}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => updateFilter('page', String(p))} />
    </>
  )
}

function EnforcementTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      try {
        const result = await api.get('/foreign-influence/enforcement')
        setData(result)
      } catch (err) {
        setError(err.message || 'Failed to load enforcement data')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return <Spinner message="Loading enforcement actions..." />
  if (error) return <ErrorMsg message={error} />

  const enforced = (data?.cases || []).filter(c => c.is_enforced)
  const unenforced = (data?.cases || []).filter(c => !c.is_enforced)

  function groupByCountry(cases) {
    const groups = {}
    cases.forEach(c => {
      const key = c.country || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }

  const enforcedGroups = groupByCountry(enforced)
  const unenforcedGroups = groupByCountry(unenforced)

  if (enforced.length === 0 && unenforced.length === 0) {
    return <EmptyState icon={<Shield size={48} color="#94a3b8" />} message="No enforcement data available." />
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Enforced column */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>
          <Shield size={20} color="#16a34a" /> Enforcement Actions
        </h3>
        {enforcedGroups.length === 0 ? (
          <div style={{ padding: 24, background: '#fff', borderRadius: 12, color: '#475569', textAlign: 'center', fontSize: 14 }}>No enforcement actions on record.</div>
        ) : enforcedGroups.map(([country, cases]) => (
          <div key={country} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{country}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cases.map((c, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.5, marginBottom: 8 }}>{c.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                    {c.action_type && <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{c.action_type}</span>}
                    {c.date && <span style={{ color: '#94a3b8' }}>{new Date(c.date).toLocaleDateString()}</span>}
                    {c.source_url && (
                      <SourceCitation value="Source" sourceUrl={c.source_url} sourceLabel={c.source_label || 'DOJ'} sourceDate={c.date ? new Date(c.date).toLocaleDateString() : undefined} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unenforced column */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>
          <AlertTriangle size={20} color="#ca8a04" /> No Enforcement
        </h3>
        {unenforcedGroups.length === 0 ? (
          <div style={{ padding: 24, background: '#fff', borderRadius: 12, color: '#475569', textAlign: 'center', fontSize: 14 }}>All cases have been enforced.</div>
        ) : unenforcedGroups.map(([country, cases]) => (
          <div key={country} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{country}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cases.map((c, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #ca8a04' }}>
                  <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.5, marginBottom: 8 }}>{c.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                    {c.source_url && (
                      <SourceCitation value="Source" sourceUrl={c.source_url} sourceLabel={c.source_label || 'DOJ'} sourceDate={c.date ? new Date(c.date).toLocaleDateString() : undefined} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Shared utility components */
function Spinner({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
      <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ErrorMsg({ message }) {
  return <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{message}</div>
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
      {icon}
      <p style={{ fontSize: 18, marginTop: 12 }}>{message}</p>
    </div>
  )
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, paddingBottom: 32 }}>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
        <ChevronLeft size={16} /> Prev
      </button>
      <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  )
}

function ForeignInfluencePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState(null)

  const tab = searchParams.get('tab') || 'agents'

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await api.get('/foreign-influence')
        setStats(data)
      } catch {
        /* stats are non-critical */
      }
    }
    fetchStats()
  }, [])

  function switchTab(newTab) {
    const next = new URLSearchParams()
    next.set('tab', newTab)
    setSearchParams(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Globe size={36} /> Foreign Influence Tracker
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
          Every foreign agent registered under FARA. Every dollar spent lobbying Congress. Every contact with your representatives.
        </p>
      </section>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Registrants', value: stats.totalRegistrants, icon: <Building2 size={20} /> },
              { label: 'Foreign Principals', value: stats.totalPrincipals, icon: <Globe size={20} /> },
              { label: 'Contract Value', value: formatDollars(stats.totalContractValue), icon: <DollarSign size={20} />, raw: true },
              { label: 'Congressional Contacts', value: stats.totalContacts, icon: <Users size={20} /> },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ color: '#475569', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{s.raw ? s.value : (s.value || 0).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e2e8f0' }}>
          {TABS.map(t => (
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

        {/* Tab content */}
        {tab === 'agents' && <AgentsTab searchParams={searchParams} setSearchParams={setSearchParams} />}
        {tab === 'principals' && <PrincipalsTab searchParams={searchParams} setSearchParams={setSearchParams} />}
        {tab === 'enforcement' && <EnforcementTab />}
        {tab === 'think-tanks' && <ThinkTanksTab />}
      </div>
    </div>
  )
}

export default ForeignInfluencePage
