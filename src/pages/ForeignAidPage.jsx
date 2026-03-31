import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { Globe, ChevronLeft, ChevronRight, DollarSign, Shield, Heart, ArrowLeft, Search } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'
import HypocrisyIndex from '../components/HypocrisyIndex'

const CATEGORY_COLORS = {
  military: '#475569',
  economic: '#3b82f6',
  humanitarian: '#f59e0b',
  democracy_promotion: '#22c55e',
  health: '#f43f5e',
}

const CATEGORY_LABELS = {
  military: 'Military',
  economic: 'Economic',
  humanitarian: 'Humanitarian',
  democracy_promotion: 'Democracy Promotion',
  health: 'Health',
}

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

function CategoryBar({ breakdown, total }) {
  if (!breakdown || !total) return null
  const categories = Object.keys(CATEGORY_COLORS)
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#e2e8f0', width: '100%' }}>
      {categories.map(cat => {
        const val = breakdown[cat] || 0
        const pct = (val / total) * 100
        if (pct < 0.5) return null
        return (
          <div
            key={cat}
            title={`${CATEGORY_LABELS[cat]}: ${formatAmount(val)} (${pct.toFixed(1)}%)`}
            style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat], minWidth: pct > 0 ? 2 : 0 }}
          />
        )
      })}
    </div>
  )
}

/* ───────────── Detail View ───────────── */
function CountryDetail({ countryCode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [country, setCountry] = useState(null)
  const [programs, setPrograms] = useState([])
  const [influence, setInfluence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [programTotal, setProgramTotal] = useState(0)
  const [programPages, setProgramPages] = useState(1)

  const tab = searchParams.get('tab') || 'overview'
  const year = searchParams.get('year') || '2026'
  const programPage = parseInt(searchParams.get('pp') || '1', 10)

  const fetchCountry = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/foreign-aid/countries/${countryCode}`)
      setCountry(data)
    } catch (err) {
      setError(err.message || 'Failed to load country data')
    } finally {
      setLoading(false)
    }
  }, [countryCode])

  const fetchPrograms = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(programPage))
      const data = await api.get(`/foreign-aid/countries/${countryCode}/programs?${params.toString()}`)
      setPrograms(data.programs || [])
      setProgramTotal(data.total || 0)
      setProgramPages(data.totalPages || 1)
    } catch { /* handled by main error */ }
  }, [countryCode, programPage])

  const fetchInfluence = useCallback(async () => {
    try {
      const data = await api.get(`/foreign-aid/countries/${countryCode}/influence`)
      setInfluence(data)
    } catch { /* handled by main error */ }
  }, [countryCode])

  useEffect(() => { fetchCountry() }, [fetchCountry])
  useEffect(() => { if (tab === 'programs') fetchPrograms() }, [tab, fetchPrograms])
  useEffect(() => { if (tab === 'influence') fetchInfluence() }, [tab, fetchInfluence])

  function switchTab(newTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', newTab)
    if (newTab !== 'programs') next.delete('pp')
    setSearchParams(next)
  }

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 96, color: '#475569' }}>
          <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p>Loading country data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
          <Link to="/foreign-aid" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#475569', textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 24 }}>
            <ArrowLeft size={16} /> Back to all countries
          </Link>
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        </div>
      </div>
    )
  }

  const yearData = country?.yearly_breakdown?.find(y => String(y.year) === year) || null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Country header */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(32px, 6vw, 56px) 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Link to="/foreign-aid" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8', textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            <ArrowLeft size={16} /> All Countries
          </Link>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 800, margin: '0 0 8px' }}>
            {country?.name || countryCode}
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0 }}>
            Total all-time US aid:{' '}
            <SourceCitation
              value={formatAmount(country?.total_obligation)}
              sourceUrl={country?.source_url}
              sourceLabel={country?.source_label || 'USAID Foreign Aid Explorer'}
              sourceDate={country?.source_date}
            />
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e2e8f0' }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'programs', label: 'Programs' },
            { key: 'influence', label: 'Influence Chain' },
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

        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            {/* Year selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>Year:</span>
              <select
                value={year}
                onChange={e => updateParam('year', e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }}
              >
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Category breakdown for selected year */}
            {yearData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                {Object.keys(CATEGORY_COLORS).map(cat => (
                  <div key={cat} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[cat], margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
                      <SourceCitation
                        value={formatAmount(yearData[cat] || 0)}
                        sourceUrl={yearData.source_url}
                        sourceLabel={yearData.source_label || 'USAID'}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{CATEGORY_LABELS[cat]}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Yearly breakdown table */}
            {country?.yearly_breakdown && country.yearly_breakdown.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <h3 style={{ padding: '16px 20px 0', margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Yearly Breakdown</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Year</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Total</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Military</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Economic</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Humanitarian</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Democracy</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Health</th>
                      </tr>
                    </thead>
                    <tbody>
                      {country.yearly_breakdown.map(row => (
                        <tr key={row.year} style={{ borderBottom: '1px solid #f1f5f9', background: String(row.year) === year ? '#f0f9ff' : 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{row.year}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                            <SourceCitation value={formatAmount(row.total)} sourceUrl={row.source_url} sourceLabel={row.source_label || 'USAID'} />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>{formatAmount(row.military)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>{formatAmount(row.economic)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>{formatAmount(row.humanitarian)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>{formatAmount(row.democracy_promotion)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>{formatAmount(row.health)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Programs Tab */}
        {tab === 'programs' && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{programTotal} program{programTotal !== 1 ? 's' : ''}</div>
            {programs.length === 0 && (
              <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
                <Globe size={48} color="#94a3b8" />
                <p style={{ fontSize: 18, marginTop: 12 }}>No programs found for this country.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {programs.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>{p.name}</div>
                      {p.implementing_agency && (
                        <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>{p.implementing_agency}</div>
                      )}
                      {p.description && (
                        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginTop: 8 }}>{p.description}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
                        <SourceCitation value={formatAmount(p.obligation)} sourceUrl={p.source_url} sourceLabel={p.source_label || 'USAID'} />
                      </div>
                      {p.category && (
                        <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: `${CATEGORY_COLORS[p.category] || '#475569'}15`, color: CATEGORY_COLORS[p.category] || '#475569' }}>
                          {CATEGORY_LABELS[p.category] || p.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {programPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32 }}>
                <button disabled={programPage <= 1} onClick={() => updateParam('pp', String(programPage - 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: programPage <= 1 ? '#f1f5f9' : '#fff', color: programPage <= 1 ? '#94a3b8' : '#1e293b', cursor: programPage <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={{ fontSize: 14, color: '#475569' }}>Page {programPage} of {programPages}</span>
                <button disabled={programPage >= programPages} onClick={() => updateParam('pp', String(programPage + 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: programPage >= programPages ? '#f1f5f9' : '#fff', color: programPage >= programPages ? '#94a3b8' : '#1e293b', cursor: programPage >= programPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Influence Chain Tab */}
        {tab === 'influence' && (
          <>
            {!influence && (
              <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
                <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p>Loading influence data...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            {influence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Chain summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Registered Agents', value: influence.registered_agents?.length || 0 },
                    { label: 'Politicians Contacted', value: influence.politicians_contacted?.length || 0 },
                    { label: 'Total Donations', value: formatAmount(influence.total_donations) },
                    { label: 'Votes Cast', value: influence.votes?.length || 0 },
                  ].map((s, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Registered agents */}
                {influence.registered_agents && influence.registered_agents.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Registered Foreign Agents</h3>
                    {influence.registered_agents.map((agent, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < influence.registered_agents.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 14 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{agent.name}</div>
                          {agent.firm && <div style={{ fontSize: 12, color: '#475569' }}>{agent.firm}</div>}
                        </div>
                        {agent.compensation && (
                          <SourceCitation value={formatAmount(agent.compensation)} sourceUrl={agent.source_url} sourceLabel={agent.source_label || 'FARA Filing'} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Politicians contacted */}
                {influence.politicians_contacted && influence.politicians_contacted.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Politicians Contacted</h3>
                    {influence.politicians_contacted.map((pol, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < influence.politicians_contacted.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 14 }}>
                        <Link to={`/candidate/${pol.politician_id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                          {pol.display_name}
                          <span style={{ fontSize: 12, color: '#475569', fontWeight: 400, marginLeft: 8 }}>{pol.party_affiliation} · {pol.state}</span>
                        </Link>
                        {pol.contact_count && (
                          <span style={{ fontSize: 12, color: '#475569' }}>{pol.contact_count} contact{pol.contact_count !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Donations */}
                {influence.donations && influence.donations.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Related Donations</h3>
                    {influence.donations.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < influence.donations.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 14 }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{d.donor_name}</span>
                          <span style={{ color: '#475569' }}> to </span>
                          <Link to={`/candidate/${d.recipient_id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>{d.recipient_name}</Link>
                        </div>
                        <SourceCitation value={formatAmount(d.amount)} sourceUrl={d.source_url} sourceLabel={d.source_label || 'FEC Filing'} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Votes */}
                {influence.votes && influence.votes.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Related Votes Cast</h3>
                    {influence.votes.map((v, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < influence.votes.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 14, gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{v.bill_title || v.bill_id}</div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            <Link to={`/candidate/${v.politician_id}`} style={{ color: '#475569', textDecoration: 'none', fontWeight: 500 }}>{v.politician_name}</Link>
                            {' voted '}<span style={{ fontWeight: 600, color: v.vote === 'yea' ? '#16a34a' : '#dc2626' }}>{v.vote}</span>
                          </div>
                        </div>
                        {v.date && <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{new Date(v.date).toLocaleDateString()}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Hypocrisy Index */}
        <div style={{ marginTop: 40 }}>
          <HypocrisyIndex countryCode={countryCode} />
        </div>
      </div>
    </div>
  )
}

/* ───────────── List View ───────────── */
function CountryList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [countries, setCountries] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const year = searchParams.get('year') || ''
  const category = searchParams.get('category') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (year) params.set('year', year)
      if (category) params.set('category', category)
      if (search) params.set('search', search)

      const [listData, statsData] = await Promise.all([
        api.get(`/foreign-aid?${params.toString()}`),
        api.get('/foreign-aid/stats'),
      ])
      setCountries(listData.countries || [])
      setTotal(listData.total || 0)
      setTotalPages(listData.totalPages || 1)
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load foreign aid data')
    } finally {
      setLoading(false)
    }
  }, [page, year, category, search])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Globe size={36} /> Foreign Aid Tracker
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
          Track every dollar of US foreign aid — military, economic, humanitarian, and democracy promotion. Every number links to its source.
        </p>
      </section>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Countries', value: (stats.total_countries || 0).toLocaleString(), icon: <Globe size={18} /> },
              { label: 'Total Obligation', value: formatAmount(stats.total_obligation), icon: <DollarSign size={18} /> },
              { label: 'Military', value: `${stats.military_pct || 0}%`, icon: <Shield size={18} /> },
              { label: 'Economic', value: `${stats.economic_pct || 0}%`, icon: <DollarSign size={18} color="#3b82f6" /> },
              { label: 'Humanitarian', value: `${stats.humanitarian_pct || 0}%`, icon: <Heart size={18} color="#f59e0b" /> },
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
              style={{ padding: '8px 12px 8px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 200 }}
            />
          </div>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={year} onChange={e => updateFilter('year', e.target.value)}>
            <option value="">All Years</option>
            {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }} value={category} onChange={e => updateFilter('category', e.target.value)}>
            <option value="">All Categories</option>
            <option value="military">Military</option>
            <option value="economic">Economic</option>
            <option value="humanitarian">Humanitarian</option>
            <option value="democracy_promotion">Democracy Promotion</option>
            <option value="health">Health</option>
          </select>
        </div>

        {/* Loading/Error/Empty */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading foreign aid data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {!loading && !error && countries.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <Globe size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No countries found matching your filters.</p>
          </div>
        )}

        {/* Country cards */}
        {!loading && !error && countries.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total.toLocaleString()} countr{total !== 1 ? 'ies' : 'y'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {countries.map(c => (
                <Link
                  key={c.country_code}
                  to={`/foreign-aid/${c.country_code}`}
                  style={{ textDecoration: 'none', background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'block', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{c.name}</div>
                      {c.region && <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{c.region}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
                        <SourceCitation value={formatAmount(c.total_obligation)} sourceUrl={c.source_url} sourceLabel={c.source_label || 'USAID'} />
                      </div>
                    </div>
                  </div>
                  <CategoryBar breakdown={c.category_breakdown} total={c.total_obligation} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    {Object.keys(CATEGORY_COLORS).map(cat => {
                      const val = c.category_breakdown?.[cat]
                      if (!val) return null
                      return (
                        <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[cat], display: 'inline-block' }} />
                          {CATEGORY_LABELS[cat]}: {formatAmount(val)}
                        </span>
                      )
                    })}
                  </div>
                </Link>
              ))}
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

/* ───────────── Main Export ───────────── */
function ForeignAidPage() {
  const { countryCode } = useParams()

  if (countryCode) {
    return <CountryDetail countryCode={countryCode} />
  }

  return <CountryList />
}

export default ForeignAidPage
