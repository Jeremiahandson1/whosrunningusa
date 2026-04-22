import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DollarSign, ArrowRight, Search, ChevronLeft, ChevronRight, Vote, CheckCircle, XCircle, Minus } from 'lucide-react'
import api from '../utils/api'
import DarkMoneyCallout from '../components/DarkMoneyCallout'

const CORRELATION_COLORS = {
  aligned: { color: '#dc2626', bg: '#fef2f2', label: 'Donor-Aligned Vote' },
  contradicted: { color: '#16a34a', bg: '#f0fdf4', label: 'Voted Against Donor Interest' },
  neutral: { color: '#475569', bg: '#f1f5f9', label: 'Neutral' },
}

function formatDollars(amount) {
  if (!amount) return '$0'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${Number(amount).toLocaleString()}`
}

function FinanceMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [searchIndustry, setSearchIndustry] = useState(searchParams.get('industry') || '')
  const [searchBill, setSearchBill] = useState(searchParams.get('bill') || '')
  const [correlationFilter, setCorrelationFilter] = useState(searchParams.get('correlation') || '')

  const page = parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    const industry = searchParams.get('industry')
    const bill = searchParams.get('bill')
    const correlation = searchParams.get('correlation')
    if (industry || bill || correlation) {
      fetchConnections()
    }
  }, [searchParams])

  async function fetchConnections() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const industry = searchParams.get('industry')
      const bill = searchParams.get('bill')
      const correlation = searchParams.get('correlation')
      const pg = searchParams.get('page') || '1'

      if (industry) params.set('industry', industry)
      if (bill) params.set('bill', bill)
      if (correlation) params.set('correlation_type', correlation)
      params.set('page', pg)

      const data = await api.get(`/finance-map/search?${params.toString()}`)
      setConnections(data.connections || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    const next = new URLSearchParams()
    if (searchIndustry.trim()) next.set('industry', searchIndustry.trim())
    if (searchBill.trim()) next.set('bill', searchBill.trim())
    if (correlationFilter) next.set('correlation', correlationFilter)
    next.set('page', '1')
    setSearchParams(next)
  }

  function updatePage(newPage) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(newPage))
    setSearchParams(next)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <DollarSign size={36} /> Follow the Money
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Visual connections between campaign donors and subsequent votes. See who's paying and how they're voting.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* How it works — shown always, above the search form, so users know
            what they're about to search for. */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 24px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 16px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How It Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, maxWidth: 720, margin: '0 auto' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <DollarSign size={22} color="#16a34a" />
              </div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>Donors Give</div>
              <div style={{ fontSize: 13, color: '#475569' }}>Campaign contributions from industries and PACs</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <Vote size={22} color="#2563eb" />
              </div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>Politicians Vote</div>
              <div style={{ fontSize: 13, color: '#475569' }}>On legislation affecting those same industries</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <ArrowRight size={22} color="#dc2626" />
              </div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>We Connect</div>
              <div style={{ fontSize: 13, color: '#475569' }}>Map donor money to voting patterns</div>
            </div>
          </div>
        </div>

        {/* Search form — industry is primary; bill + correlation behind a toggle */}
        <form onSubmit={handleSearch} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Industry or Donor</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <DollarSign size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchIndustry}
                onChange={e => setSearchIndustry(e.target.value)}
                placeholder="e.g. Pharmaceuticals, Oil & Gas, NRA..."
                style={{ width: '100%', padding: '12px 14px 12px 36px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <Search size={16} /> Search
            </button>
          </div>

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 600, userSelect: 'none' }}>
              Advanced filters ▾
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Bill / Legislation</label>
                <div style={{ position: 'relative' }}>
                  <Vote size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={searchBill}
                    onChange={e => setSearchBill(e.target.value)}
                    placeholder="e.g. H.R. 1234, Medicare..."
                    style={{ width: '100%', padding: '10px 12px 10px 32px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Correlation</label>
                <select
                  value={correlationFilter}
                  onChange={e => setCorrelationFilter(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }}
                >
                  <option value="">All</option>
                  <option value="aligned">Donor-Aligned Votes</option>
                  <option value="contradicted">Voted Against Donors</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
            </div>
          </details>
        </form>

        {/* Loading/Error */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Mapping the money trail...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
        )}

        {/* Dark Money Callout — show for the first politician in results */}
        {!loading && !error && connections.length > 0 && connections[0]?.politician_id && (
          <div style={{ marginBottom: 20 }}>
            <DarkMoneyCallout candidateId={connections[0].politician_id} />
          </div>
        )}

        {/* Results */}
        {!loading && !error && connections.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{total} connection{total !== 1 ? 's' : ''} found</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {connections.map(c => {
                const cfg = CORRELATION_COLORS[c.correlation_type] || CORRELATION_COLORS.neutral
                return (
                  <div key={c.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20, borderLeft: `4px solid ${cfg.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                      <Link to={`/candidate/${c.politician_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                        {c.profile_photo_url ? (
                          <img src={c.profile_photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569' }}>
                            {(c.display_name || '?')[0]}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{c.display_name}</div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{[c.party_affiliation, c.fec_state].filter(Boolean).join(' · ')}</div>
                        </div>
                      </Link>
                      <span style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* The connection */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: '12px 0', borderTop: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 4 }}>
                          <DollarSign size={12} style={{ verticalAlign: 'middle' }} /> Donor
                        </div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.industry_name}</div>
                        {c.donation_total && (
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                            {formatDollars(c.donation_total)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 4 }}>
                          <Vote size={12} style={{ verticalAlign: 'middle' }} /> Vote
                        </div>
                        {c.bill_title && (
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {c.bill_number && <span style={{ color: '#475569', fontWeight: 400 }}>{c.bill_number}: </span>}
                            {c.bill_title}
                          </div>
                        )}
                        {c.vote_cast && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            {c.vote_cast.toLowerCase() === 'yea' ? <CheckCircle size={14} color="#16a34a" /> : c.vote_cast.toLowerCase() === 'nay' ? <XCircle size={14} color="#dc2626" /> : <Minus size={14} color="#475569" />}
                            <span style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{c.vote_cast}</span>
                          </div>
                        )}
                        {c.vote_date && (
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{new Date(c.vote_date).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>

                    {c.description && (
                      <div style={{ fontSize: 14, color: '#475569', marginTop: 8, lineHeight: 1.5, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                        {c.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, paddingBottom: 32 }}>
                <button disabled={page <= 1} onClick={() => updatePage(page - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => updatePage(page + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
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

export default FinanceMapPage
