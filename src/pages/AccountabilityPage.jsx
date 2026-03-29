import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Shield, TrendingUp, TrendingDown, Filter, Share2, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../utils/api'

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
]

const TOPICS = [
  'Healthcare', 'Environment', 'Veterans', 'Fiscal',
  'Defense', 'Fraud', 'Lobbying', 'Guns', 'Immigration',
]

const PARTY_COLORS = { D: '#2563eb', R: '#dc2626', I: '#7c3aed' }
const PARTY_LABELS = { D: 'Democrat', R: 'Republican', I: 'Independent' }

function getScoreColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 50) return '#ca8a04'
  if (score >= 25) return '#ea580c'
  return '#dc2626'
}

function getPartyLetter(party) {
  if (!party) return '?'
  const p = party.toLowerCase()
  if (p.includes('democrat')) return 'D'
  if (p.includes('republican')) return 'R'
  return 'I'
}

function AccountabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [politicians, setPoliticians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isMobile, setIsMobile] = useState(false)

  const sort = searchParams.get('sort') || 'desc'
  const party = searchParams.get('party') || ''
  const state = searchParams.get('state') || ''
  const chamber = searchParams.get('chamber') || ''
  const topic = searchParams.get('topic') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const highlightId = searchParams.get('highlight') || ''

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('sort', sort)
      params.set('page', String(page))
      if (party) params.set('party', party)
      if (state) params.set('state', state)
      if (chamber) params.set('chamber', chamber)
      if (topic) params.set('topic', topic)

      const data = await api.get(`/accountability/leaderboard?${params.toString()}`)
      setPoliticians(data.politicians || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err.message || 'Failed to load leaderboard')
      setPoliticians([])
    } finally {
      setLoading(false)
    }
  }, [sort, party, state, chamber, topic, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  function handleShare(politician) {
    const url = `${window.location.origin}/accountability?highlight=${politician.id}`
    const text = `${politician.display_name} has a ${politician.consistency_score}% consistency score on WhosRunningUSA`

    if (navigator.share) {
      navigator.share({ title: 'Accountability Leaderboard', text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('Link copied to clipboard!')
      }).catch(() => {
        alert('Could not copy link')
      })
    }
  }

  const rankOffset = (page - 1) * 20

  // Styles
  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
    },
    hero: {
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: '#ffffff',
      padding: isMobile ? '48px 16px' : '64px 32px',
      textAlign: 'center',
    },
    heroTitle: {
      fontSize: isMobile ? '28px' : '42px',
      fontWeight: 800,
      margin: '0 0 12px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
    },
    heroSub: {
      fontSize: isMobile ? '16px' : '20px',
      color: '#94a3b8',
      margin: 0,
      fontStyle: 'italic',
    },
    container: {
      maxWidth: '960px',
      margin: '0 auto',
      padding: isMobile ? '16px' : '32px',
    },
    filterBar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
      padding: '20px',
      background: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '24px',
    },
    filterLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: 600,
      color: '#1e293b',
      fontSize: '14px',
    },
    select: {
      padding: '8px 12px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#475569',
      background: '#ffffff',
      cursor: 'pointer',
      minWidth: isMobile ? '100%' : '140px',
      outline: 'none',
    },
    sortToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      background: sort === 'desc' ? '#1e293b' : '#9f1239',
      color: '#ffffff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 600,
      marginLeft: isMobile ? '0' : 'auto',
      width: isMobile ? '100%' : 'auto',
      justifyContent: 'center',
    },
    resultCount: {
      fontSize: '14px',
      color: '#475569',
      marginBottom: '16px',
    },
    card: (isHighlighted) => ({
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '12px' : '16px',
      padding: isMobile ? '14px' : '16px 20px',
      background: isHighlighted ? '#fef3c7' : '#ffffff',
      borderRadius: '12px',
      boxShadow: isHighlighted
        ? '0 0 0 2px #f59e0b, 0 2px 8px rgba(0,0,0,0.1)'
        : '0 1px 3px rgba(0,0,0,0.08)',
      marginBottom: '10px',
      transition: 'box-shadow 0.2s',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    }),
    rank: {
      fontWeight: 800,
      fontSize: '18px',
      color: '#1e293b',
      minWidth: '32px',
      textAlign: 'center',
    },
    photo: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      objectFit: 'cover',
      flexShrink: 0,
    },
    photoPlaceholder: (partyLetter) => ({
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: PARTY_COLORS[partyLetter] || '#64748b',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '16px',
      flexShrink: 0,
    }),
    nameSection: {
      flex: 1,
      minWidth: isMobile ? '100%' : '160px',
    },
    nameLink: {
      fontWeight: 700,
      fontSize: '15px',
      color: '#1e293b',
      textDecoration: 'none',
    },
    meta: {
      fontSize: '12px',
      color: '#475569',
      marginTop: '2px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap',
    },
    partyBadge: (letter) => ({
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: '9999px',
      fontSize: '11px',
      fontWeight: 700,
      color: '#ffffff',
      background: PARTY_COLORS[letter] || '#64748b',
    }),
    scoreSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: isMobile ? '100%' : '200px',
    },
    scoreBarOuter: {
      flex: 1,
      height: '8px',
      background: '#e2e8f0',
      borderRadius: '4px',
      overflow: 'hidden',
    },
    scoreBarInner: (score) => ({
      height: '100%',
      width: `${Math.max(score, 2)}%`,
      background: getScoreColor(score),
      borderRadius: '4px',
      transition: 'width 0.4s ease',
    }),
    scoreLabel: (score) => ({
      fontWeight: 700,
      fontSize: '14px',
      color: getScoreColor(score),
      minWidth: '40px',
      textAlign: 'right',
    }),
    gapsChip: {
      fontSize: '11px',
      color: '#9f1239',
      background: '#fef2f2',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    },
    shareBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#475569',
      padding: '6px',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
    },
    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '16px',
      marginTop: '32px',
      paddingBottom: '32px',
    },
    pageBtn: (disabled) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 20px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      background: disabled ? '#f1f5f9' : '#ffffff',
      color: disabled ? '#94a3b8' : '#1e293b',
      cursor: disabled ? 'default' : 'pointer',
      fontWeight: 600,
      fontSize: '14px',
    }),
    pageInfo: {
      fontSize: '14px',
      color: '#475569',
    },
    center: {
      textAlign: 'center',
      padding: '64px 16px',
      color: '#475569',
    },
    spinner: {
      display: 'inline-block',
      width: '32px',
      height: '32px',
      border: '3px solid #e2e8f0',
      borderTopColor: '#1e293b',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
    errorBox: {
      padding: '24px',
      background: '#fef2f2',
      borderRadius: '12px',
      color: '#9f1239',
      textAlign: 'center',
      fontWeight: 500,
    },
  }

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Hero */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>
          <Shield size={isMobile ? 28 : 36} />
          Accountability Leaderboard
        </h1>
        <p style={styles.heroSub}>The data doesn't have a party. Neither do we.</p>
      </div>

      <div style={styles.container}>
        {/* Filter bar */}
        <div style={styles.filterBar}>
          <span style={styles.filterLabel}>
            <Filter size={16} /> Filters
          </span>

          <select
            style={styles.select}
            value={party}
            onChange={(e) => updateFilter('party', e.target.value)}
          >
            <option value="">All Parties</option>
            <option value="Democrat">Democrat</option>
            <option value="Republican">Republican</option>
            <option value="Independent">Independent</option>
          </select>

          <select
            style={styles.select}
            value={state}
            onChange={(e) => updateFilter('state', e.target.value)}
          >
            <option value="">All States</option>
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            style={styles.select}
            value={chamber}
            onChange={(e) => updateFilter('chamber', e.target.value)}
          >
            <option value="">All Chambers</option>
            <option value="House">House</option>
            <option value="Senate">Senate</option>
          </select>

          <select
            style={styles.select}
            value={topic}
            onChange={(e) => updateFilter('topic', e.target.value)}
          >
            <option value="">All Topics</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            style={styles.sortToggle}
            onClick={() => updateFilter('sort', sort === 'desc' ? 'asc' : 'desc')}
          >
            {sort === 'desc' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {sort === 'desc' ? 'Most Consistent' : 'Least Consistent'}
          </button>
        </div>

        {/* Results */}
        {loading && (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p>Loading leaderboard...</p>
          </div>
        )}

        {error && !loading && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {!loading && !error && politicians.length === 0 && (
          <div style={styles.center}>
            <Shield size={48} color="#94a3b8" />
            <p style={{ fontSize: '18px', marginTop: '12px' }}>
              No politicians found matching your filters.
            </p>
          </div>
        )}

        {!loading && !error && politicians.length > 0 && (
          <>
            <div style={styles.resultCount}>
              Showing {rankOffset + 1}–{Math.min(rankOffset + politicians.length, total)} of {total} politicians
            </div>

            {politicians.map((p, i) => {
              const partyLetter = getPartyLetter(p.party_affiliation)
              const rank = rankOffset + i + 1
              const score = p.consistency_score ?? 0
              const isHighlighted = highlightId && String(p.id) === String(highlightId)

              return (
                <div key={p.id} style={styles.card(isHighlighted)}>
                  <span style={styles.rank}>#{rank}</span>

                  {p.profile_photo_url ? (
                    <img
                      src={p.profile_photo_url}
                      alt={p.display_name}
                      style={styles.photo}
                    />
                  ) : (
                    <div style={styles.photoPlaceholder(partyLetter)}>
                      {(p.display_name || '?')[0]}
                    </div>
                  )}

                  <div style={styles.nameSection}>
                    <Link to={`/candidate/${p.id}`} style={styles.nameLink}>
                      {p.display_name}
                    </Link>
                    <div style={styles.meta}>
                      <span style={styles.partyBadge(partyLetter)}>
                        {PARTY_LABELS[partyLetter] || p.party_affiliation || 'Unknown'}
                      </span>
                      {p.fec_state && <span>{p.fec_state}</span>}
                      {p.fec_office_type && <span>{p.fec_office_type}</span>}
                      {p.official_title && <span>{p.official_title}</span>}
                    </div>
                  </div>

                  <div style={styles.scoreSection}>
                    <div style={styles.scoreBarOuter}>
                      <div style={styles.scoreBarInner(score)} />
                    </div>
                    <span style={styles.scoreLabel(score)}>{score}%</span>
                  </div>

                  {p.total_gaps_found > 0 && (
                    <span style={styles.gapsChip}>
                      {p.total_gaps_found} gap{p.total_gaps_found !== 1 ? 's' : ''}
                    </span>
                  )}

                  <button
                    style={styles.shareBtn}
                    onClick={() => handleShare(p)}
                    title="Share"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              )
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  style={styles.pageBtn(page <= 1)}
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span style={styles.pageInfo}>
                  Page {page} of {totalPages}
                </span>
                <button
                  style={styles.pageBtn(page >= totalPages)}
                  disabled={page >= totalPages}
                  onClick={() => updateFilter('page', String(page + 1))}
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

export default AccountabilityPage
