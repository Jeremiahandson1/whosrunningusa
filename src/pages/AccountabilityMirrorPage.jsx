import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowRight, DollarSign, Vote, MessageSquare, ChevronDown, Share2 } from 'lucide-react'
import api from '../utils/api'

const BELIEFS = [
  { label: 'I care about fighting fraud', belief: 'fighting fraud', topic_tag: 'fraud' },
  { label: 'I care about corporate accountability', belief: 'corporate accountability', topic_tag: 'lobbying' },
  { label: 'I care about the national debt', belief: 'the national debt', topic_tag: 'fiscal' },
  { label: 'I care about veterans', belief: 'veterans', topic_tag: 'veterans' },
  { label: 'I care about drug policy', belief: 'drug policy', topic_tag: 'healthcare' },
  { label: 'I care about lobbying reform', belief: 'lobbying reform', topic_tag: 'lobbying' },
  { label: 'I care about Medicare and Medicaid', belief: 'Medicare and Medicaid', topic_tag: 'healthcare' },
]

function formatDollars(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toLocaleString()}`
}

function buildPunchline(politician) {
  const { display_name, top_donors, gaps } = politician
  if (!top_donors || top_donors.length === 0 || !gaps || gaps.length === 0) return null
  const topDonor = top_donors[0]
  const gapCount = gaps.length
  const action = gaps[0].actual_action
  const countWord = gapCount === 1 ? 'once' : gapCount === 2 ? 'twice' : `${gapCount} times`
  return `${display_name} received ${formatDollars(topDonor.total_amount)} from ${topDonor.industry_name}. Then ${action ? action.toLowerCase().replace(/\.$/, '') : 'voted against their own words'}. ${gapCount > 1 ? countWord.charAt(0).toUpperCase() + countWord.slice(1) + '.' : ''}`
}

function SeverityDots({ severity }) {
  const dots = []
  for (let i = 1; i <= 10; i++) {
    let color = 'var(--slate-200)'
    if (i <= severity) {
      if (severity <= 3) color = '#4ade80'
      else if (severity <= 6) color = '#facc15'
      else color = '#ef4444'
    }
    dots.push(
      <span
        key={i}
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          marginRight: 3,
        }}
      />
    )
  }
  return <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 6 }}>{dots}</div>
}

function AccountabilityMirrorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedBelief, setSelectedBelief] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [freeText, setFreeText] = useState('')
  const [politicians, setPoliticians] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedCards, setExpandedCards] = useState({})

  const highlightId = searchParams.get('highlight')

  useEffect(() => {
    const tag = searchParams.get('topic_tag')
    const belief = searchParams.get('belief')
    if (tag) {
      const match = BELIEFS.find(b => b.topic_tag === tag)
      if (match) {
        setSelectedBelief(match.label)
        setSelectedTag(match.topic_tag)
        fetchResults(match.belief, match.topic_tag)
      } else if (belief) {
        setSelectedBelief(belief)
        setSelectedTag(tag)
        fetchResults(belief, tag)
      }
    } else if (belief) {
      setFreeText(belief)
      setSelectedBelief(belief)
      fetchResults(belief, null)
    }
  }, [])

  async function fetchResults(belief, topicTag) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (belief) params.set('belief', belief)
      if (topicTag) params.set('topic_tag', topicTag)
      const data = await api.get(`/accountability/mirror?${params.toString()}`)
      const sorted = (data.politicians || []).sort((a, b) => (b.gap_count || 0) - (a.gap_count || 0))
      setPoliticians(sorted)
      setTotal(data.total || sorted.length)
    } catch (err) {
      setError(err.message || 'Failed to load results')
      setPoliticians([])
    } finally {
      setLoading(false)
    }
  }

  function handleBeliefClick(belief) {
    setSelectedBelief(belief.label)
    setSelectedTag(belief.topic_tag)
    setSearchParams({ topic_tag: belief.topic_tag })
    fetchResults(belief.belief, belief.topic_tag)
  }

  function handleFreeSearch(e) {
    e.preventDefault()
    if (!freeText.trim()) return
    setSelectedBelief(freeText.trim())
    setSelectedTag(null)
    setSearchParams({ belief: freeText.trim() })
    fetchResults(freeText.trim(), null)
  }

  function toggleExpand(politicianId) {
    setExpandedCards(prev => ({ ...prev, [politicianId]: !prev[politicianId] }))
  }

  async function handleShare(politician) {
    const tag = selectedTag || ''
    const url = `${window.location.origin}/accountability-mirror?topic_tag=${encodeURIComponent(tag)}&highlight=${politician.id}`
    const text = `Check out ${politician.display_name}'s accountability record on WhosRunningUSA`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Accountability Mirror', text, url })
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        alert('Link copied to clipboard')
      } catch {
        prompt('Copy this link:', url)
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'var(--navy-800)',
          color: '#fff',
          padding: '80px 20px 60px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            margin: '0 0 16px',
            letterSpacing: '-0.02em',
          }}
        >
          The Accountability Mirror
        </h1>
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            maxWidth: 640,
            margin: '0 auto',
            opacity: 0.85,
            lineHeight: 1.6,
          }}
        >
          Pick something you care about. We'll show you who said the same thing
          — then voted against it.
        </p>
      </section>

      {/* Belief Picker */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {BELIEFS.map(b => (
            <button
              key={b.label}
              onClick={() => handleBeliefClick(b)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                fontSize: '1.05rem',
                fontWeight: 600,
                background: '#fff',
                border: selectedBelief === b.label
                  ? '2px solid var(--burgundy-500)'
                  : '2px solid var(--slate-200)',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: selectedBelief === b.label
                  ? '0 0 0 3px rgba(139, 30, 63, 0.15)'
                  : '0 1px 3px rgba(0,0,0,0.06)',
                color: 'var(--navy-800)',
              }}
            >
              <span>{b.label}</span>
              <ArrowRight size={18} style={{ opacity: 0.4, flexShrink: 0, marginLeft: 12 }} />
            </button>
          ))}
        </div>

        {/* Free-text search */}
        <form
          onSubmit={handleFreeSearch}
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 28,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--slate-600)',
              }}
            />
            <input
              type="text"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Or tell us what you care about..."
              style={{
                width: '100%',
                padding: '14px 14px 14px 42px',
                fontSize: '1rem',
                border: '2px solid var(--slate-200)',
                borderRadius: 10,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '14px 24px',
              background: 'var(--navy-800)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Search
          </button>
        </form>
      </section>

      {/* Results */}
      {(loading || politicians.length > 0 || error) && (
        <section
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '0 20px 60px',
          }}
        >
          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--slate-600)',
              }}
            >
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Checking the receipts...
              </div>
              <div style={{ fontSize: '0.95rem', opacity: 0.7 }}>
                Comparing statements against voting records
              </div>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#b91c1c',
                background: '#fef2f2',
                borderRadius: 12,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && politicians.length === 0 && selectedBelief && (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--slate-600)',
              }}
            >
              <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                No contradictions found for this topic.
              </p>
              <p style={{ fontSize: '0.95rem', opacity: 0.7, marginTop: 8 }}>
                That's either good news or we need more data.
              </p>
            </div>
          )}

          {!loading && !error && politicians.length > 0 && (
            <>
              <h2
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: 'var(--navy-800)',
                  marginBottom: 8,
                }}
              >
                Politicians who said they agree with you — then didn't follow through
              </h2>
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--slate-600)',
                  marginBottom: 32,
                }}
              >
                {total} result{total !== 1 ? 's' : ''} found
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {politicians.map(pol => {
                  const isExpanded = expandedCards[pol.id]
                  const isHighlighted = highlightId === String(pol.id)
                  const punchline = buildPunchline(pol)
                  const primaryGap = pol.gaps && pol.gaps[0]
                  const primaryStatement = pol.matching_statements && pol.matching_statements[0]

                  return (
                    <div
                      key={pol.id}
                      id={`pol-${pol.id}`}
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        border: isHighlighted
                          ? '2px solid var(--burgundy-500)'
                          : '1px solid var(--slate-200)',
                        boxShadow: isHighlighted
                          ? '0 0 0 4px rgba(139, 30, 63, 0.12)'
                          : '0 2px 8px rgba(0,0,0,0.05)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Card header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: '20px 24px',
                          borderBottom: '1px solid var(--slate-200)',
                        }}
                      >
                        {pol.profile_photo_url ? (
                          <img
                            src={pol.profile_photo_url}
                            alt={pol.display_name}
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: '50%',
                              background: 'var(--slate-200)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              fontWeight: 700,
                              color: 'var(--slate-600)',
                              flexShrink: 0,
                            }}
                          >
                            {(pol.display_name || '?')[0]}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            to={`/candidate/${pol.id}`}
                            style={{
                              fontSize: '1.15rem',
                              fontWeight: 700,
                              color: 'var(--navy-800)',
                              textDecoration: 'none',
                            }}
                          >
                            {pol.display_name}
                          </Link>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              color: 'var(--slate-600)',
                              marginTop: 2,
                            }}
                          >
                            {[pol.official_title, pol.party_affiliation, pol.fec_state]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              background: '#fef2f2',
                              color: '#b91c1c',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 20,
                            }}
                          >
                            {pol.gap_count || (pol.gaps && pol.gaps.length) || 0} contradiction{((pol.gap_count || (pol.gaps && pol.gaps.length) || 0) !== 1) ? 's' : ''}
                          </span>
                          <button
                            onClick={() => handleShare(pol)}
                            title="Share"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 6,
                              color: 'var(--slate-600)',
                              display: 'flex',
                            }}
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Split card: Said vs Did */}
                      {primaryGap && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: window.innerWidth > 640 ? '1fr 1px 1fr' : '1fr',
                            minHeight: 0,
                          }}
                        >
                          {/* What they said */}
                          <div
                            style={{
                              padding: '20px 24px',
                              background: 'rgba(74, 222, 128, 0.06)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#16a34a',
                                marginBottom: 10,
                              }}
                            >
                              <MessageSquare size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                              What they said
                            </div>
                            {primaryStatement && (
                              <>
                                <p
                                  style={{
                                    fontSize: '0.95rem',
                                    lineHeight: 1.5,
                                    color: 'var(--navy-800)',
                                    margin: 0,
                                    fontStyle: 'italic',
                                  }}
                                >
                                  "{primaryStatement.statement_text}"
                                </p>
                                {primaryStatement.statement_date && (
                                  <div
                                    style={{
                                      fontSize: '0.78rem',
                                      color: 'var(--slate-600)',
                                      marginTop: 8,
                                    }}
                                  >
                                    {new Date(primaryStatement.statement_date).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                            {!primaryStatement && primaryGap.stated_position && (
                              <p
                                style={{
                                  fontSize: '0.95rem',
                                  lineHeight: 1.5,
                                  color: 'var(--navy-800)',
                                  margin: 0,
                                  fontStyle: 'italic',
                                }}
                              >
                                "{primaryGap.stated_position}"
                              </p>
                            )}
                          </div>

                          {/* Divider */}
                          <div
                            style={{
                              background: 'var(--slate-200)',
                              display: window.innerWidth > 640 ? 'block' : 'none',
                            }}
                          />

                          {/* What they did */}
                          <div
                            style={{
                              padding: '20px 24px',
                              background: 'rgba(239, 68, 68, 0.05)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#dc2626',
                                marginBottom: 10,
                              }}
                            >
                              <Vote size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                              What they did
                            </div>
                            <p
                              style={{
                                fontSize: '0.95rem',
                                lineHeight: 1.5,
                                color: 'var(--navy-800)',
                                margin: 0,
                              }}
                            >
                              {primaryGap.actual_action}
                            </p>
                            {primaryGap.gap_severity != null && (
                              <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginRight: 8 }}>
                                  Severity
                                </span>
                                <SeverityDots severity={primaryGap.gap_severity} />
                              </div>
                            )}
                            {primaryGap.ai_analysis && (
                              <p
                                style={{
                                  fontSize: '0.82rem',
                                  color: 'var(--slate-600)',
                                  marginTop: 10,
                                  lineHeight: 1.4,
                                }}
                              >
                                {primaryGap.ai_analysis}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional gaps (expandable) */}
                      {pol.gaps && pol.gaps.length > 1 && (
                        <>
                          <button
                            onClick={() => toggleExpand(pol.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              width: '100%',
                              padding: '10px',
                              background: 'none',
                              border: 'none',
                              borderTop: '1px solid var(--slate-200)',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              color: 'var(--slate-600)',
                              fontWeight: 500,
                            }}
                          >
                            {isExpanded ? 'Hide' : `Show ${pol.gaps.length - 1} more contradiction${pol.gaps.length - 1 !== 1 ? 's' : ''}`}
                            <ChevronDown
                              size={14}
                              style={{
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.2s',
                              }}
                            />
                          </button>
                          {isExpanded && pol.gaps.slice(1).map((gap, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '16px 24px',
                                borderTop: '1px solid var(--slate-200)',
                                display: 'grid',
                                gridTemplateColumns: window.innerWidth > 640 ? '1fr 1px 1fr' : '1fr',
                                background: '#fafafa',
                              }}
                            >
                              <div style={{ padding: '4px 0' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Stated position
                                </div>
                                <p style={{ fontSize: '0.9rem', margin: 0, fontStyle: 'italic', color: 'var(--navy-800)' }}>
                                  "{gap.stated_position}"
                                </p>
                              </div>
                              <div style={{ background: 'var(--slate-200)', display: window.innerWidth > 640 ? 'block' : 'none' }} />
                              <div style={{ padding: '4px 0' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Actual action
                                </div>
                                <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--navy-800)' }}>
                                  {gap.actual_action}
                                </p>
                                {gap.gap_severity != null && (
                                  <SeverityDots severity={gap.gap_severity} />
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Follow the money */}
                      {pol.top_donors && pol.top_donors.length > 0 && (
                        <div
                          style={{
                            padding: '16px 24px',
                            borderTop: '1px solid var(--slate-200)',
                            background: '#fafafa',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--slate-600)',
                              marginBottom: 10,
                            }}
                          >
                            <DollarSign size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            Follow the money
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {pol.top_donors.slice(0, 3).map((donor, i) => (
                              <div
                                key={i}
                                style={{
                                  background: '#fff',
                                  border: '1px solid var(--slate-200)',
                                  borderRadius: 8,
                                  padding: '8px 14px',
                                  fontSize: '0.88rem',
                                }}
                              >
                                <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>
                                  {donor.industry_name}
                                </span>
                                <span style={{ color: 'var(--slate-600)', marginLeft: 8 }}>
                                  {formatDollars(donor.total_amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {punchline && (
                            <p
                              style={{
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: 'var(--navy-800)',
                                marginTop: 12,
                                marginBottom: 0,
                                lineHeight: 1.5,
                              }}
                            >
                              {punchline}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default AccountabilityMirrorPage
