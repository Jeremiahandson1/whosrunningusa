import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import SourceCitation from './SourceCitation'

function formatMoney(n) {
  if (!n) return '$0'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${Number(n).toLocaleString()}`
}

function partyColor(party) {
  if (!party) return '#64748b'
  const p = party.toLowerCase()
  if (p.includes('democrat')) return '#2563eb'
  if (p.includes('republican')) return '#dc2626'
  return '#7c3aed'
}

export default function FundingComparison({ raceId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!raceId) return
    let cancelled = false
    api.get(`/races/${raceId}/funding-comparison`)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [raceId])

  if (error || !data) return null
  const candidates = data.candidates || data || []
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const maxRaised = Math.max(...candidates.map(c => c.total_raised || 0), 1)

  const incumbent = candidates.find(c => c.is_incumbent)
  const challengers = candidates.filter(c => !c.is_incumbent)
  const topChallenger = challengers.length > 0
    ? challengers.reduce((a, b) => (b.total_raised || 0) > (a.total_raised || 0) ? b : a)
    : null
  const gap = incumbent && topChallenger
    ? (incumbent.total_raised || 0) - (topChallenger.total_raised || 0)
    : null

  return (
    <div style={{
      padding: 20, background: '#fff', borderRadius: 12,
      border: '1px solid #e2e8f0', marginTop: 16,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
        Funding Comparison
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {candidates.map(c => {
          const raised = c.total_raised || 0
          const pct = (raised / maxRaised) * 100
          const color = partyColor(c.party)

          return (
            <div key={c.candidate_id || c.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{c.name}</span>
                <span style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: color + '18', color,
                }}>
                  {c.party}
                </span>
                {c.is_incumbent && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    background: '#fef3c7', color: '#b45309',
                  }}>
                    Incumbent
                  </span>
                )}
              </div>

              {/* Bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  flex: 1, background: '#f1f5f9', borderRadius: 6, height: 24,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${Math.max(pct, 2)}%`,
                    background: color, borderRadius: 6,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', minWidth: 70, textAlign: 'right' }}>
                  {c.source_url ? (
                    <SourceCitation
                      value={formatMoney(raised)}
                      sourceUrl={c.source_url}
                      sourceLabel={c.source_label || 'FEC Filing'}
                    />
                  ) : (
                    formatMoney(raised)
                  )}
                </span>
              </div>

              {/* Mini stats */}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {c.pac_pct != null && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    PAC: {Math.round(c.pac_pct)}%
                  </span>
                )}
                {c.small_donor_pct != null && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Small donor: {Math.round(c.small_donor_pct)}%
                  </span>
                )}
                {c.self_financing_pct != null && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Self-funded: {Math.round(c.self_financing_pct)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {gap != null && gap > 0 && (
        <div style={{
          marginTop: 16, padding: '10px 14px', background: '#fefce8',
          borderRadius: 8, fontSize: 13, color: '#92400e', fontWeight: 600,
          textAlign: 'center',
        }}>
          Funding gap: Incumbent raised {formatMoney(gap)} more than next challenger
        </div>
      )}
    </div>
  )
}
